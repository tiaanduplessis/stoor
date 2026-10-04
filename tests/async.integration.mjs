// @deno-types="../dist/async.d.mts"
import AsyncStoor, { AsyncStoorBatchError } from "../dist/async.mjs";

/** @param {unknown} actual @param {unknown} expected */
function equal(actual, expected) {
	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
		throw new Error(
			`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
		);
	}
}

/** @param {unknown} condition @param {string} message */
function assert(condition, message) {
	if (!condition) throw new Error(message);
}

/**
 * @param {typeof AsyncStoor} Store
 * @param {typeof AsyncStoorBatchError} BatchError
 */
export async function checkAsync(Store, BatchError) {
	/** @type {Map<string, string>} */
	const values = new Map();
	/** @type {string[]} */
	const calls = [];
	const failure = new Error("committed but acknowledgement lost");
	const storage = {
		values,
		/** @param {string} key */
		async getItem(key) {
			calls.push(`get:${key}`);
			return this.values.get(key) ?? null;
		},
		/** @param {string} key @param {string} value */
		async setItem(key, value) {
			calls.push(`set:${key}`);
			this.values.set(key, value);
			if (key === "n:failed") throw failure;
		},
		/** @param {string} key */
		async removeItem(key) {
			calls.push(`remove:${key}`);
			this.values.delete(key);
		},
		clear() {
			throw new Error("Storage-wide cleanup must not occur");
		},
	};
	const store = new Store({ storage, namespace: "n" });
	equal(calls, []);
	assert(!("clear" in store), "AsyncStoor must not expose clear");
	const write = store.set("value", { nested: false });
	const read = store.get("value");
	assert((await write) === store, "single set result");
	equal(await read, { nested: false });
	equal(calls, ["set:n:value", "get:n:value"]);
	equal(values.get("n:value"), '{"value":{"nested":false},"timeout":null}');
	equal(
		await store.set([
			["a", 0],
			["a", ""],
			["b", false],
		]),
		[undefined, undefined, undefined],
	);
	equal(await store.get(["b", "missing", "a", "a"], "default"), [
		false,
		"default",
		"",
		"",
	]);
	assert((await store.remove("value")) === store, "single remove result");
	equal(await store.remove(["a", "a"]), [undefined, undefined]);
	equal(await store.get(["value", "a", "b"]), [null, null, false]);

	const payload = { nested: 1 };
	const queued = store.set("snapshot", payload);
	payload.nested = 2;
	await queued;
	equal(await store.get("snapshot"), { nested: 1 });
	/** @type {Promise<AsyncStoor> | undefined} */
	let nested;
	await store.set("outer", {
		toJSON() {
			nested = store.set("inner", 2);
			return 1;
		},
	});
	await nested;
	assert(
		calls.indexOf("set:n:outer") < calls.indexOf("set:n:inner"),
		"reentrant order",
	);

	let rejected = false;
	try {
		await store.set([
			["first", 1],
			["failed", 2],
			["unattempted", 3],
		]);
	} catch (error) {
		assert(error instanceof BatchError, "batch error class");
		if (!(error instanceof BatchError)) throw error;
		equal(
			[error.operation, error.index, error.key, error.completedCount],
			["set", 1, "failed", 1],
		);
		assert(error.cause === failure, "original cause");
		rejected = true;
	}
	assert(rejected, "batch should reject");
	equal(await store.get(["first", "failed", "unattempted"]), [1, 2, null]);
	equal(calls.filter((item) => item === "set:n:failed").length, 1);
	assert(!calls.includes("set:n:unattempted"), "fail-fast batch");

	values.set("n:malformed", "not JSON");
	await store.get("malformed").then(
		() => {
			throw new Error("Malformed input should reject");
		},
		(error) => assert(error instanceof SyntaxError, "JSON error"),
	);
	equal(values.get("n:malformed"), "not JSON");
	const now = Date.now;
	try {
		Date.now = () => 10000;
		await store.set("expired", 1, 10);
		await store.set("forever", 0, 0);
		Date.now = () => 10010;
		equal(await store.get(["expired", "forever"], false), [false, 0]);
		assert(values.has("n:expired"), "expiry must not delete");
	} finally {
		Date.now = now;
	}
	console.log("Async storage integration passed");
}

await checkAsync(AsyncStoor, AsyncStoorBatchError);

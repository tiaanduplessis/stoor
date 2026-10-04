import { afterEach, describe, expect, expectTypeOf, test, vi } from "vitest";
import AsyncStoor, {
	AsyncStoorBatchError,
	type AsyncStorageAdapter,
	type AsyncStorageConfig,
} from "../src/async";

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function thenable<T>(value: T): PromiseLike<T> {
	return {
		then(onfulfilled, onrejected) {
			return Promise.resolve(value).then(onfulfilled, onrejected);
		},
	};
}

function createAdapter() {
	const data = new Map<string, string>();
	const storage = {
		getItem: vi.fn((key: string): string | null => data.get(key) ?? null),
		setItem: vi.fn((key: string, value: string): void => {
			data.set(key, value);
		}),
		removeItem: vi.fn((key: string): void => {
			data.delete(key);
		}),
	};
	return { data, storage };
}

function envelope(value: unknown, timeout: number | null = null) {
	return JSON.stringify({ value, timeout });
}

function expectNoOperations(
	storage: ReturnType<typeof createAdapter>["storage"],
) {
	expect(storage.getItem).not.toHaveBeenCalled();
	expect(storage.setItem).not.toHaveBeenCalled();
	expect(storage.removeItem).not.toHaveBeenCalled();
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("AsyncStoor construction and adapter contract", () => {
	test("accepts exactly the three adapter methods without constructor I/O or clear", () => {
		const { storage } = createAdapter();
		const store = new AsyncStoor({ storage });
		expect(store.namespace).toBe("");
		expectNoOperations(storage);
		expect("clear" in store).toBe(false);
	});

	test("does not access global storage, probe, or fall back", async () => {
		const local = vi
			.spyOn(window, "localStorage", "get")
			.mockImplementation(() => {
				throw new Error("global local storage must not be read");
			});
		const session = vi
			.spyOn(window, "sessionStorage", "get")
			.mockImplementation(() => {
				throw new Error("global session storage must not be read");
			});
		vi.stubGlobal("window", undefined);
		vi.stubGlobal("Deno", { version: { deno: "2" } });
		const { storage } = createAdapter();
		const failure = new Error("explicit adapter unavailable");
		storage.setItem.mockImplementation(() => {
			throw failure;
		});
		const store = new AsyncStoor({ storage });
		expectNoOperations(storage);
		await expect(store.set("key", 1)).rejects.toBe(failure);
		expect(storage.setItem).toHaveBeenCalledTimes(1);
		expect(storage.getItem).not.toHaveBeenCalled();
		expect(storage.removeItem).not.toHaveBeenCalled();
		expect(local).not.toHaveBeenCalled();
		expect(session).not.toHaveBeenCalled();
	});

	test.each([
		["missing config", undefined],
		["null config", null],
		["missing adapter", {}],
		["null adapter", { storage: null }],
		["named adapter", { storage: "local" }],
		["empty adapter", { storage: {} }],
		["missing getItem", { storage: { setItem() {}, removeItem() {} } }],
		["missing setItem", { storage: { getItem() {}, removeItem() {} } }],
		["missing removeItem", { storage: { getItem() {}, setItem() {} } }],
		[
			"nonfunction method",
			{ storage: { getItem: 1, setItem() {}, removeItem() {} } },
		],
	])("rejects %s synchronously", (_label, config) => {
		expect(() => new AsyncStoor(config as AsyncStorageConfig)).toThrow(
			TypeError,
		);
	});

	test.each([null, 0, false, {}, ["scope"], "a:b", ":", "scope:"])(
		"rejects namespace %j synchronously without adapter I/O",
		(namespace) => {
			const { storage } = createAdapter();
			expect(
				() => new AsyncStoor({ storage, namespace: namespace as string }),
			).toThrow(TypeError);
			expectNoOperations(storage);
		},
	);

	test.each(["", "scope", "space allowed", "名前"])(
		"uses the exact namespace and colon separator: %j",
		async (namespace) => {
			const { storage, data } = createAdapter();
			const store = new AsyncStoor({ storage, namespace });
			await store.set("logical:part", false);
			expect(data.get(`${namespace}:logical:part`)).toBe(envelope(false));
			await expect(store.get("logical:part")).resolves.toBe(false);
			await store.remove("logical:part");
			expect(storage.getItem).toHaveBeenCalledWith(`${namespace}:logical:part`);
			expect(storage.removeItem).toHaveBeenCalledWith(
				`${namespace}:logical:part`,
			);
		},
	);

	test("keeps namespaces isolated when sharing an adapter", async () => {
		const { storage } = createAdapter();
		const first = new AsyncStoor({ storage, namespace: "first" });
		const second = new AsyncStoor({ storage, namespace: "second" });
		await first.set("same", 1);
		await second.set("same", 2);
		await first.remove("same");
		await expect(first.get("same")).resolves.toBeNull();
		await expect(second.get("same")).resolves.toBe(2);
	});

	test.each(["sync", "promise", "thenable"] as const)(
		"supports %s adapters and preserves their method receiver",
		async (mode) => {
			const data = new Map<string, string>();
			const wrap = <T>(value: T): T | PromiseLike<T> =>
				mode === "sync"
					? value
					: mode === "promise"
						? Promise.resolve(value)
						: thenable(value);
			const storage: AsyncStorageAdapter = {
				getItem(key) {
					expect(this).toBe(storage);
					return wrap(data.get(key) ?? null);
				},
				setItem(key, value) {
					expect(this).toBe(storage);
					data.set(key, value);
					return wrap(undefined);
				},
				removeItem(key) {
					expect(this).toBe(storage);
					data.delete(key);
					return wrap(undefined);
				},
			};
			const store = new AsyncStoor({ storage });
			await expect(store.set("key", { nested: [0, false] })).resolves.toBe(
				store,
			);
			await expect(store.get("key")).resolves.toEqual({ nested: [0, false] });
			await expect(store.remove("key")).resolves.toBe(store);
			await expect(store.get("key")).resolves.toBeNull();
		},
	);

	test("returns native Promises with the documented single and batch types", async () => {
		const { storage } = createAdapter();
		class DerivedStoor extends AsyncStoor {}
		const store = new DerivedStoor({ storage });
		const write = store.set("a", 1);
		const writes = store.set([["b", 2]] as const);
		const read = store.get("a");
		const reads = store.get(["a", "b"] as const);
		const remove = store.remove("a");
		const removals = store.remove(["b"] as const);
		expectTypeOf(write).toEqualTypeOf<Promise<DerivedStoor>>();
		expectTypeOf(writes).toEqualTypeOf<Promise<void[]>>();
		expectTypeOf(read).toEqualTypeOf<Promise<unknown>>();
		expectTypeOf(reads).toEqualTypeOf<Promise<unknown[]>>();
		expectTypeOf(remove).toEqualTypeOf<Promise<DerivedStoor>>();
		expectTypeOf(removals).toEqualTypeOf<Promise<void[]>>();
		for (const result of [write, writes, read, reads, remove, removals]) {
			expect(result).toBeInstanceOf(Promise);
		}
		await expect(write).resolves.toBe(store);
		await expect(writes).resolves.toEqual([undefined]);
		await expect(read).resolves.toBe(1);
		await expect(reads).resolves.toEqual([1, 2]);
		await expect(remove).resolves.toBe(store);
		await expect(removals).resolves.toEqual([undefined]);
	});
});

describe("AsyncStoor values and stored data", () => {
	test.each([false, 0, "", "hello", 3, { nested: [1, false] }, [1, 2]])(
		"round-trips JSON and preserves falsy values: %j",
		async (value) => {
			const { storage } = createAdapter();
			const store = new AsyncStoor({ storage });
			await store.set("value", value);
			await expect(store.get("value", "fallback")).resolves.toEqual(value);
		},
	);

	test.each([null, undefined])(
		"uses defaults for nullish values: %j",
		async (value) => {
			const { storage } = createAdapter();
			const store = new AsyncStoor({ storage });
			await store.set("value", value);
			await expect(store.get("value")).resolves.toBeNull();
			await expect(store.get("value", "fallback")).resolves.toBe("fallback");
		},
	);

	test("uses defaults for absent values and valid envelopes with no value", async () => {
		const { storage, data } = createAdapter();
		data.set(":empty", '{"timeout":null}');
		const store = new AsyncStoor({ storage });
		await expect(store.get("missing")).resolves.toBeNull();
		await expect(store.get("missing", undefined)).resolves.toBeNull();
		await expect(store.get("missing", false)).resolves.toBe(false);
		await expect(store.get("empty", 0)).resolves.toBe(0);
		const fallback = { shared: true };
		const values = await store.get(["missing", "empty"], fallback);
		expect(values).toEqual([fallback, fallback]);
		expect(values[0]).toBe(fallback);
		expect(values[1]).toBe(fallback);
	});

	test("requires an own timeout field even when Object.prototype has one", async () => {
		const { storage, data } = createAdapter();
		data.set(":missing-timeout", '{"value":1}');
		const store = new AsyncStoor({ storage });
		const descriptor = Object.getOwnPropertyDescriptor(
			Object.prototype,
			"timeout",
		);
		let error: unknown;
		try {
			Object.defineProperty(Object.prototype, "timeout", {
				configurable: true,
				writable: true,
				value: null,
			});
			error = await store
				.get("missing-timeout")
				.catch((cause: unknown) => cause);
		} finally {
			if (descriptor)
				Object.defineProperty(Object.prototype, "timeout", descriptor);
			else Reflect.deleteProperty(Object.prototype, "timeout");
		}
		expect(error).toBeInstanceOf(TypeError);
		expect(storage.removeItem).not.toHaveBeenCalled();
	});

	test("does not read an inherited value from an otherwise valid envelope", async () => {
		const { storage, data } = createAdapter();
		data.set(":missing-value", '{"timeout":null}');
		const store = new AsyncStoor({ storage });
		const descriptor = Object.getOwnPropertyDescriptor(
			Object.prototype,
			"value",
		);
		let result: unknown;
		try {
			Object.defineProperty(Object.prototype, "value", {
				configurable: true,
				writable: true,
				value: "inherited",
			});
			result = await store.get("missing-value", "fallback");
		} finally {
			if (descriptor)
				Object.defineProperty(Object.prototype, "value", descriptor);
			else Reflect.deleteProperty(Object.prototype, "value");
		}
		expect(result).toBe("fallback");
		expect(storage.removeItem).not.toHaveBeenCalled();
	});

	test("preserves duplicate keys and requested order for all batch methods", async () => {
		const { storage, data } = createAdapter();
		const store = new AsyncStoor({ storage });
		await expect(
			store.set([
				["same", 1],
				["other", false],
				["same", 2],
			]),
		).resolves.toEqual([undefined, undefined, undefined]);
		expect(storage.setItem.mock.calls.map(([key]) => key)).toEqual([
			":same",
			":other",
			":same",
		]);
		expect(data.get(":same")).toBe(envelope(2));
		await expect(
			store.get(["same", "missing", "other", "same"]),
		).resolves.toEqual([2, null, false, 2]);
		expect(storage.getItem.mock.calls.map(([key]) => key)).toEqual([
			":same",
			":missing",
			":other",
			":same",
		]);
		await expect(store.remove(["same", "other", "same"])).resolves.toEqual([
			undefined,
			undefined,
			undefined,
		]);
		expect(storage.removeItem.mock.calls.map(([key]) => key)).toEqual([
			":same",
			":other",
			":same",
		]);
	});

	test("empty batches resolve to empty arrays without adapter I/O", async () => {
		const { storage } = createAdapter();
		const store = new AsyncStoor({ storage });
		await expect(store.get([])).resolves.toEqual([]);
		await expect(store.set([])).resolves.toEqual([]);
		await expect(store.remove([])).resolves.toEqual([]);
		expectNoOperations(storage);
	});

	test.each(["", "not JSON", '{"value":'])(
		"rejects malformed JSON %j without deleting it",
		async (raw) => {
			const { storage, data } = createAdapter();
			data.set(":corrupt", raw);
			const store = new AsyncStoor({ storage });
			await expect(store.get("corrupt", "fallback")).rejects.toBeInstanceOf(
				SyntaxError,
			);
			expect(storage.getItem).toHaveBeenCalledTimes(1);
			expect(storage.removeItem).not.toHaveBeenCalled();
			expect(storage.setItem).not.toHaveBeenCalled();
			expect(data.get(":corrupt")).toBe(raw);
		},
	);

	test.each([
		"null",
		"false",
		"0",
		'"string"',
		"[]",
		"{}",
		'{"value":1}',
		'{"value":1,"timeout":"1000"}',
		'{"value":1,"timeout":false}',
		'{"value":1,"timeout":{}}',
		'{"value":1,"timeout":1e400}',
	])("rejects invalid stored envelope %s without cleanup", async (raw) => {
		const { storage, data } = createAdapter();
		data.set(":corrupt", raw);
		const store = new AsyncStoor({ storage });
		await expect(store.get("corrupt", "fallback")).rejects.toBeInstanceOf(
			TypeError,
		);
		expect(storage.getItem).toHaveBeenCalledTimes(1);
		expect(storage.removeItem).not.toHaveBeenCalled();
		expect(storage.setItem).not.toHaveBeenCalled();
		expect(data.get(":corrupt")).toBe(raw);
	});

	test.each([undefined, false, 0, {}, [], new String("null")])(
		"rejects an invalid adapter read result instead of returning a default: %j",
		async (invalid) => {
			const { storage } = createAdapter();
			storage.getItem.mockReturnValue(invalid as string);
			const store = new AsyncStoor({ storage });
			await expect(store.get("key", "fallback")).rejects.toBeInstanceOf(
				TypeError,
			);
			expect(storage.removeItem).not.toHaveBeenCalled();
		},
	);
});

describe("AsyncStoor validation and eager preparation", () => {
	const invalidKeys = [
		undefined,
		null,
		"",
		0,
		false,
		{},
		new String("key"),
		new Set(["key"]),
	];

	test.each(["get", "set", "remove"] as const)(
		"%s rejects invalid keys through Promises without synchronous throws",
		async (operation) => {
			const { storage } = createAdapter();
			const store = new AsyncStoor({ storage });
			for (const key of invalidKeys) {
				let result!: Promise<unknown>;
				expect(() => {
					result = store[operation](key as never);
				}).not.toThrow();
				expect(result).toBeInstanceOf(Promise);
				await expect(result).rejects.toBeInstanceOf(TypeError);
			}
			expectNoOperations(storage);
		},
	);

	test.each(["get", "remove"] as const)(
		"%s prevalidates every key and rejects sparse arrays/non-array iterables",
		async (operation) => {
			const { storage } = createAdapter();
			const store = new AsyncStoor({ storage });
			const sparse = ["valid", , "later"];
			for (const keys of [
				["valid", ""],
				["valid", null],
				["valid", 1],
				sparse,
				new Set(["valid"]),
				{ 0: "valid", length: 1 },
			]) {
				await expect(store[operation](keys as string[])).rejects.toBeInstanceOf(
					TypeError,
				);
			}
			expectNoOperations(storage);
		},
	);

	test.each([
		[
			"invalid key",
			[
				["valid", 1],
				["", 2],
			],
		],
		[
			"numeric key",
			[
				["valid", 1],
				[0, 2],
			],
		],
		["short pair", [["valid", 1], ["short"]]],
		[
			"long pair",
			[
				["valid", 1],
				["long", 2, 3],
			],
		],
		["non-array pair", [["valid", 1], new Set(["key", 2])]],
		["missing pair", [["valid", 1], undefined]],
		["sparse entries", [["valid", 1], , ["later", 2]]],
		[
			"sparse key",
			[
				["valid", 1],
				[, 2],
			],
		],
		[
			"sparse value",
			[
				["valid", 1],
				["hole", ,],
			],
		],
		["non-array iterable", new Map([["valid", 1]])],
	])(
		"set rejects %s before writing any batch entry",
		async (_label, entries) => {
			const { storage } = createAdapter();
			const store = new AsyncStoor({ storage });
			const result = store.set(entries as never);
			expect(result).toBeInstanceOf(Promise);
			await expect(result).rejects.toBeInstanceOf(TypeError);
			expectNoOperations(storage);
		},
	);

	test("accepts an explicit undefined tuple value while rejecting a missing tuple element", async () => {
		const { storage, data } = createAdapter();
		const store = new AsyncStoor({ storage });
		await expect(store.set([["explicit", undefined]])).resolves.toEqual([
			undefined,
		]);
		expect(data.get(":explicit")).toBe('{"timeout":null}');
		await expect(store.get("explicit", "fallback")).resolves.toBe("fallback");
	});

	test("prevalidates all batch keys before invoking any value serialization", async () => {
		const { storage } = createAdapter();
		const toJSON = vi.fn(() => "serialized");
		const store = new AsyncStoor({ storage });
		await expect(
			store.set([
				["first", { toJSON }],
				["", 2],
			]),
		).rejects.toBeInstanceOf(TypeError);
		expect(toJSON).not.toHaveBeenCalled();
		expectNoOperations(storage);
	});

	test.each(["circular", "bigint", "throwing toJSON"] as const)(
		"serializes every payload before any write (%s)",
		async (kind) => {
			const { storage } = createAdapter();
			const circular: { self?: unknown } = {};
			circular.self = circular;
			const failure = new Error("serialization failed");
			const value =
				kind === "circular"
					? circular
					: kind === "bigint"
						? BigInt(1)
						: {
								toJSON() {
									throw failure;
								},
							};
			const store = new AsyncStoor({ storage });
			const result = store.set([
				["first", 1],
				["broken", value],
				["later", 3],
			]);
			await expect(result).rejects.toBeInstanceOf(
				kind === "throwing toJSON" ? Error : TypeError,
			);
			if (kind === "throwing toJSON")
				await expect(result).rejects.toBe(failure);
			expectNoOperations(storage);
		},
	);

	test("snapshots batch keys, pairs, and serialized values at invocation while another call blocks", async () => {
		const { storage, data } = createAdapter();
		const blocker = deferred<string | null>();
		const started = deferred<void>();
		storage.getItem.mockImplementationOnce(() => {
			started.resolve(undefined);
			return blocker.promise as never;
		});
		data.set(":existing", envelope("before"));
		data.set(":remove", envelope(true));
		const store = new AsyncStoor({ storage });
		const first = store.get("blocker");
		const keys = ["existing"];
		const removeKeys = ["remove"];
		const value = { nested: ["snapshot"] };
		const pairs: [string, unknown][] = [["write", value]];
		const reads = store.get(keys);
		const writes = store.set(pairs);
		const removals = store.remove(removeKeys);
		keys[0] = "changed";
		keys.push("extra");
		removeKeys[0] = "unrelated";
		pairs[0][0] = "changed-write";
		pairs[0][1] = "changed-value";
		pairs.push(["extra", 2]);
		value.nested.push("too late");
		await started.promise;
		expect(storage.setItem).not.toHaveBeenCalled();
		expect(storage.removeItem).not.toHaveBeenCalled();
		blocker.resolve(null);
		await first;
		await expect(reads).resolves.toEqual(["before"]);
		await expect(writes).resolves.toEqual([undefined]);
		await expect(removals).resolves.toEqual([undefined]);
		expect(data.get(":write")).toBe(envelope({ nested: ["snapshot"] }));
		expect(data.has(":changed-write")).toBe(false);
		expect(data.has(":extra")).toBe(false);
		expect(data.has(":remove")).toBe(false);
	});

	test("serializes a single value synchronously before returning its Promise", async () => {
		const { storage, data } = createAdapter();
		const toJSON = vi.fn(() => ({ snapshot: true }));
		const store = new AsyncStoor({ storage });
		const result = store.set("key", { toJSON });
		expect(toJSON).toHaveBeenCalledTimes(1);
		expect(storage.setItem).not.toHaveBeenCalled();
		toJSON.mockReturnValue({ snapshot: false });
		await result;
		expect(data.get(":key")).toBe(envelope({ snapshot: true }));
	});
});

describe("AsyncStoor FIFO queue and failures", () => {
	test("queues overlapping set/get/remove calls until asynchronous operations settle", async () => {
		const gate = deferred<void>();
		const started = deferred<void>();
		const events: string[] = [];
		const data = new Map<string, string>();
		const storage: AsyncStorageAdapter = {
			async setItem(key, value) {
				events.push(`set:start:${key}`);
				started.resolve(undefined);
				await gate.promise;
				data.set(key, value);
				events.push(`set:end:${key}`);
			},
			getItem(key) {
				events.push(`get:${key}`);
				return data.get(key) ?? null;
			},
			removeItem(key) {
				events.push(`remove:${key}`);
				data.delete(key);
			},
		};
		const store = new AsyncStoor({ storage });
		const write = store.set("key", 7);
		const read = store.get("key");
		const removal = store.remove("key");
		const missing = store.get("key");
		await started.promise;
		expect(events).toEqual(["set:start::key"]);
		gate.resolve(undefined);
		await expect(write).resolves.toBe(store);
		await expect(read).resolves.toBe(7);
		await expect(removal).resolves.toBe(store);
		await expect(missing).resolves.toBeNull();
		expect(events).toEqual([
			"set:start::key",
			"set:end::key",
			"get::key",
			"remove::key",
			"get::key",
		]);
	});

	test.each(["get", "set", "remove"] as const)(
		"keeps an entire asynchronous %s batch in one FIFO slot",
		async (operation) => {
			const gates = [deferred<void>(), deferred<void>()];
			const starts = [deferred<void>(), deferred<void>()];
			const events: string[] = [];
			const perform = async (kind: string, key: string) => {
				events.push(`${kind}:start:${key}`);
				if (kind === operation && [":a", ":b"].includes(key)) {
					const index = key === ":a" ? 0 : 1;
					starts[index].resolve(undefined);
					await gates[index].promise;
				}
				events.push(`${kind}:end:${key}`);
			};
			const storage: AsyncStorageAdapter = {
				async getItem(key) {
					await perform("get", key);
					return envelope(key);
				},
				async setItem(key) {
					await perform("set", key);
				},
				async removeItem(key) {
					await perform("remove", key);
				},
			};
			const store = new AsyncStoor({ storage });
			const batch =
				operation === "set"
					? store.set([
							["a", 1],
							["b", 2],
						])
					: store[operation](["a", "b"]);
			const later = store.get("later");
			await starts[0].promise;
			expect(events).toEqual([`${operation}:start::a`]);
			gates[0].resolve(undefined);
			await starts[1].promise;
			expect(events).toEqual([
				`${operation}:start::a`,
				`${operation}:end::a`,
				`${operation}:start::b`,
			]);
			gates[1].resolve(undefined);
			await expect(batch).resolves.toEqual(
				operation === "get" ? [":a", ":b"] : [undefined, undefined],
			);
			await expect(later).resolves.toBe(":later");
			expect(events).toEqual([
				`${operation}:start::a`,
				`${operation}:end::a`,
				`${operation}:start::b`,
				`${operation}:end::b`,
				"get:start::later",
				"get:end::later",
			]);
		},
	);

	test("does not serialize independent instances sharing an adapter", async () => {
		const { storage } = createAdapter();
		const gate = deferred<string | null>();
		storage.getItem.mockImplementationOnce(() => gate.promise as never);
		const first = new AsyncStoor({ storage });
		const second = new AsyncStoor({ storage });
		const blocked = first.get("blocked");
		await expect(second.set("independent", 1)).resolves.toBe(second);
		gate.resolve(null);
		await blocked;
	});

	test.each([false, true])(
		"reserves the outer call before a reentrant toJSON (serialization fails: %s)",
		async (fail) => {
			const { storage } = createAdapter();
			const store = new AsyncStoor({ storage });
			const failure = new Error("outer serialization failed");
			let nested!: Promise<AsyncStoor>;
			let outerSettled = false;
			const payload = {
				toJSON() {
					nested = store.set("inner", 2);
					if (fail) throw failure;
					return 1;
				},
			};
			storage.setItem.mockImplementation((key) => {
				if (key === ":inner") expect(outerSettled).toBe(true);
			});
			const outer = store.set("outer", payload);
			const observed = outer.then(
				(value) => {
					outerSettled = true;
					return value;
				},
				(error) => {
					outerSettled = true;
					throw error;
				},
			);
			const later = store.set("later", 3);
			if (fail) await expect(observed).rejects.toBe(failure);
			else await expect(observed).resolves.toBe(store);
			await nested;
			await later;
			expect(storage.setItem.mock.calls.map(([key]) => key)).toEqual(
				fail ? [":inner", ":later"] : [":outer", ":inner", ":later"],
			);
		},
	);

	test("reserves a call before reentrant key validation and recovers from its rejection", async () => {
		const { storage } = createAdapter();
		const store = new AsyncStoor({ storage });
		let nested!: Promise<AsyncStoor>;
		let outerSettled = false;
		const keys = ["placeholder"];
		Object.defineProperty(keys, 0, {
			get() {
				nested = store.set("inner", 1);
				return "";
			},
		});
		storage.setItem.mockImplementation(() => {
			expect(outerSettled).toBe(true);
		});
		const outer = store.get(keys).catch((error) => {
			outerSettled = true;
			throw error;
		});
		await expect(outer).rejects.toBeInstanceOf(TypeError);
		await expect(nested).resolves.toBe(store);
		expect(storage.getItem).not.toHaveBeenCalled();
		expect(storage.setItem).toHaveBeenCalledTimes(1);
	});

	test("keeps validation failures queued behind earlier calls, then allows recovery", async () => {
		const { storage } = createAdapter();
		const gate = deferred<string | null>();
		const started = deferred<void>();
		storage.getItem.mockImplementationOnce(() => {
			started.resolve(undefined);
			return gate.promise as never;
		});
		const store = new AsyncStoor({ storage });
		const blocked = store.get("blocked");
		let invalidSettled = false;
		const invalid = store.remove("").catch((error) => {
			invalidSettled = true;
			throw error;
		});
		const invalidAssertion = expect(invalid).rejects.toBeInstanceOf(TypeError);
		const later = store.set("later", 1);
		await started.promise;
		expect(invalidSettled).toBe(false);
		expect(storage.setItem).not.toHaveBeenCalled();
		gate.resolve(null);
		await blocked;
		await invalidAssertion;
		await expect(later).resolves.toBe(store);
		expect(invalidSettled).toBe(true);
	});

	test.each(["get", "set", "remove"] as const)(
		"propagates synchronous and asynchronous %s failures unchanged and recovers",
		async (operation) => {
			for (const asynchronous of [false, true]) {
				for (const failure of [
					new Error("adapter failed"),
					undefined,
					"failure",
				]) {
					const { storage } = createAdapter();
					const method =
						operation === "get"
							? storage.getItem
							: operation === "set"
								? storage.setItem
								: storage.removeItem;
					method.mockImplementationOnce(() => {
						if (asynchronous) return Promise.reject(failure) as never;
						throw failure;
					});
					const store = new AsyncStoor({ storage });
					const failed = store[operation]("broken");
					const next = store.set("next", 2);
					await expect(failed).rejects.toBe(failure);
					await expect(next).resolves.toBe(store);
					await expect(store.get("next")).resolves.toBe(2);
					expect(
						method.mock.calls.filter(([key]) => key === ":broken"),
					).toHaveLength(1);
				}
			}
		},
	);

	test("does not swallow a serialization failure whose thrown value is undefined", async () => {
		const { storage } = createAdapter();
		const store = new AsyncStoor({ storage });
		const failed = store.set("broken", {
			toJSON() {
				throw undefined;
			},
		});
		const next = store.set("next", 2);
		await expect(failed).rejects.toBeUndefined();
		await expect(next).resolves.toBe(store);
		expect(storage.setItem.mock.calls.map(([key]) => key)).toEqual([":next"]);
	});

	test("recovers the queue after malformed JSON and invalid adapter results", async () => {
		const { storage } = createAdapter();
		storage.getItem
			.mockReturnValueOnce("not JSON")
			.mockReturnValueOnce(undefined as never);
		const store = new AsyncStoor({ storage });
		const malformed = store.get("malformed");
		const invalid = store.get("invalid");
		const later = store.set("later", true);
		await expect(malformed).rejects.toBeInstanceOf(SyntaxError);
		await expect(invalid).rejects.toBeInstanceOf(TypeError);
		await expect(later).resolves.toBe(store);
	});
});

describe("AsyncStoor batch errors and partial completion", () => {
	test.each(["get", "set", "remove"] as const)(
		"reports exact %s failure metadata, stops later entries, and recovers without retry or rollback",
		async (operation) => {
			for (const asynchronous of [false, true]) {
				for (const index of [0, 1]) {
					for (const cause of [new Error("backend rejected"), undefined]) {
						const { storage, data } = createAdapter();
						data.set("scope:first", envelope(1));
						data.set("scope:second", envelope(2));
						data.set("scope:third", envelope(3));
						const keys = ["first", "second", "third"];
						const failedKey = `scope:${keys[index]}`;
						const fail = () => {
							if (asynchronous) return Promise.reject(cause);
							throw cause;
						};
						if (operation === "get")
							storage.getItem.mockImplementation((key) =>
								key === failedKey ? (fail() as never) : (data.get(key) ?? null),
							);
						if (operation === "set")
							storage.setItem.mockImplementation((key, value) => {
								data.set(key, value);
								if (key === failedKey) return fail() as never;
							});
						if (operation === "remove")
							storage.removeItem.mockImplementation((key) => {
								data.delete(key);
								if (key === failedKey) return fail() as never;
							});
						const store = new AsyncStoor({ storage, namespace: "scope" });
						const failed =
							operation === "set"
								? store.set(keys.map((key) => [key, "updated"] as const))
								: store[operation](keys);
						const recovered = store.set("recovered", true);
						const error: unknown = await failed.catch(
							(error: unknown) => error,
						);
						expect(error).toBeInstanceOf(AsyncStoorBatchError);
						expect(error).toBeInstanceOf(Error);
						expect(error).toMatchObject({
							name: "AsyncStoorBatchError",
							operation,
							index,
							key: keys[index],
							completedCount: index,
						});
						expect((error as AsyncStoorBatchError).cause).toBe(cause);
						await expect(recovered).resolves.toBe(store);
						const method =
							operation === "get"
								? storage.getItem
								: operation === "set"
									? storage.setItem
									: storage.removeItem;
						expect(
							method.mock.calls
								.map(([key]) => key)
								.filter((key) => key !== "scope:recovered"),
						).toEqual(keys.slice(0, index + 1).map((key) => `scope:${key}`));
						expect(data.get("scope:third")).toBe(envelope(3));
						if (operation === "set") {
							expect(data.get(failedKey)).toBe(envelope("updated"));
							if (index === 1)
								expect(data.get("scope:first")).toBe(envelope("updated"));
							expect(storage.removeItem).not.toHaveBeenCalled();
						} else if (operation === "remove") {
							expect(data.has(failedKey)).toBe(false);
							if (index === 1) expect(data.has("scope:first")).toBe(false);
							expect(storage.setItem).toHaveBeenCalledTimes(1);
						} else {
							expect(storage.removeItem).not.toHaveBeenCalled();
						}
					}
				}
			}
		},
	);

	test("wraps a batch parse failure and does not read entries after it", async () => {
		const { storage, data } = createAdapter();
		data.set(":good", envelope(1));
		data.set(":broken", "not JSON");
		const store = new AsyncStoor({ storage });
		const error = await store
			.get(["good", "broken", "later"])
			.catch((error: unknown) => error);
		expect(error).toBeInstanceOf(AsyncStoorBatchError);
		expect(error).toMatchObject({
			operation: "get",
			index: 1,
			key: "broken",
			completedCount: 1,
		});
		expect((error as AsyncStoorBatchError).cause).toBeInstanceOf(SyntaxError);
		expect(storage.getItem.mock.calls).toEqual([[":good"], [":broken"]]);
		expect(storage.removeItem).not.toHaveBeenCalled();
	});

	test("reports duplicate-key failure by its position rather than unique-key count", async () => {
		const { storage } = createAdapter();
		const failure = new Error("second write failed");
		storage.setItem
			.mockImplementationOnce(() => {})
			.mockImplementationOnce(() => {
				throw failure;
			});
		const store = new AsyncStoor({ storage, namespace: "scope" });
		await expect(
			store.set([
				["same", 1],
				["same", 2],
				["later", 3],
			]),
		).rejects.toMatchObject({
			operation: "set",
			index: 1,
			key: "same",
			completedCount: 1,
			cause: failure,
		});
		expect(storage.setItem.mock.calls.map(([key]) => key)).toEqual([
			"scope:same",
			"scope:same",
		]);
	});
});

describe("AsyncStoor timeout semantics", () => {
	test.each([undefined, null, 0, -0])(
		"treats timeout %s as no expiration",
		async (timeout) => {
			const { storage, data } = createAdapter();
			const now = vi.spyOn(Date, "now").mockReturnValue(10000);
			const store = new AsyncStoor({ storage });
			await store.set("key", 1, timeout);
			expect(data.get(":key")).toBe(envelope(1));
			now.mockReturnValue(1000000);
			await expect(store.get("key")).resolves.toBe(1);
		},
	);

	test.each([NaN, Infinity, -Infinity, "100", false, {}, BigInt(1)])(
		"rejects non-finite or nonnumeric timeout %s before I/O",
		async (timeout) => {
			const { storage } = createAdapter();
			const store = new AsyncStoor({ storage });
			await expect(
				store.set("single", 1, timeout as number),
			).rejects.toBeInstanceOf(TypeError);
			await expect(
				store.set(
					[
						["first", 1],
						["later", 2],
					],
					undefined,
					timeout as number,
				),
			).rejects.toBeInstanceOf(TypeError);
			expectNoOperations(storage);
		},
	);

	test("rejects an overflowing deadline before adapter I/O", async () => {
		const { storage } = createAdapter();
		vi.spyOn(Date, "now").mockReturnValue(Number.MAX_VALUE);
		const store = new AsyncStoor({ storage });
		await expect(store.set("key", 1, Number.MAX_VALUE)).rejects.toBeInstanceOf(
			RangeError,
		);
		expectNoOperations(storage);
	});

	test.each([999, 1000, 1001])(
		"evaluates expiration at the exact deadline (%i ms elapsed) without deleting data",
		async (elapsed) => {
			const { storage, data } = createAdapter();
			const now = vi.spyOn(Date, "now").mockReturnValue(10000);
			const store = new AsyncStoor({ storage });
			await store.set("key", false, 1000);
			now.mockReturnValue(10000 + elapsed);
			await expect(store.get("key", "expired")).resolves.toBe(
				elapsed < 1000 ? false : "expired",
			);
			expect(data.get(":key")).toBe(envelope(false, 11000));
			expect(storage.removeItem).not.toHaveBeenCalled();
			expect(storage.setItem).toHaveBeenCalledTimes(1);
		},
	);

	test("accepts a finite negative timeout as already expired", async () => {
		const { storage, data } = createAdapter();
		vi.spyOn(Date, "now").mockReturnValue(10000);
		const store = new AsyncStoor({ storage });
		await store.set("key", 1, -1);
		expect(data.get(":key")).toBe(envelope(1, 9999));
		await expect(store.get("key")).resolves.toBeNull();
		expect(storage.removeItem).not.toHaveBeenCalled();
	});

	test("keeps the bulk timeout in the third argument and ignores the second value argument", async () => {
		const { storage, data } = createAdapter();
		vi.spyOn(Date, "now").mockReturnValue(10000);
		const store = new AsyncStoor({ storage });
		await store.set([["no-timeout", 1]], 500);
		await store.set([["timed", 2]], "ignored", 500);
		expect(data.get(":no-timeout")).toBe(envelope(1));
		expect(data.get(":timed")).toBe(envelope(2, 10500));
	});

	test("takes one invocation-time deadline for every payload in a queued batch", async () => {
		const { storage, data } = createAdapter();
		const now = vi.spyOn(Date, "now").mockReturnValue(10000);
		const gate = deferred<string | null>();
		const started = deferred<void>();
		storage.getItem.mockImplementationOnce(() => {
			started.resolve(undefined);
			return gate.promise as never;
		});
		const store = new AsyncStoor({ storage });
		const blocked = store.get("blocker");
		const writes = store.set(
			[
				[
					"first",
					{
						toJSON() {
							now.mockReturnValue(20000);
							return 1;
						},
					},
				],
				["second", 2],
			],
			undefined,
			1000,
		);
		expect(now).toHaveBeenCalledTimes(1);
		await started.promise;
		now.mockReturnValue(30000);
		gate.resolve(null);
		await blocked;
		await writes;
		expect(data.get(":first")).toBe(envelope(1, 11000));
		expect(data.get(":second")).toBe(envelope(2, 11000));
		await expect(store.get(["first", "second"])).resolves.toEqual([null, null]);
		expect(storage.removeItem).not.toHaveBeenCalled();
	});

	test("checks expiration when an asynchronous read response arrives", async () => {
		const { storage } = createAdapter();
		const now = vi.spyOn(Date, "now").mockReturnValue(10000);
		const response = deferred<string | null>();
		const started = deferred<void>();
		storage.getItem.mockImplementationOnce(() => {
			started.resolve(undefined);
			return response.promise as never;
		});
		const store = new AsyncStoor({ storage });
		const read = store.get("key", "expired");
		await started.promise;
		now.mockReturnValue(11000);
		response.resolve(envelope("formerly fresh", 11000));
		await expect(read).resolves.toBe("expired");
		expect(storage.removeItem).not.toHaveBeenCalled();
		expect(storage.setItem).not.toHaveBeenCalled();
	});
});

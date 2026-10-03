// @deno-types="../dist/index.d.ts"
import Stoor from "../dist/index.mjs";

/** @param {unknown} actual @param {unknown} expected @param {string} message */
function equal(actual, expected, message) {
	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
		throw new Error(
			`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`,
		);
	}
}

/** @param {unknown} value @param {string} message */
function assert(value, message) {
	if (!value) throw new Error(message);
}

assert(!("window" in globalThis), "Deno 2 has no window");
const local = new Stoor({ namespace: "local" });
const session = new Stoor({ namespace: "session", storage: "session" });
assert(
	local.storage === globalThis.localStorage,
	"default selects Deno localStorage",
);
assert(
	session.storage === globalThis.sessionStorage,
	"session selects Deno sessionStorage",
);

if (Deno.args[0] === "write") {
	globalThis.localStorage.setItem("localStorage", "existing data");
	new Stoor();
	equal(
		globalThis.localStorage.getItem("localStorage"),
		"existing data",
		"support probe preserves existing data",
	);
	assert(
		local.set("chain", 1).remove("chain") === local,
		"single-key chaining",
	);
	equal(
		local.set([
			["false", false],
			["zero", 0],
			["empty", ""],
		]),
		[undefined, undefined, undefined],
		"multi-set return shape",
	);
	equal(
		local.get(["empty", "missing", "zero", "false", "false"]),
		["", null, 0, false, false],
		"multi-get order and falsy values",
	);
	equal(
		local.remove(["zero", "empty"]),
		[undefined, undefined],
		"multi-remove return shape",
	);
	equal(
		local.get(["zero", "empty"], "missing"),
		["missing", "missing"],
		"removed defaults",
	);
	const other = new Stoor({ namespace: "other" });
	other.set("false", "other namespace");
	equal(local.get("false"), false, "namespace isolation");
	equal(other.get("false"), "other namespace", "other namespace preserved");
	globalThis.localStorage.setItem("local:malformed", "not JSON");
	equal(local.get("malformed", 0), 0, "malformed default");
	const now = Date.now;
	try {
		Date.now = () => 10000;
		local.set("expires", "live", 1000);
		local.set("forever", 0, 0);
		local.set("negative", 1, -1);
		equal(local.get("negative", "expired"), "expired", "negative timeout");
		Date.now = () => 10999;
		equal(local.get("expires"), "live", "before deadline");
		Date.now = () => 11000;
		equal(
			local.get(["expires", "forever"], "expired"),
			["expired", 0],
			"at deadline and zero timeout",
		);
	} finally {
		Date.now = now;
	}
	local.clear();
	equal(other.get("false"), null, "clear remains storage-wide");
	const custom = new Stoor({
		storage: globalThis.sessionStorage,
		fallback: globalThis.localStorage,
		namespace: "custom",
	});
	assert(
		custom.storage === globalThis.sessionStorage,
		"custom adapter takes precedence",
	);
	custom.set("key", "custom session");
	equal(
		globalThis.localStorage.getItem("custom:key"),
		null,
		"custom adapter isolation",
	);
	local.set("persist", "local value");
	session.set("persist", "session value");
	equal(
		globalThis.sessionStorage.getItem("local:persist"),
		null,
		"local/session isolation",
	);
	console.log("Deno storage operations and first-process writes passed");
} else if (Deno.args[0] === "read") {
	equal(
		local.get("persist"),
		"local value",
		"localStorage persists between processes",
	);
	equal(
		session.get("persist"),
		null,
		"sessionStorage does not persist between processes",
	);
	local.clear();
	session.clear();
	console.log("Deno second-process local/session persistence passed");
} else {
	throw new Error("Expected write or read phase");
}

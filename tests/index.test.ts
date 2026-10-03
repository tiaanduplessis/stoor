import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import Stoor from "../src";
import { inMemory } from "../src/in-memory";
import { StorageLike } from "../src/types";

beforeEach(() => {
	window.sessionStorage.clear();
	window.localStorage.clear();
	inMemory.clear();
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("Stoor", () => {
	test("creates an instance and uses local storage by default", () => {
		const store = new Stoor();
		expect(store).toBeInstanceOf(Stoor);
		expect(store.storage).toBe(window.localStorage);
	});

	test.each([{}, "hello", 5, false, 0, "", [1, 2]])(
		"round-trips JSON and falsy values: %j",
		(value) => {
			const store = new Stoor();
			expect(store.set("value", value)).toBe(store);
			expect(store.get("value", "fallback")).toEqual(value);
		},
	);

	test("preserves single-key set/remove chaining", () => {
		const store = new Stoor();
		expect(store.set("a", 1).set("b", 2).remove("a")).toBe(store);
		expect(store.get("a")).toBeNull();
		expect(store.get("b")).toBe(2);
	});

	test.each([null, undefined])(
		"uses the default for nullish values: %j",
		(value) => {
			const store = new Stoor();
			store.set("value", value);
			expect(store.get("value", "fallback")).toBe("fallback");
		},
	);

	test("uses the default for missing, malformed, and unreadable entries", () => {
		const store = new Stoor();
		expect(store.get("missing")).toBeNull();
		expect(store.get("missing", false)).toBe(false);
		window.localStorage.setItem(":malformed", "not JSON");
		expect(store.get("malformed", 0)).toBe(0);
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("denied");
		});
		expect(store.get("unreadable", "fallback")).toBe("fallback");
	});

	test.each([undefined, "", 1, null, {}])(
		"rejects an invalid get key: %j",
		(key) => {
			expect(() => new Stoor().get(key as string)).toThrow(
				"Invalid key provided",
			);
		},
	);

	test("multi-get returns values and defaults in requested order", () => {
		const store = new Stoor();
		store.set("foo", 1).set("bar", 2);
		expect(store.get(["bar", "missing", "foo", "foo"])).toEqual([
			2,
			null,
			1,
			1,
		]);
		expect(store.get(["missing", "foo"], false)).toEqual([false, 1]);
		expect(store.get([])).toEqual([]);
	});

	test.each([
		["foo", ""],
		["foo", null],
		["foo", 1],
	])("rejects invalid keys inside multi-get: %j", (...keys) => {
		expect(() => new Stoor().get(keys as string[])).toThrow(
			"Invalid key provided",
		);
	});

	test("forwards the existing custom adapter multi-remove results", () => {
		const store = new Stoor({ storage: inMemory });
		store.set("present", 1);
		expect(store.remove(["present", "missing"])).toEqual([true, undefined]);
	});

	test("multi-set accepts the documented key/value tuples", () => {
		const store = new Stoor();
		store.set([
			["bar", 5],
			["foo", 6],
			["falsy", false],
		]);
		expect(store.get(["foo", "bar", "falsy"])).toEqual([6, 5, false]);
	});

	test("multi-remove removes only the named values and preserves its return shape", () => {
		const store = new Stoor();
		store.set([
			["foo", 1],
			["bar", 2],
			["baz", 3],
		]);
		expect(store.remove(["foo", "bar"])).toEqual([undefined, undefined]);
		expect(store.get(["foo", "bar", "baz"])).toEqual([null, null, 3]);
	});

	test("preserves the multi-set return shape", () => {
		expect(
			new Stoor().set([
				["foo", 1],
				["bar", 2],
			]),
		).toEqual([undefined, undefined]);
	});

	test("keeps namespace reads, writes, and removals isolated", () => {
		const things = new Stoor({ namespace: "things" });
		const other = new Stoor({ namespace: "other" });
		things.set([
			["foo", 1],
			["bar", 2],
		]);
		other.set([
			["foo", 3],
			["bar", 4],
		]);
		things.remove(["foo", "bar"]);
		expect(things.get(["foo", "bar"])).toEqual([null, null]);
		expect(other.get(["foo", "bar"])).toEqual([3, 4]);
	});

	test("clear retains the underlying storage-wide behavior", () => {
		const store = new Stoor({ namespace: "one" });
		const other = new Stoor({ namespace: "two" });
		store.set("a", 1);
		other.set("b", 2);
		store.clear();
		expect(store.get("a")).toBeNull();
		expect(other.get("b")).toBeNull();
	});

	test("uses session storage when requested", () => {
		const store = new Stoor({ storage: "session" });
		store.set("foo", 1);
		expect(store.storage).toBe(window.sessionStorage);
		expect(window.localStorage.getItem(":foo")).toBeNull();
	});

	test("uses a synchronous custom storage adapter", () => {
		const store = new Stoor({ storage: inMemory });
		store.set("foo", 1);
		expect(store.storage).toBe(inMemory);
		expect(store.get("foo")).toBe(1);
	});

	test.each(["localStorage", "sessionStorage"] as const)(
		"falls back when the %s getter is denied",
		(storageName) => {
			vi.spyOn(window, storageName, "get").mockImplementation(() => {
				throw new DOMException("denied", "SecurityError");
			});
			const store = new Stoor({
				storage: storageName === "sessionStorage" ? "session" : "local",
			});
			expect(store.storage).toBe(inMemory);
			expect(store.set("key", 1).get("key")).toBe(1);
		},
	);

	test("uses the provided fallback when storage is not writable", () => {
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new DOMException("full", "QuotaExceededError");
		});
		const store = new Stoor({ fallback: inMemory });
		expect(store.storage).toBe(inMemory);
		expect(store.set("key", 1).get("key")).toBe(1);
	});

	test("uses the fallback in a no-window environment", () => {
		vi.stubGlobal("window", undefined);
		const store = new Stoor({ fallback: inMemory });
		expect(store.storage).toBe(inMemory);
		expect(store.set("key", 1).get("key")).toBe(1);
	});

	test.each([null, {}, 1])(
		"rejects invalid fallback adapters: %j",
		(fallback) => {
			expect(() => new Stoor({ fallback: fallback as StorageLike })).toThrow(
				"Invalid fallback provided",
			);
		},
	);
});

describe("expiration", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(10000);
	});

	test.each([0, 999])(
		"reads a value before its deadline (%i ms elapsed)",
		(elapsed) => {
			const store = new Stoor();
			store.set("key", 1, 1000);
			vi.advanceTimersByTime(elapsed);
			expect(store.get("key", "expired")).toBe(1);
		},
	);

	test.each([1000, 1001, 100000])(
		"returns the default at/after the deadline (%i ms elapsed)",
		(elapsed) => {
			const store = new Stoor();
			store.set("key", 1, 1000);
			vi.advanceTimersByTime(elapsed);
			expect(store.get("key")).toBeNull();
			expect(store.get("key", false)).toBe(false);
			expect(store.get("key", 0)).toBe(0);
			expect(store.get("key", "")).toBe("");
		},
	);

	test.each([0, null, undefined])(
		"keeps the existing no-expiry policy for %j",
		(timeout) => {
			const store = new Stoor();
			store.set("key", 1, timeout);
			vi.advanceTimersByTime(1000000000);
			expect(store.get("key")).toBe(1);
		},
	);

	test("handles negative timeouts as already expired", () => {
		const store = new Stoor();
		store.set("key", 1, -1);
		expect(store.get("key", "expired")).toBe("expired");
	});

	test.each([null, 2000])(
		"overwriting an expired key renews or removes its deadline: %j",
		(timeout) => {
			const store = new Stoor();
			store.set("key", "old", 1000);
			vi.advanceTimersByTime(1000);
			expect(store.get("key")).toBeNull();
			store.set("key", "new", timeout);
			expect(store.get("key")).toBe("new");
			vi.advanceTimersByTime(2000);
			expect(store.get("key")).toBe(timeout === null ? "new" : null);
		},
	);

	test("returns live and expired multi-get values with per-key defaults", () => {
		const store = new Stoor();
		store.set("live", false, 2000).set("expired", 1, 1000);
		store.set(
			[
				["a", 2],
				["b", 3],
			],
			undefined,
			1000,
		);
		expect(store.get(["a", "b"])).toEqual([2, 3]);
		vi.advanceTimersByTime(1000);
		expect(
			store.get(["expired", "live", "missing", "a", "b"], "fallback"),
		).toEqual(["fallback", false, "fallback", "fallback", "fallback"]);
	});
});

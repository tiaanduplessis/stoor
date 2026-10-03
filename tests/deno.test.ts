import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import Stoor from "../src";
import { inMemory } from "../src/in-memory";

const localStorage = window.localStorage;
const sessionStorage = window.sessionStorage;

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
	inMemory.clear();
	vi.stubGlobal("window", undefined);
	vi.stubGlobal("Deno", { version: { deno: "2" } });
	vi.stubGlobal("localStorage", localStorage);
	vi.stubGlobal("sessionStorage", sessionStorage);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("Deno Web Storage without window", () => {
	test("selects global local storage by default", () => {
		const store = new Stoor();
		expect(store.storage).toBe(localStorage);
		expect(store.set("key", false).get("key")).toBe(false);
		expect(localStorage.getItem(":key")).not.toBeNull();
		expect(sessionStorage.getItem(":key")).toBeNull();
	});

	test("selects global session storage when requested", () => {
		const store = new Stoor({ storage: "session" });
		expect(store.storage).toBe(sessionStorage);
		store.set("key", 0);
		expect(store.get("key")).toBe(0);
		expect(localStorage.getItem(":key")).toBeNull();
	});

	test("prefers a custom adapter over the global storage", () => {
		const store = new Stoor({ storage: inMemory, fallback: sessionStorage });
		expect(store.storage).toBe(inMemory);
		expect(store.set("key", "value").get("key")).toBe("value");
		expect(localStorage.getItem(":key")).toBeNull();
		expect(sessionStorage.getItem(":key")).toBeNull();
	});

	test.each(["localStorage", "sessionStorage"] as const)(
		"falls back if the global %s getter throws",
		(name) => {
			Object.defineProperty(globalThis, name, {
				configurable: true,
				get() {
					throw new DOMException("denied", "SecurityError");
				},
			});
			const store = new Stoor({
				storage: name === "sessionStorage" ? "session" : "local",
			});
			expect(store.storage).toBe(inMemory);
			expect(store.set("key", 1).get("key")).toBe(1);
		},
	);

	test("a custom adapter does not access denied global storage", () => {
		const getter = vi.fn(() => {
			throw new DOMException("denied", "SecurityError");
		});
		Object.defineProperty(globalThis, "localStorage", {
			configurable: true,
			get: getter,
		});
		const store = new Stoor({ storage: inMemory, fallback: sessionStorage });
		expect(store.storage).toBe(inMemory);
		expect(getter).not.toHaveBeenCalled();
	});

	test.each(["localStorage", "sessionStorage"] as const)(
		"falls back when global %s is unavailable",
		(name) => {
			vi.stubGlobal(name, undefined);
			const store = new Stoor({
				storage: name === "sessionStorage" ? "session" : "local",
			});
			expect(store.storage).toBe(inMemory);
		},
	);

	test("uses the explicit fallback when global storage is not writable", () => {
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new DOMException("full", "QuotaExceededError");
		});
		expect(new Stoor({ fallback: inMemory }).storage).toBe(inMemory);
	});

	test("keeps existing data safe during the support probe", () => {
		vi.spyOn(Math, "random").mockReturnValue(0.5);
		const key = `__stoor_support__${Math.random().toString(36).slice(2)}`;
		localStorage.setItem(key, "existing");
		expect(new Stoor().storage).toBe(inMemory);
		expect(localStorage.getItem(key)).toBe("existing");
	});

	test("retains the no-window fallback outside Deno even with global storage", () => {
		vi.stubGlobal("Deno", undefined);
		const store = new Stoor({ storage: localStorage, fallback: inMemory });
		expect(store.storage).toBe(inMemory);
		expect(store.set("key", 1).get("key")).toBe(1);
		expect(localStorage.getItem(":key")).toBeNull();
	});
});

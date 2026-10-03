import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { isSupported } from "../src/is-supported";
import { StorageLike } from "../src/types";

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("isSupported", () => {
	test("accepts writable local and session storage", () => {
		expect(isSupported(window.sessionStorage)).toBe(true);
		expect(isSupported(window.localStorage)).toBe(true);
		expect(window.localStorage.length).toBe(0);
	});

	test.each([{}, null, undefined, 1])(
		"rejects invalid storage: %j",
		(storage) => {
			expect(isSupported(storage as StorageLike)).toBe(false);
		},
	);

	test("preserves existing user data named localStorage", () => {
		window.localStorage.setItem("localStorage", "important data");
		expect(isSupported(window.localStorage)).toBe(true);
		expect(window.localStorage.getItem("localStorage")).toBe("important data");
		expect(window.localStorage.length).toBe(1);
	});

	test("does not overwrite a colliding support-test key", () => {
		vi.spyOn(Math, "random").mockReturnValue(0.5);
		const key = `__stoor_support__${Math.random().toString(36).slice(2)}`;
		window.localStorage.setItem(key, "important data");
		expect(isSupported(window.localStorage)).toBe(false);
		expect(window.localStorage.getItem(key)).toBe("important data");
	});

	test.each(["getItem", "setItem", "removeItem"] as const)(
		"handles a failing %s",
		(method) => {
			vi.spyOn(Storage.prototype, method).mockImplementation(() => {
				throw new Error("denied");
			});
			expect(isSupported(window.localStorage)).toBe(false);
		},
	);
});

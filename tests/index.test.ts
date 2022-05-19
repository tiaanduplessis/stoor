import { test, expect, describe, beforeAll, vi } from "vitest";
import Stoor from "../src";

beforeAll(() => {
	window.sessionStorage.clear();
	window.localStorage.clear();
});

describe("Stoor", () => {
	test("should have export", () => {
		expect(Stoor).toBeDefined();
	});

	test("should create new instance", () => {
		expect(new Stoor()).toBeInstanceOf(Stoor);
	});

	test("should set/get value", () => {
		const store = new Stoor();
		expect(store.set("foo", {})).toBeTruthy();
		expect(store.set("bar", "hello")).toBeTruthy();
		expect(store.set("baz", 5)).toBeTruthy();
		expect(store.get("foo")).toMatchObject({});
		expect(store.get("bar")).toBe("hello");
		expect(store.get("baz")).toBe(5);
	});

	test("should remove value", () => {
		const store = new Stoor();
		store.set("foo", 1);
		expect(store.get("foo")).toBe(1);
		expect(store.remove("foo")).toBeTruthy();
		expect(store.get("foo")).toBeNull();
	});

	test("should access provided storage adaptor", () => {
		const spySet = vi.spyOn(Storage.prototype, "setItem");
		const spyGet = vi.spyOn(Storage.prototype, "getItem");

		const store = new Stoor();
		store.set("foo", 1);
		store.get("foo");

		expect(spySet).toHaveBeenCalled();
		expect(spyGet).toHaveBeenCalled();
	});

	test("should throw if no key given", () => {
		const foo = new Stoor();
		expect(() => foo.get()).toThrow();
	});


  
	test("should expire if timeout occurs", () => {
		const now = Date.now();
		const timeout = 1000;
		const store = new Stoor();

		const spy = vi.spyOn(Date, "now").mockReturnValue(now);
		store.set("key", 1, timeout);
		spy.mockImplementation(() => now - timeout);
		expect(store.get("key")).toBeUndefined();
	});

  test("should not get if timeout has not occured", () => {
		const now = Date.now();
		const timeout = 1000;
		const store = new Stoor();

		const spy = vi.spyOn(Date, "now").mockReturnValue(now);
		store.set("key", 1, timeout);
		spy.mockImplementation(() => now + 100000);
		expect(store.get("key")).toBe(1);
	});
});

import { test, expect, describe } from "vitest";
import { isSupported } from "../src/is-supported";

describe("isSupported", () => {
	test("isSupported checks is storage is supported", () => {
		expect(isSupported(window.sessionStorage));
		expect(isSupported(window.localStorage));
		expect(isSupported({})).toBeFalsy();
	});
});

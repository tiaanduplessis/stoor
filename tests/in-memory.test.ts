import { beforeEach, expect, test } from "vitest";
import { inMemory } from "../src/in-memory";
beforeEach(() => inMemory.clear());
test("the fallback implements synchronous Storage string semantics", () => {
	expect(inMemory.getItem("missing")).toBeNull();
	inMemory.setItem("empty", "");
	expect(inMemory.getItem("empty")).toBe("");
	inMemory.setItem("__proto__", "safe");
	expect(inMemory.getItem("__proto__")).toBe("safe");
	expect(inMemory.getItem("toString")).toBeNull();
	inMemory.removeItem("empty");
	expect(inMemory.getItem("empty")).toBeNull();
	inMemory.clear();
	expect(inMemory.getItem("__proto__")).toBeNull();
});

test("the fallback coerces keys and values like browser Storage", () => {
	inMemory.setItem(1 as unknown as string, 5 as unknown as string);
	expect(inMemory.getItem("1")).toBe("5");
	expect(inMemory.getItem(1 as unknown as string)).toBe("5");
	inMemory.removeItem(1 as unknown as string);
	expect(inMemory.getItem("1")).toBeNull();
});

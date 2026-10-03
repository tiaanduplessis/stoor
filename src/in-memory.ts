import { StorageLike } from "./types";

let storage: Record<string, string> = Object.create(null);

export const inMemory: StorageLike = {
	getItem(key: string) {
		return storage[String(key)] ?? null;
	},

	setItem(key: string, value: string) {
		storage[String(key)] = String(value);
	},

	removeItem(key: string) {
		if (String(key) in storage) {
			return delete storage[String(key)];
		}
	},

	clear() {
		storage = Object.create(null);
	},
};

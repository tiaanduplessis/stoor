import { StorageLike } from "./types";

let storage: StorageLike = {};

export const inMemory: StorageLike = {
	getItem(key: string) {
		return storage[key] || null;
	},

	setItem(key: string, value: string) {
		storage[key] = value;
	},

	removeItem(key: string) {
		if (key in storage) {
			return delete storage[key];
		}
	},
	clear() {
		storage = {};
	},
};

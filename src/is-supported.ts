import { StorageLike } from "./types";

export const isSupported = (storageType: StorageLike) => {
	if (typeof storageType === "object" && storageType !== null) {
		try {
			const key = `__stoor_support__${Math.random().toString(36).slice(2)}`;
			// A collision must never overwrite an existing value.
			if (storageType.getItem(key) !== null) return false;
			storageType.setItem(key, key);
			storageType.removeItem(key);
			return true;
		} catch {
			return false;
		}
	}

	return false;
};

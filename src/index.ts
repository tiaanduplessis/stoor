import { inMemory } from "./in-memory";
import { isStorage } from "./is-storage";
import { isSupported } from "./is-supported";
import { StorageLike } from "./types";

class Stoor {
	namespace: string;
	storage: StorageLike;

	constructor({ namespace = "", fallback = inMemory, storage = "local" } = {}) {
		if (!(this instanceof Stoor)) {
			return new Stoor({ namespace, fallback, storage });
		}

		if (!isStorage(fallback)) {
			throw new Error("Invalid fallback provided");
		}

		if (typeof window === "undefined") {
			this.storage = fallback;
		} else {
			const activeStorage = isStorage(storage)
				? storage
				: storage === "session"
				? window.sessionStorage
				: window.localStorage;
			this.storage = (
				isSupported(activeStorage) ? activeStorage : fallback
			) as StorageLike;
		}
		this.namespace = namespace;
	}

	private getValue = (key: string, def?: any) => {
		try {
			const value = JSON.parse(this.storage.getItem(key));
			return value ?? def;
		} catch {
			return this.storage.getItem(key) || def;
		}
	};

	get(key: string = "", def: any = null) {
		if (typeof key !== "string" || !key.length) {
			throw new Error("Invalid key provided");
		}

		if (Array.isArray(key)) {
			return key.map((currentKey) => {
				const namespacedKey = `${this.namespace}:${currentKey}`;
				return this.getValue(namespacedKey, def);
			});
		}

		const namespacedKey = `${this.namespace}:${key}`;
		return this.getValue(namespacedKey, def);
	}

	set(key: string | string[], value?: any) {
		if (typeof key !== "string" && !Array.isArray(key)) {
			throw new Error("Invalid key provided");
		}

		if (Array.isArray(key)) {
			return key.map((pair) => {
				const [key, value] = pair;
				const namespacedKey = `${this.namespace}:${key}`;
				this.storage.setItem(namespacedKey, JSON.stringify(value));
			});
		} else {
			const namespacedKey = `${this.namespace}:${key}`;
			this.storage.setItem(namespacedKey, JSON.stringify(value));
		}

		return this;
	}

	remove(key: string | string[]) {
		if (Array.isArray(key)) {
			return key.map((currentKey) => {
				const namespacedKey = `${this.namespace}:${currentKey}`;
				return this.storage.removeItem(namespacedKey);
			});
		} else {
			const namespacedKey = `${this.namespace}:${key}`;
			this.storage.removeItem(namespacedKey);
		}

		return this;
	}

	clear() {
		return this.storage.clear();
	}
}

export default Stoor;

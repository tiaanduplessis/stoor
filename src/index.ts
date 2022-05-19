import { inMemory } from "./in-memory";
import { isStorage } from "./is-storage";
import { isSupported } from "./is-supported";
import { StorageLike } from "./types";

export interface StorageConfig {
	storage?: string | StorageLike;
	fallback?: StorageLike;
	namespace?: string;
}

class Stoor {
	namespace: string;
	storage: StorageLike;

	constructor({
		namespace = "",
		fallback = inMemory,
		storage = "local",
	}: StorageConfig = {}) {
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
			const result = JSON.parse(this.storage.getItem(key));
			const { value, timeout } = result;
			if (timeout !== null) {
				return timeout < Date.now() ? value ?? def : undefined;
			}
			return value ?? def;
		} catch {
			return def;
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

	private setValue = (
		key: string,
		value: any,
		timeout: number | null = null
	) => {
		const entry = {
			value,
			timeout: timeout ? Date.now() + timeout : null,
		};
		this.storage.setItem(key, JSON.stringify(entry));
	};

	set(key: string | string[], value?: any, timeout: number | null = null) {
		if (typeof key !== "string" && !Array.isArray(key)) {
			throw new Error("Invalid key provided");
		}

		if (Array.isArray(key)) {
			return key.map((pair) => {
				const [key, value] = pair;
				const namespacedKey = `${this.namespace}:${key}`;
				this.setValue(namespacedKey, value, timeout);
			});
		} else {
			const namespacedKey = `${this.namespace}:${key}`;
			this.setValue(namespacedKey, value, timeout);
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

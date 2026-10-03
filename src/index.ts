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

		this.storage = fallback;
		if (typeof window !== "undefined") {
			try {
				const activeStorage = isStorage(storage)
					? storage
					: storage === "session"
						? window.sessionStorage
						: window.localStorage;
				this.storage = (
					isSupported(activeStorage) ? activeStorage : fallback
				) as StorageLike;
			} catch {
				// Accessing browser storage itself can throw a SecurityError.
				this.storage = fallback;
			}
		}
		this.namespace = namespace;
	}

	private getValue = (key: string, def?: any) => {
		try {
			const stored = this.storage.getItem(key);
			if (stored === null) return def;
			const result = JSON.parse(stored);
			const { value, timeout } = result;
			if (timeout !== null) {
				return timeout > Date.now() ? (value ?? def) : def;
			}
			return value ?? def;
		} catch {
			return def;
		}
	};

	get(key: string[], def?: any): any[];
	get(key?: string, def?: any): any;
	get(key: string | string[], def?: any): any;
	get(key: string | string[] = "", def: any = null): any {
		if (Array.isArray(key)) {
			return key.map((currentKey) => this.get(currentKey, def));
		}

		if (typeof key !== "string" || !key.length) {
			throw new Error("Invalid key provided");
		}

		const namespacedKey = `${this.namespace}:${key}`;
		return this.getValue(namespacedKey, def);
	}

	private setValue = (
		key: string,
		value: any,
		timeout: number | null = null,
	) => {
		const entry = {
			value,
			timeout: timeout ? Date.now() + timeout : null,
		};
		this.storage.setItem(key, JSON.stringify(entry));
	};

	set(key: string, value?: any, timeout?: number | null): this;
	set(key: [string, any][], value?: any, timeout?: number | null): void[];
	set(
		key: string | [string, any][],
		value?: any,
		timeout?: number | null,
	): this | void[];
	set(
		key: string | [string, any][],
		value?: any,
		timeout: number | null = null,
	) {
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

	remove(key: string): this;
	remove(key: string[]): void[];
	remove(key: string | string[]): this | void[];
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

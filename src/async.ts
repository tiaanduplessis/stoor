export interface AsyncStorageAdapter {
	getItem(key: string): string | null | PromiseLike<string | null>;
	setItem(key: string, value: string): void | PromiseLike<void>;
	removeItem(key: string): void | PromiseLike<void>;
}

export interface AsyncStorageConfig {
	storage: AsyncStorageAdapter;
	namespace?: string;
}

export class AsyncStoorBatchError extends Error {
	readonly name = "AsyncStoorBatchError";

	constructor(
		readonly operation: "get" | "set" | "remove",
		readonly index: number,
		readonly key: string,
		readonly completedCount: number,
		readonly cause: unknown,
	) {
		super(`AsyncStoor ${operation} failed at batch index ${index}`);
	}
}

type Entry = readonly [string, unknown];

class AsyncStoor {
	readonly namespace: string;
	private readonly storage: AsyncStorageAdapter;
	private tail: Promise<void> = Promise.resolve();

	constructor({ storage, namespace = "" }: AsyncStorageConfig) {
		if (
			typeof storage !== "object" ||
			storage === null ||
			typeof storage.getItem !== "function" ||
			typeof storage.setItem !== "function" ||
			typeof storage.removeItem !== "function"
		) {
			throw new TypeError("Invalid storage adapter provided");
		}
		if (typeof namespace !== "string" || namespace.includes(":")) {
			throw new TypeError("Namespace must be a string without colons");
		}
		this.storage = storage;
		this.namespace = namespace;
	}

	private enqueue<Input, Output>(
		prepare: () => Input,
		execute: (input: Input) => Output | PromiseLike<Output>,
	): Promise<Output> {
		let input: Input;
		let failed = false;
		let failure: unknown;
		// Reserve the slot before preparation: getters/toJSON may re-enter us.
		const result = this.tail.then(() => {
			if (failed) throw failure;
			return execute(input);
		});
		this.tail = result.then(
			() => undefined,
			() => undefined,
		);
		try {
			input = prepare();
		} catch (error) {
			failed = true;
			failure = error;
		}
		return result;
	}

	private validateKey(key: string): string {
		if (typeof key !== "string" || key.length === 0) {
			throw new TypeError("Invalid key provided");
		}
		return key;
	}

	private namespacedKey(key: string): string {
		return `${this.namespace}:${key}`;
	}

	private snapshotKeys(key: string | readonly string[]): string[] {
		if (typeof key === "string") return [this.validateKey(key)];
		if (!Array.isArray(key)) throw new TypeError("Invalid key provided");
		return Array.from(key, (item) => this.validateKey(item));
	}

	private async read(key: string, def: unknown): Promise<unknown> {
		const stored = await this.storage.getItem(this.namespacedKey(key));
		if (stored === null) return def;
		if (typeof stored !== "string") {
			throw new TypeError("Storage adapter must return a string or null");
		}
		const entry: unknown = JSON.parse(stored);
		if (
			typeof entry !== "object" ||
			entry === null ||
			Array.isArray(entry) ||
			!("timeout" in entry) ||
			!Object.prototype.hasOwnProperty.call(entry, "timeout") ||
			(entry.timeout !== null &&
				(typeof entry.timeout !== "number" || !Number.isFinite(entry.timeout)))
		) {
			throw new TypeError("Invalid stored entry");
		}
		if (entry.timeout !== null && entry.timeout <= Date.now()) return def;
		return "value" in entry &&
			Object.prototype.hasOwnProperty.call(entry, "value")
			? (entry.value ?? def)
			: def;
	}

	private async batch<Result>(
		operation: "get" | "set" | "remove",
		keys: readonly string[],
		apply: (key: string, index: number) => Promise<Result>,
	): Promise<Result[]> {
		const results: Result[] = [];
		for (let index = 0; index < keys.length; index++) {
			try {
				results.push(await apply(keys[index], index));
			} catch (cause) {
				throw new AsyncStoorBatchError(
					operation,
					index,
					keys[index],
					results.length,
					cause,
				);
			}
		}
		return results;
	}

	get(key: readonly string[], def?: unknown): Promise<unknown[]>;
	get(key: string, def?: unknown): Promise<unknown>;
	get(key: string | readonly string[], def?: unknown): Promise<unknown>;
	get(key: string | readonly string[], def: unknown = null): Promise<unknown> {
		return this.enqueue(
			() => ({
				multiple: Array.isArray(key),
				keys: this.snapshotKeys(key),
			}),
			({ multiple, keys }) =>
				multiple
					? this.batch("get", keys, (item) => this.read(item, def))
					: this.read(keys[0], def),
		);
	}

	set(key: string, value?: unknown, timeout?: number | null): Promise<this>;
	set(
		key: readonly Entry[],
		value?: unknown,
		timeout?: number | null,
	): Promise<void[]>;
	set(
		key: string | readonly Entry[],
		value?: unknown,
		timeout?: number | null,
	): Promise<this | void[]>;
	set(
		key: string | readonly Entry[],
		value?: unknown,
		timeout: number | null = null,
	): Promise<this | void[]> {
		return this.enqueue(
			() => {
				const now = Date.now();
				if (timeout !== null && !Number.isFinite(timeout)) {
					throw new TypeError("Timeout must be a finite number or null");
				}
				const deadline = timeout ? now + timeout : null;
				if (deadline !== null && !Number.isFinite(deadline)) {
					throw new RangeError("Timeout deadline must be finite");
				}
				const multiple = Array.isArray(key);
				const entries: Entry[] = multiple
					? Array.from(key, (pair) => {
							if (
								!Array.isArray(pair) ||
								pair.length !== 2 ||
								!Object.prototype.hasOwnProperty.call(pair, 0) ||
								!Object.prototype.hasOwnProperty.call(pair, 1)
							) {
								throw new TypeError("Expected a key/value pair");
							}
							return [this.validateKey(pair[0]), pair[1]];
						})
					: [[this.validateKey(key as string), value]];
				const serialized = entries.map(([key, value]) => {
					const stored = JSON.stringify({ value, timeout: deadline });
					if (typeof stored !== "string") {
						throw new TypeError("Value could not be serialized");
					}
					return [key, stored] as const;
				});
				return { multiple, serialized };
			},
			async ({ multiple, serialized }) => {
				const write = async (key: string, index: number) => {
					await this.storage.setItem(
						this.namespacedKey(key),
						serialized[index][1],
					);
				};
				if (multiple) {
					return this.batch(
						"set",
						serialized.map(([key]) => key),
						write,
					);
				}
				await write(serialized[0][0], 0);
				return this;
			},
		);
	}

	remove(key: string): Promise<this>;
	remove(key: readonly string[]): Promise<void[]>;
	remove(key: string | readonly string[]): Promise<this | void[]>;
	remove(key: string | readonly string[]): Promise<this | void[]> {
		return this.enqueue(
			() => ({
				multiple: Array.isArray(key),
				keys: this.snapshotKeys(key),
			}),
			async ({ multiple, keys }) => {
				const remove = async (item: string) => {
					await this.storage.removeItem(this.namespacedKey(item));
				};
				if (multiple) return this.batch("remove", keys, remove);
				await remove(keys[0]);
				return this;
			},
		);
	}
}

export default AsyncStoor;

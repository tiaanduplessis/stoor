/* eslint-disable no-dupe-class-members */
/* eslint-disable no-useless-constructor */

declare module "stoor" {
	interface StoorOptions {
		namespace?: string;
		storage?: "local" | "session";
		fallback?: any extends Storage ? Storage : any;
	}

	class Stoor {
		public constructor(options: StoorOptions): Stoor;
		public get<R = any>(key: string): R;
		public get<R = any>(keys: string[]): R;

		public set<R = any>(key: string, value: R): R;
		public set<R = any>(keys: string[], values: R[]): R[];

		public remove(key: string): void;
		public remove(keys: string[]): void;

		public clear(): void;
	}

	export default Stoor;
}

import { StorageLike } from "./types";

export const isStorage = (storage: any): storage is StorageLike => {
	return (
		typeof storage === "object" &&
		typeof storage.getItem === "function" &&
		typeof storage.setItem === "function" &&
		typeof storage.removeItem === "function" &&
		typeof storage.clear === "function"
	);
};

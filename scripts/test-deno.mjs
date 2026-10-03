import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const deno = process.env.DENO_BIN || "deno";
const fixture = mkdtempSync(join(tmpdir(), "stoor-deno-"));
const testFile = fileURLToPath(
	new URL("../tests/deno.integration.mjs", import.meta.url),
);
const options = {
	cwd: fixture,
	stdio: "inherit",
	env: {
		...process.env,
		DENO_DIR: join(fixture, "cache"),
		DENO_NO_PACKAGE_JSON: "1",
		DENO_NO_UPDATE_CHECK: "1",
		XDG_DATA_HOME: join(fixture, "data"),
	},
};
const flags = ["--no-config", "--no-lock", "--no-npm", "--cached-only"];

try {
	execFileSync(deno, ["check", "--check-js", ...flags, testFile], options);
	for (const phase of ["write", "read"]) {
		execFileSync(
			deno,
			[
				"run",
				...flags,
				"--deny-net",
				"--location=https://stoor.test",
				testFile,
				phase,
			],
			options,
		);
	}
} finally {
	rmSync(fixture, { recursive: true, force: true });
}

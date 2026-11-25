import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { apiDrift, convexModules, generatedModules } from "./check-convex-api.mjs";

const dirs = [];
const fixture = (files) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "convex-api-"));
	dirs.push(dir);
	for (const [name, contents] of Object.entries(files)) {
		fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
		fs.writeFileSync(path.join(dir, name), contents);
	}
	return dir;
};
const apiDts = (modules) =>
	`declare const fullApi: ApiFromModules<{\n${modules
		.map((m) => `  ${m.includes("/") ? `"${m}"` : m}: typeof x;`)
		.join("\n")}\n}>;\n`;

afterEach(() => {
	for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true });
});

it("lists modules the way Convex codegen does", () => {
	const dir = fixture({
		"notes.ts": "export const a = 1;",
		"lib/search.ts": "import x from 'y';",
		"lib/empty.ts": "// nothing to export",
		"notes.test.ts": "export {};",
		"auth.config.ts": "export default {};",
		"schema.ts": "export default {};",
		".hidden.ts": "export {};",
		"README.md": "# docs",
		"_generated/api.d.ts": "",
		"component/convex.config.ts": "export default {};",
		"component/inner.ts": "export {};",
	});
	expect(convexModules(dir)).toEqual(["lib/search", "notes"]);
});

it("reads the module list from api.d.ts", () => {
	expect(generatedModules(apiDts(["notes", "lib/search"]))).toEqual([
		"lib/search",
		"notes",
	]);
});

it("reports modules missing from or extra in api.d.ts", () => {
	const dir = fixture({
		"notes.ts": "export {};",
		"lib/search.ts": "export {};",
		"_generated/api.d.ts": apiDts(["notes", "lib/gone"]),
	});
	expect(apiDrift(dir)).toEqual([
		"missing from api.d.ts: lib/search",
		"in api.d.ts but not in convex/: lib/gone",
	]);
});

it("passes for this repo's committed api.d.ts", () => {
	expect(apiDrift(path.resolve("convex"))).toEqual([]);
});

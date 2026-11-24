// Fails when convex/_generated/api.d.ts does not list exactly the modules in
// convex/. `convex dev` and `convex codegen` rewrite that file, but both need a
// deployment, so CI cannot regenerate it; a module added or removed without
// running one of them leaves the committed file behind (APP-788).
//
// The rules below mirror `entryPoints` in convex/dist/esm/bundler/index.js
// (convex 1.51): which files under convex/ become API modules.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXTENSIONS = [".js", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts", ".jsx"];

/** The module paths (`lib/foo`) Convex generates API entries for. */
export function convexModules(functionsDir) {
	const modules = [];
	const walk = (dir) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			const rel = path.relative(functionsDir, full).split(path.sep).join("/");
			if (entry.isDirectory()) {
				if (rel === "_generated") continue;
				// A nested component definition is not part of this app's API.
				if (fs.existsSync(path.join(full, "convex.config.ts"))) continue;
				walk(full);
				continue;
			}
			if (!entry.isFile()) continue;
			const base = entry.name;
			if (!EXTENSIONS.some((ext) => base.endsWith(ext))) continue;
			if (base.startsWith(".") || base.startsWith("#")) continue;
			if (base === "schema.ts" || base === "schema.js") continue;
			if ((base.match(/\./g) ?? []).length > 1) continue;
			if (rel.includes(" ")) continue;
			if (
				(base.endsWith(".ts") || base.endsWith(".tsx")) &&
				!/^\s{0,100}(import|export)/m.test(fs.readFileSync(full, "utf8"))
			)
				continue;
			modules.push(rel.slice(0, rel.lastIndexOf(".")));
		}
	};
	walk(functionsDir);
	return modules.sort();
}

/** The module paths listed in a generated api.d.ts. */
export function generatedModules(apiDts) {
	const block = apiDts.match(/ApiFromModules<\{([\s\S]*?)\}>/);
	if (!block) throw new Error("api.d.ts has no ApiFromModules<{…}> block");
	return [...block[1].matchAll(/^\s*"?([\w/.-]+)"?\s*:\s*typeof\b/gm)]
		.map((match) => match[1])
		.sort();
}

/** Problems as readable lines; empty when the generated API is current. */
export function apiDrift(functionsDir) {
	const apiDts = fs.readFileSync(
		path.join(functionsDir, "_generated", "api.d.ts"),
		"utf8",
	);
	const expected = new Set(convexModules(functionsDir));
	const listed = new Set(generatedModules(apiDts));
	return [
		...[...expected]
			.filter((m) => !listed.has(m))
			.map((m) => `missing from api.d.ts: ${m}`),
		...[...listed]
			.filter((m) => !expected.has(m))
			.map((m) => `in api.d.ts but not in convex/: ${m}`),
	];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const problems = apiDrift(path.resolve("convex"));
	if (problems.length > 0) {
		console.error(
			`convex/_generated/api.d.ts is out of date:\n${problems.map((p) => `  ${p}`).join("\n")}\nRun \`pnpm exec convex dev --once\` (or \`CONVEX_AGENT_MODE=anonymous pnpm exec convex dev --once\`) and commit convex/_generated.`,
		);
		process.exit(1);
	}
}

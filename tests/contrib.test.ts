import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";
import type { Model, ModelsDevCatalog } from "../src/types.js";
import { exportModelsDevContrib, formatModelForToml } from "../src/utils.js";

let tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs) {
		rmSync(dir, { recursive: true, force: true });
	}
	tempDirs = [];
});

function tempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "evict-test-"));
	tempDirs.push(dir);
	return dir;
}

function model(id: string): Model {
	return {
		id,
		name: `Model ${id}`,
		attachment: false,
		reasoning: true,
		tool_call: true,
		open_weights: false,
		release_date: "2025-01-01",
		last_updated: "2025-06-01",
		modalities: { input: ["text"], output: ["text"] },
		limit: { context: 128000, input: 128000, output: 8192 },
	};
}

describe("formatModelForToml", () => {
	test("maps the model fields models.dev expects", () => {
		const toml = formatModelForToml({
			...model("gpt-x"),
			cost: { input: 1, output: 2 },
		}) as Record<string, unknown>;

		expect(toml.name).toBe("Model gpt-x");
		expect(toml.reasoning).toBe(true);
		expect(toml.release_date).toBe("2025-01-01");
		expect(toml.cost).toEqual({ input: 1, output: 2 });
		expect(toml.limit).toEqual({
			context: 128000,
			input: 128000,
			output: 8192,
		});
	});

	test("falls back to safe defaults for missing metadata", () => {
		const toml = formatModelForToml({
			...model("gpt-x"),
			release_date: "",
			last_updated: "",
		}) as Record<string, unknown>;

		expect(toml.release_date).toBe("2024-01-01");
		expect(toml.last_updated).toBe("2024-01-01");
	});
});

describe("exportModelsDevContrib", () => {
	test("exports missing models as parseable TOML", () => {
		const outDir = tempDir();
		const base: ModelsDevCatalog = {
			kilo: {
				id: "kilo",
				name: "Kilo",
				npm: "@ai-sdk/openai-compatible",
				env: ["KILO_API_KEY"],
				doc: "https://kilo.ai/docs",
				models: { "kilo-new": model("kilo-new") },
			},
		};

		exportModelsDevContrib(base, {}, outDir);

		const modelPath = join(
			outDir,
			"providers",
			"kilo",
			"models",
			"kilo-new.toml",
		);
		expect(existsSync(modelPath)).toBe(true);
		const parsed = parseToml(readFileSync(modelPath, "utf-8")) as Record<
			string,
			unknown
		>;
		expect(parsed.name).toBe("Model kilo-new");
	});

	test("writes nothing when the cache matches upstream", () => {
		const outDir = tempDir();
		const catalog: ModelsDevCatalog = {
			kilo: {
				id: "kilo",
				name: "Kilo",
				npm: "@ai-sdk/openai-compatible",
				env: ["KILO_API_KEY"],
				doc: "https://kilo.ai/docs",
				models: { "kilo-new": model("kilo-new") },
			},
		};

		exportModelsDevContrib(structuredClone(catalog), catalog, outDir);

		expect(existsSync(join(outDir, "providers"))).toBe(false);
	});
});

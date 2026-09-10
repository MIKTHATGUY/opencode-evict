import { describe, expect, test } from "bun:test";
import { injectMissingModels } from "../src/core.js";
import type { Model, ModelsDevCatalog, Provider } from "../src/types.js";

function model(id: string, overrides: Partial<Model> = {}): Model {
	return {
		id,
		name: id,
		attachment: false,
		reasoning: false,
		tool_call: false,
		open_weights: false,
		release_date: "2024-01-01",
		last_updated: "2024-01-01",
		modalities: { input: ["text"], output: ["text"] },
		limit: { context: 8192, input: 8192, output: 4096 },
		...overrides,
	};
}

function provider(id: string, ids: string[]): Provider {
	const models: Record<string, Model> = {};
	for (const modelId of ids) {
		models[modelId] = model(modelId, { name: `Dev ${modelId}` });
	}
	return {
		id,
		name: id,
		npm: "@ai-sdk/openai-compatible",
		env: ["PROVIDER_API_KEY"],
		doc: "https://example.com/docs",
		models,
	};
}

describe("injectMissingModels", () => {
	test("adds live models that models.dev does not index yet", () => {
		const base: ModelsDevCatalog = { openai: provider("openai", []) };
		const dev: ModelsDevCatalog = { openai: provider("openai", []) };

		const result = injectMissingModels(
			base,
			[model("gpt-x", { name: "GPT X" })],
			"openai",
			dev,
		);

		expect(result).toEqual({ newlyAdded: 1, alreadyCached: 0 });
		expect(base.openai.models["gpt-x"].name).toBe("GPT X");
	});

	test("never overwrites models already indexed by models.dev", () => {
		const base: ModelsDevCatalog = { openai: provider("openai", ["gpt-4"]) };
		const dev: ModelsDevCatalog = { openai: provider("openai", ["gpt-4"]) };

		const result = injectMissingModels(
			base,
			[model("gpt-4", { name: "Live GPT-4" })],
			"openai",
			dev,
		);

		expect(result).toEqual({ newlyAdded: 0, alreadyCached: 0 });
		expect(base.openai.models["gpt-4"].name).toBe("Dev gpt-4");
	});

	test("refreshes cached models with live data instead of duplicating them", () => {
		const cached = provider("openai", []);
		cached.models["gpt-x"] = model("gpt-x", { name: "Stale GPT X" });
		const base: ModelsDevCatalog = { openai: cached };
		const dev: ModelsDevCatalog = { openai: provider("openai", []) };

		const result = injectMissingModels(
			base,
			[model("gpt-x", { name: "Fresh GPT X" })],
			"openai",
			dev,
		);

		expect(result).toEqual({ newlyAdded: 0, alreadyCached: 1 });
		expect(base.openai.models["gpt-x"].name).toBe("Fresh GPT X");
	});

	test("counts intra-batch duplicates once", () => {
		const base: ModelsDevCatalog = { openai: provider("openai", []) };
		const dev: ModelsDevCatalog = { openai: provider("openai", []) };

		const result = injectMissingModels(
			base,
			[model("gpt-x"), model("gpt-x")],
			"openai",
			dev,
		);

		expect(result).toEqual({ newlyAdded: 1, alreadyCached: 0 });
		expect(Object.keys(base.openai.models)).toHaveLength(1);
	});

	test("leaves other providers untouched", () => {
		const base: ModelsDevCatalog = {
			openai: provider("openai", []),
			anthropic: provider("anthropic", ["claude-1"]),
		};
		const dev: ModelsDevCatalog = {
			openai: provider("openai", []),
			anthropic: provider("anthropic", ["claude-1"]),
		};

		injectMissingModels(base, [model("gpt-x")], "openai", dev);

		expect(Object.keys(base.anthropic.models)).toEqual(["claude-1"]);
	});

	test("returns zeros for a provider absent from the working catalog", () => {
		const base: ModelsDevCatalog = {};
		const dev: ModelsDevCatalog = {};

		const result = injectMissingModels(base, [model("gpt-x")], "nope", dev);

		expect(result).toEqual({ newlyAdded: 0, alreadyCached: 0 });
		expect(base).toEqual({});
	});
});

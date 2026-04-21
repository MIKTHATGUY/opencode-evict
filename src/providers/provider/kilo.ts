import { consola } from "consola";
import type { AbstractProvider, Model } from "../../types.js";

export const kiloCodeProvider: AbstractProvider = {
	id: "kilo",
	isEnabled: () => true,
	fetchModels: async (): Promise<Model[]> => {
		consola.info("Querying Kilo API...");
		try {
			const response = await fetch("https://api.kilo.ai/api/gateway/models");

			if (!response.ok) {
				consola.warn(`Kilo API failed: ${response.status}`);
				return [];
			}

			const data = (await response.json()) as any;
			const modelsData = Array.isArray(data) ? data : data.data || [];

			const models: Model[] = modelsData.map((m: any) => ({
				id: m.id,
				name: m.name || m.id,
				family: m.opencode?.family,
				attachment:
					m.architecture?.input_modalities?.includes("image") || false,
				reasoning:
					m.supported_parameters?.includes("reasoning") ||
					m.supported_parameters?.includes("include_reasoning") ||
					false,
				tool_call: m.supported_parameters?.includes("tools") || false,
				open_weights: false,
				release_date: m.created
					? new Date(m.created * 1000).toISOString().split("T")[0]
					: "2024-01-01",
				last_updated: m.created
					? new Date(m.created * 1000).toISOString().split("T")[0]
					: "2024-01-01",
				modalities: {
					input: m.architecture?.input_modalities || ["text"],
					output: m.architecture?.output_modalities || ["text"],
				},
				cost: m.pricing
					? {
							input: parseFloat(m.pricing.prompt || "0") * 1000000,
							output: parseFloat(m.pricing.completion || "0") * 1000000,
							cache_read: m.pricing.input_cache_read
								? parseFloat(m.pricing.input_cache_read) * 1000000
								: undefined,
							cache_write: m.pricing.input_cache_write
								? parseFloat(m.pricing.input_cache_write) * 1000000
								: undefined,
							reasoning: m.pricing.internal_reasoning
								? parseFloat(m.pricing.internal_reasoning) * 1000000
								: undefined,
						}
					: undefined,
				limit: {
					context: m.context_length || m.top_provider?.context_length || 8192,
					input: m.context_length || m.top_provider?.context_length || 8192,
					output: m.top_provider?.max_completion_tokens || 4096,
				},
			}));

			consola.success(`Fetched ${models.length} models from Kilo`);
			return models;
		} catch (error) {
			consola.error(`Kilo API failed: ${error}`);
			return [];
		}
	},
};

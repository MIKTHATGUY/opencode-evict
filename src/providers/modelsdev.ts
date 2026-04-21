import { consola } from "consola";
import type { ModelsDevCatalog } from "../types.js";

export async function fetchModelsDev(): Promise<ModelsDevCatalog> {
	consola.info("Fetching models.dev catalog...");
	const response = await fetch("https://models.dev/api.json");
	if (!response.ok) {
		throw new Error(`Failed to fetch models.dev: ${response.status}`);
	}
	const data = (await response.json()) as ModelsDevCatalog;
	let totalModels = 0;
	for (const provider of Object.values(data)) {
		if (provider.models) {
			totalModels += Object.keys(provider.models).length;
		}
	}
	consola.success(`Fetched ${totalModels} models from models.dev`);
	return data;
}

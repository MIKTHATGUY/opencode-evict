import type { ModelsDevCatalog } from "../types.js";

export async function fetchModelsDev(): Promise<ModelsDevCatalog> {
	const response = await fetch("https://models.dev/api.json");
	if (!response.ok) {
		throw new Error(`Failed to fetch models.dev: ${response.status}`);
	}
	const data = (await response.json()) as ModelsDevCatalog;
	return data;
}

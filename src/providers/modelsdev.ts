import type { ModelsDevCatalog } from "../types.js";

export async function fetchModelsDev(): Promise<ModelsDevCatalog> {
	const response = await fetch("https://models.dev/api.json", {
		signal: AbortSignal.timeout(15_000),
		headers: { "User-Agent": "oc-evict/1" },
	});
	if (!response.ok) {
		throw new Error(
			`models.dev returned HTTP ${response.status} ${response.statusText}`,
		);
	}
	const data = (await response.json()) as ModelsDevCatalog;
	if (!data || typeof data !== "object" || Array.isArray(data)) {
		throw new Error("models.dev returned an invalid catalog");
	}
	return data;
}

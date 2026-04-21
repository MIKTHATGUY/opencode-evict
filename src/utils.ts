import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir as osHomedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { isCancel, text } from "@clack/prompts";
import chalk from "chalk";
import { consola } from "consola";
import { stringify } from "smol-toml";
import type { Model, ModelsDevCatalog } from "./types";

export function getCachePath(): string {
	const platform = process.platform;

	const candidates: string[] = [];

	if (platform === "win32") {
		candidates.push(join(osHomedir(), ".cache", "opencode"));
		const localAppData = process.env.LOCALAPPDATA;
		const appData = process.env.APPDATA;
		if (localAppData) candidates.push(join(localAppData, "opencode"));
		if (appData) candidates.push(join(appData, "opencode"));
		candidates.push(join(osHomedir(), "AppData", "Local", "opencode"));
	} else if (platform === "darwin") {
		candidates.push(join(osHomedir(), ".cache", "opencode"));
		candidates.push(join(osHomedir(), "Library", "Caches", "opencode"));
	} else {
		candidates.push(join(osHomedir(), ".cache", "opencode"));
	}

	const xdgCache = process.env.XDG_CACHE_HOME;
	if (xdgCache) candidates.push(join(xdgCache, "opencode"));

	// Prefer an existing location (or the first candidate otherwise).
	for (const dir of candidates) {
		try {
			const file = join(dir, "models.json");
			if (existsSync(file) || existsSync(dir)) return file;
		} catch (_e) {
			// ignore
		}
	}

	return join(candidates[0], "models.json");
}

export function writeCache(cachePath: string, data: unknown): void {
	const cacheDir = dirname(cachePath);
	if (!existsSync(cacheDir)) {
		mkdirSync(cacheDir, { recursive: true });
	}
	writeFileSync(cachePath, JSON.stringify(data, null, 2));
}

export function readCache(cachePath: string): ModelsDevCatalog | null {
	try {
		if (existsSync(cachePath)) {
			const data = readFileSync(cachePath, "utf-8");
			return JSON.parse(data) as ModelsDevCatalog;
		}
	} catch (e) {
		consola.warn(`Failed to read existing cache from ${cachePath}`, e);
	}
	return null;
}

export function getAllProvidersFromModelsDev(
	devCatalog: ModelsDevCatalog,
): Record<
	string,
	{ id: string; apiEndpoint: string | undefined; bearerToken?: string }
> {
	const providers: Record<
		string,
		{ id: string; apiEndpoint: string | undefined; bearerToken?: string }
	> = {};
	for (const providerId in devCatalog) {
		const providerData = devCatalog[providerId];
		providers[providerId] = {
			id: providerId,
			apiEndpoint: providerData.api,
			bearerToken: undefined,
		};
	}
	return providers;
}

export async function testIfProviderHasPublicModelList(
	provider: { id: string; apiEndpoint?: string; bearerToken?: string },
	timeoutMs = 2000,
): Promise<void> {
	if (!provider.apiEndpoint) {
		consola.warn(`${provider.id} has no API endpoint configured`);
		return;
	}

	// normalize and target the /models path
	const base = provider.apiEndpoint.replace(/\/+$/, "");
	const url = `${base}/models`;

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		// Try HEAD first for a lightweight check
		let res: Response;
		try {
			res = await fetch(url, { method: "HEAD", signal: controller.signal });
		} catch (_headErr) {
			// If HEAD fails (some servers block HEAD), fall back to GET
			res = await fetch(url, {
				method: "GET",
				signal: controller.signal,
				headers: {
					"User-Agent": "oc-evict/1.0",
					Accept: "application/json, text/*;q=0.8",
				},
			});
		}

		if (res.ok) {
			consola.info(
				`${provider.id} has a public API endpoint for models: ${url}`,
			);
		} else if (res.status === 405) {
			// Method not allowed for HEAD — try GET
			const getRes = await fetch(url, {
				method: "GET",
				signal: controller.signal,
				headers: {
					"User-Agent": "oc-evict/1.0",
					Accept: "application/json, text/*;q=0.8",
				},
			});
			if (getRes.ok) {
				consola.info(
					`${provider.id} has a public API endpoint for models (GET): ${url}`,
				);
			} else {
				consola.warn(
					`${provider.id} API endpoint is not accessible: ${url} (status: ${getRes.status})`,
				);
			}
		} else {
			consola.warn(
				`${provider.id} API endpoint is not accessible: ${url} (status: ${res.status})`,
			);
		}
	} catch (err: unknown) {
		if ((err as any)?.name === "AbortError") {
			consola.warn(
				`${provider.id} API endpoint check timed out after ${timeoutMs}ms: ${url}`,
			);
		} else {
			consola.error(`${provider.id} API endpoint check failed: ${url}`, err);
		}
	} finally {
		clearTimeout(timer);
	}
}

export async function fetchGenericPublicModels(
	provider: { id: string; apiEndpoint?: string; bearerToken?: string },
	timeoutMs = 5000,
	tryBearer = false,
): Promise<Model[]> {
	if (!provider.apiEndpoint) return [];

	const base = provider.apiEndpoint.replace(/\/+$/, "");
	const url = `${base}/models`;

	async function doFetch(
		authToken?: string,
	): Promise<{ ok: boolean; status: number; data?: any }> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);

		const headers: Record<string, string> = {
			"User-Agent": "oc-evict/1.0",
			Accept: "application/json",
		};
		if (authToken) {
			headers.Authorization = `Bearer ${authToken}`;
		}

		consola.info(`Querying ${provider.id} models ...`);
		try {
			const res = await fetch(url, {
				method: "GET",
				signal: controller.signal,
				headers,
			});

			if (!res.ok) {
				return { ok: false, status: res.status };
			}

			const data = (await res.json()) as any;
			return { ok: true, status: res.status, data };
		} finally {
			clearTimeout(timer);
		}
	}

	try {
		let authToken = provider.bearerToken;
		let result = await doFetch(authToken);

		// If failed with 401/403 and tryBearer is enabled, prompt for token and retry
		if (
			!result.ok &&
			tryBearer &&
			(result.status === 401 || result.status === 403) &&
			!authToken
		) {
			consola.warn(
				`${provider.id} returned ${result.status}, prompting for bearer token...`,
			);
			let tokenInput = await text({
				message: "Enter your bearer token (or press Esc to skip):",
			});

			while (!tokenInput || typeof tokenInput === "symbol") {
				if (isCancel(tokenInput)) {
					consola.info(
						"Bearer token prompt cancelled, skipping this provider.",
					);
					break;
				}
				tokenInput = await text({
					message:
						"Invalid input. Enter your bearer token (or press Esc to skip):",
				});
			}
			if (tokenInput && typeof tokenInput === "string") {
				authToken = tokenInput;
				result = await doFetch(authToken);
			}
		}

		if (!result.ok) {
			return [];
		}

		const data = result.data;
		const modelsData = Array.isArray(data) ? data : data.data || [];

		const models: Model[] = modelsData.map((m: any) => ({
			id: m.id,
			name: m.name || m.id,
			family: m.opencode?.family,
			attachment: m.architecture?.input_modalities?.includes("image") || false,
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
			limit: {
				context: m.context_length || m.top_provider?.context_length || 8192,
				input: m.context_length || m.top_provider?.context_length || 8192,
				output: m.top_provider?.max_completion_tokens || 4096,
			},
		}));

		consola.success(
			chalk.green(`Fetched ${models.length} models from ${provider.id}`),
		);
		return models;
	} catch (_error) {
		return [];
	}
}

export function formatModelForToml(model: Model) {
	const tomlObj: any = {
		name: model.name || model.id,
		attachment: model.attachment ?? false,
		reasoning: model.reasoning ?? false,
		tool_call: model.tool_call ?? false,
		release_date: model.release_date || "2024-01-01",
		last_updated: model.last_updated || "2024-01-01",
		open_weights: model.open_weights ?? false,
	};

	if (model.knowledge !== undefined) tomlObj.knowledge = model.knowledge;
	if (model.structured_output !== undefined)
		tomlObj.structured_output = model.structured_output;
	if (model.temperature !== undefined) tomlObj.temperature = model.temperature;
	if (model.interleaved !== undefined) tomlObj.interleaved = model.interleaved;

	if (model.cost) {
		tomlObj.cost = { ...model.cost };
	}

	if (model.limit) {
		tomlObj.limit = { ...model.limit };
	}

	if (model.modalities) {
		tomlObj.modalities = { ...model.modalities };
	}

	if (model.status) {
		tomlObj.status = model.status;
	}

	return tomlObj;
}

export function exportModelsDevContrib(
	baseCatalog: ModelsDevCatalog,
	originalCatalog: ModelsDevCatalog,
	outputDir = "./modelsai",
) {
	let exportedProviders = 0;
	let exportedModels = 0;

	for (const [providerId, providerData] of Object.entries(baseCatalog)) {
		const originalProvider = originalCatalog[providerId];
		const isNewProvider = !originalProvider;

		let hasNewModels = false;
		const newModels: Model[] = [];

		const baseModels = providerData.models || {};
		const origModels = originalProvider?.models || {};

		for (const [modelId, model] of Object.entries(baseModels)) {
			const origModel = origModels[modelId];
			if (!origModel) {
				hasNewModels = true;
				newModels.push(model);
			} else {
				const newTomlStr = JSON.stringify(formatModelForToml(model));
				const origTomlStr = JSON.stringify(formatModelForToml(origModel));
				if (newTomlStr !== origTomlStr) {
					hasNewModels = true;
					newModels.push(model);
				}
			}
		}

		if (!hasNewModels && !isNewProvider) continue;

		const outPath = resolve(outputDir);
		const providerDir = join(outPath, "providers", providerId);
		mkdirSync(providerDir, { recursive: true });

		if (isNewProvider) {
			const providerToml: any = {
				name: providerData.name || providerId,
				npm: providerData.npm || "@ai-sdk/openai-compatible",
				env: providerData.env || ["PROVIDER_API_KEY"],
				doc: providerData.doc || "https://example.com/docs",
			};
			if (
				providerData.api ||
				providerToml.npm === "@ai-sdk/openai-compatible"
			) {
				providerToml.api = providerData.api || "https://api.example.com/v1";
			}
			writeFileSync(
				join(providerDir, "provider.toml"),
				stringify(providerToml),
			);
			exportedProviders++;
		}

		if (newModels.length > 0) {
			const modelsDir = join(providerDir, "models");
			mkdirSync(modelsDir, { recursive: true });

			for (const model of newModels) {
				const modelTomlPath = join(modelsDir, `${model.id}.toml`);
				// Ensure subdirs if model.id has slashes
				mkdirSync(dirname(modelTomlPath), { recursive: true });

				// Format model object for TOML
				const tomlObj = formatModelForToml(model);

				writeFileSync(modelTomlPath, stringify(tomlObj));
				exportedModels++;
			}
		}
	}

	if (exportedProviders > 0 || exportedModels > 0) {
		consola.success(
			chalk.green(
				`Exported ${exportedProviders} providers and ${exportedModels} differing models to ${outputDir} for models.dev contribution.`,
			),
		);
	} else {
		consola.info(
			`No missing or differing models found to export for contribution.`,
		);
	}
}

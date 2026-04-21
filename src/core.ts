import * as p from "@clack/prompts";
import chalk from "chalk";
import { consola } from "consola";
import { writeFileSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { activeProviders, fetchModelsDev } from "./providers/index.js";
import type { Model, ModelsDevCatalog } from "./types.js";
import {
	exportModelsDevContrib,
	fetchGenericPublicModels,
	getAllProvidersFromModelsDev,
	getCachePath,
	readCache,
	writeCache,
} from "./utils.js";

function injectMissingModels(
	baseCatalog: ModelsDevCatalog,
	liveModels: Model[],
	provider: string,
): number {
	const providerData = baseCatalog[provider];
	if (!providerData?.models) {
		consola.warn(`Provider ${provider} not found in models.dev catalog`);
		return 0;
	}

	const existingIds = new Set<string>(Object.keys(providerData.models));
	let injected = 0;
	const injectedModels: string[] = [];

	for (const model of liveModels) {
		// Only skip if the exact ID exists in the specific provider
		if (!existingIds.has(model.id)) {
			providerData.models[model.id] = model;
			injected++;
			existingIds.add(model.id); // Prevent intra-batch duplicates
			injectedModels.push(model.id);
		}
	}

	if (injectedModels.length > 0) {
		if (injectedModels.length <= 2) {
			consola.info(
				chalk.green(
					`Injected ${injectedModels.length} models for ${provider}: ${injectedModels.join(", ")}`,
				),
			);
		} else {
			// Find the shortest model names to keep the output extremely compact
			const shortestModels = [...injectedModels].sort(
				(a, b) => a.length - b.length,
			);
			const samples = shortestModels.slice(0, 2).join(", ");
			consola.info(
				chalk.green(
					`Injected ${injectedModels.length} models for ${provider} (e.g. ${samples}...)`,
				),
			);
		}
	}

	return injected;
}

export interface RefresherOptions {
	betaCheckGenericProvider?: boolean;
	dryRun?: boolean;
	tryBearer?: boolean;
	exportContrib?: boolean;
	outputDir?: string;
}

export async function runRefresher(
	options: RefresherOptions = {},
): Promise<void> {
	const {
		betaCheckGenericProvider = false,
		dryRun = false,
		tryBearer = false,
		exportContrib = false,
		outputDir = "./modelsai",
	} = options;

	p.intro(chalk.cyan("OpenCode Cache Refresher"));

	const cachePath = getCachePath();
	consola.info(`Cache path: ${cachePath}`);

	const devCatalog = await fetchModelsDev();
	const existingCache = readCache(cachePath);

	// Merge existing cache into the clean devCatalog incrementally
	const baseCatalog: ModelsDevCatalog = JSON.parse(JSON.stringify(devCatalog));
	if (existingCache) {
		for (const providerId in existingCache) {
			if (!baseCatalog[providerId]) {
				// Provider entirely custom? Preserve it.
				baseCatalog[providerId] = existingCache[providerId];
			} else {
				// Provider exists in both, merge models (favor existing cache for prior injected ones)
				baseCatalog[providerId].models = {
					...devCatalog[providerId]?.models,
					...existingCache[providerId]?.models,
				};
			}
		}
		consola.info(`Loaded previous entries from existing cache`);
	}

	const providersFromDev = getAllProvidersFromModelsDev(baseCatalog);

	let totalInjected = 0;

	if (betaCheckGenericProvider) {
		consola.info("Checking generic providers from models.dev...");

		let genericResults: { providerId: string; models: any[] }[] = [];
		const fetchEntries = Object.entries(providersFromDev).filter(
			([_, genericProvider]) => !!genericProvider.apiEndpoint,
		);

		if (tryBearer) {
			// If interactive prompts might trigger, fetch sequentially to prevent CLI glitching
			for (const [providerId, genericProvider] of fetchEntries) {
				try {
					const models = await fetchGenericPublicModels(
						genericProvider,
						5000,
						tryBearer,
					);
					genericResults.push({ providerId, models });
				} catch (_e) {
					genericResults.push({ providerId, models: [] });
				}
			}
		} else {
			// Fetch in parallel for maximum performance when interactive prompts are disabled
			const promises = fetchEntries.map(
				async ([providerId, genericProvider]) => {
					try {
						const models = await fetchGenericPublicModels(
							genericProvider,
							5000,
							false,
						);
						return { providerId, models };
					} catch (_e) {
						return { providerId, models: [] };
					}
				},
			);
			genericResults = await Promise.all(promises);
		}

		for (const result of genericResults) {
			if (result.models && result.models.length > 0) {
				const injectedCount = injectMissingModels(
					baseCatalog,
					result.models,
					result.providerId,
				);
				totalInjected += injectedCount;
				if (injectedCount > 0)
					consola.success(
						chalk.green(
							`Successfully merged ${injectedCount} models for generic provider: ${result.providerId}`,
						),
					);
			}
		}
	}

	const activeFetchPromises = activeProviders.map(async (provider) => {
		if (provider.baseConfig && !baseCatalog[provider.id]) {
			baseCatalog[provider.id] = provider.baseConfig;
		}

		if (provider.isEnabled()) {
			try {
				const models = await provider.fetchModels();
				return { providerId: provider.id, models };
			} catch (e) {
				consola.error(
					`Error querying active provider ${provider.id} API: ${e}`,
				);
				return { providerId: provider.id, models: [] };
			}
		} else {
			consola.warn(
				`Skipping active provider ${provider.id} (credentials not found)`,
			);
			return null;
		}
	});

	const activeResults = await Promise.all(activeFetchPromises);

	for (const result of activeResults) {
		if (result && result.models.length > 0) {
			const injectedCount = injectMissingModels(
				baseCatalog,
				result.models,
				result.providerId,
			);
			totalInjected += injectedCount;
			if (injectedCount > 0)
				consola.success(
					chalk.green(
						`Successfully merged ${injectedCount} models for active provider: ${result.providerId}`,
					),
				);
		}
	}

	if (dryRun) {
		consola.info(
			`[DRY RUN] Skipping cache write. Simulated write to ${cachePath}`,
		);
	} else {
		writeCache(cachePath, baseCatalog);
		consola.success(`Cache written to ${cachePath}`);
	}

	if (totalInjected > 0) {
		consola.success(
			chalk.green(`Injected ${totalInjected} new models globally`),
		);
		consola.log(
			chalk.yellow(
				`Note: ${totalInjected} models were missing from the base catalog and have been injected. Consider contributing these models to the main models.dev catalog for better visibility.`,
			),
		);
	} else {
		consola.success(chalk.green(`All models up to date!`));
	}

	consola.info("Models missing from models.dev:");
	let localMissingCount = 0;
	const missingModels: string[] = [];

	for (const providerId in baseCatalog) {
		const baseModels = baseCatalog[providerId].models || {};
		const originalModels = devCatalog[providerId]?.models || {};

		for (const modelId in baseModels) {
			const origModel = originalModels[modelId];
			if (!origModel) {
				missingModels.push(`${providerId}/${modelId}`);
				localMissingCount++;
			}
		}
	}
	if (localMissingCount === 0) {
		consola.log(
			chalk.gray(" None! The cache and models.dev are perfectly synced."),
		);
	} else {
		if (localMissingCount < 15) {
			for (const model of missingModels) {
				consola.log(chalk.gray(` - ${model}`));
			}
		}
		consola.info(`Total missing from models.dev: ${localMissingCount}`);

		let createRecap = false;
		if (localMissingCount >= 15) {
			const confirm = await p.confirm({
				message: `There are ${localMissingCount} missing models. Would you like to create a recap file?`,
			});
			createRecap = confirm !== false;
		}

		if (createRecap) {
			const outPath = resolve(outputDir);
			mkdirSync(outPath, { recursive: true });
			const recapPath = join(outPath, "missing_models_recap.txt");
			writeFileSync(recapPath, missingModels.join("\n"), "utf-8");
			consola.success(`Recap file created: ${recapPath}`);
		}
		
		if (exportContrib) {
			exportModelsDevContrib(baseCatalog, devCatalog, outputDir);
		}
	}

	p.outro(chalk.green("Cache refreshed successfully!"));
}

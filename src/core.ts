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

interface ProviderStats {
	providerId: string;
	fetched: number;
	newlyAdded: number;
	alreadyCached: number;
	status: "success" | "skipped" | "error";
}

const PROGRESS_BAR_WIDTH = 20;

function clearProgressLine(): void {
	process.stdout.write("\r" + " ".repeat(PROGRESS_BAR_WIDTH + 20) + "\r");
}

function updateProgressBar(value: number, total: number): void {
	const percent = Math.min(1, value / total);
	const filled = Math.floor(percent * PROGRESS_BAR_WIDTH);
	const bar = "=".repeat(filled) + " ".repeat(PROGRESS_BAR_WIDTH - filled);
	process.stdout.write(`\r[${bar}] ${value}/${total} providers`);
	if (value >= total) {
		process.stdout.write("\n");
	}
}

function injectMissingModels(
	baseCatalog: ModelsDevCatalog,
	liveModels: Model[],
	provider: string,
	originalCatalog?: ModelsDevCatalog,
): { newlyAdded: number; alreadyCached: number } {
	const providerData = baseCatalog[provider];
	if (!providerData?.models) {
		consola.warn(`Provider ${provider} not found in models.dev catalog`);
		return { newlyAdded: 0, alreadyCached: 0 };
	}

	// Compare against original catalog (models.dev) only, not the merged cache
	const originalProvider = originalCatalog?.[provider];
	const devModelIds = new Set<string>(Object.keys(originalProvider?.models ?? {}));
	let newlyAdded = 0;
	let alreadyCached = 0;

	for (const model of liveModels) {
		// Only process if the model is not in models.dev
		if (!devModelIds.has(model.id)) {
			// Check if already in baseCatalog (from previous cache)
			if (!providerData.models[model.id]) {
				// Truly new - not in models.dev and not in cache
				providerData.models[model.id] = model;
				newlyAdded++;
			} else {
				// Already in cache from previous run - update with fresh data
				providerData.models[model.id] = model;
				alreadyCached++;
			}
			devModelIds.add(model.id); // Prevent intra-batch duplicates
		}
	}

	return { newlyAdded, alreadyCached };
}

export interface RefresherOptions {
	betaCheckGenericProvider?: boolean;
	dryRun?: boolean;
	tryBearer?: boolean;
	exportContrib?: boolean;
	outputDir?: string;
	recap?: boolean;
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
		recap = false,
	} = options;

	const startTime = Date.now();

	p.intro(chalk.cyan("OpenCode Cache Refresher"));

	p.log.info("Phase 1: Loading local cache...");
	const cachePath = getCachePath();
	console.log(chalk.gray(`Cache path: ${cachePath}`));

	p.log.info("Phase 2: Fetching canonical models.dev registry...");
	const devCatalog = await fetchModelsDev();
	const existingCache = readCache(cachePath);

	// Merge existing cache into the clean devCatalog incrementally
	const baseCatalog: ModelsDevCatalog = JSON.parse(JSON.stringify(devCatalog));
	if (existingCache) {
		for (const providerId in existingCache) {
			if (!baseCatalog[providerId]) {
				baseCatalog[providerId] = existingCache[providerId];
			} else {
				baseCatalog[providerId].models = {
					...devCatalog[providerId]?.models,
					...existingCache[providerId]?.models,
				};
			}
		}
		console.log(chalk.gray("Loaded entries from models.dev"));
	}

	const providersFromDev = getAllProvidersFromModelsDev(baseCatalog);

	const providerStats: ProviderStats[] = [];
	let totalInjected = 0;

	// Get IDs of active providers to avoid double-fetching
	const activeProviderIds = new Set(activeProviders.map(p => p.id));

	// Calculate total providers for progress bar
	let totalProviders = 0;
	if (betaCheckGenericProvider) {
		const genericEntries = Object.entries(providersFromDev).filter(
			([pid, p]) => !!p.apiEndpoint && !activeProviderIds.has(pid),
		);
		totalProviders += genericEntries.length;
	}
	totalProviders += activeProviders.filter((p) => p.isEnabled()).length;

	let currentProvider = 0;
	if (totalProviders > 0) {
		p.log.info("Phase 3: Scanning live provider APIs...");
		updateProgressBar(0, totalProviders);
	}

	if (betaCheckGenericProvider) {
		const fetchEntries = Object.entries(providersFromDev).filter(
			([pid, genericProvider]) =>
				!!genericProvider.apiEndpoint && !activeProviderIds.has(pid),
		);

		const genericPromises = fetchEntries.map(async ([providerId, genericProvider]) => {
			try {
				const models = await fetchGenericPublicModels(
					genericProvider,
					5000,
					tryBearer,
				);
				if (models && models.length > 0) {
					const { newlyAdded, alreadyCached } = injectMissingModels(
						baseCatalog,
						models,
						providerId,
						devCatalog,
					);
					totalInjected += newlyAdded;
					providerStats.push({
						providerId,
						fetched: models.length,
						newlyAdded,
						alreadyCached,
						status: "success",
					});
				} else {
					providerStats.push({
						providerId,
						fetched: 0,
						newlyAdded: 0,
						alreadyCached: 0,
						status: "error",
					});
				}
			} catch (_e) {
				providerStats.push({
					providerId,
					fetched: 0,
					newlyAdded: 0,
					alreadyCached: 0,
					status: "error",
				});
			}
			currentProvider++;
			updateProgressBar(currentProvider, totalProviders);
		});
		await Promise.all(genericPromises);
	}

	const activePromises = activeProviders.map(async (provider) => {
		if (provider.baseConfig && !baseCatalog[provider.id]) {
			baseCatalog[provider.id] = provider.baseConfig;
		}

		if (provider.isEnabled()) {
			try {
				const models = await provider.fetchModels();
				if (models.length > 0) {
					const { newlyAdded, alreadyCached } = injectMissingModels(
						baseCatalog,
						models,
						provider.id,
						devCatalog,
					);
					totalInjected += newlyAdded;
					providerStats.push({
						providerId: provider.id,
						fetched: models.length,
						newlyAdded,
						alreadyCached,
						status: "success",
					});
				} else {
					providerStats.push({
						providerId: provider.id,
						fetched: 0,
						newlyAdded: 0,
						alreadyCached: 0,
						status: "skipped",
					});
				}
			} catch (e) {
				clearProgressLine();
				console.log(
					chalk.red(`Error querying active provider ${provider.id} API: ${e}`),
				);
				providerStats.push({
					providerId: provider.id,
					fetched: 0,
					newlyAdded: 0,
					alreadyCached: 0,
					status: "error",
				});
			}
		} else {
			clearProgressLine();
			console.log(
				chalk.yellow(
					`Skipping active provider ${provider.id} (credentials not found)`,
				),
			);
			providerStats.push({
				providerId: provider.id,
				fetched: 0,
				newlyAdded: 0,
				alreadyCached: 0,
				status: "skipped",
			});
		}
		currentProvider++;
		updateProgressBar(currentProvider, totalProviders);
	});
	await Promise.all(activePromises);

	if (dryRun) {
		console.log(
			chalk.yellow(
				`[DRY RUN] Skipping cache write. Simulated write to ${cachePath}`,
			),
		);
	} else {
		writeCache(cachePath, baseCatalog);
		console.log(chalk.green(`Cache written to ${cachePath}`));
	}

	// Deduplicate provider stats - keep latest entry for each provider
	// Deduplicate provider stats - keep latest entry for each provider
const dedupedStats = providerStats.reduceRight<ProviderStats[]>((acc, stat) => {
    const existing = acc.find(s => s.providerId === stat.providerId);
    if (!existing) {
        acc.unshift(stat);
    }
    return acc;
}, []);

// Filter to only show providers with activity
const injectedStats = dedupedStats.filter(s => s.newlyAdded > 0 || s.alreadyCached > 0);

// Print summary table with dynamic width

if (injectedStats.length > 0) {
  const GAP = "   "; // 3-space column gutter

  const headers = ["Provider", "Fetched", "New to cache", "Upstream gap"];
  const rows = injectedStats.map(s => [
    s.providerId,
    s.fetched.toLocaleString(),
    s.newlyAdded.toLocaleString(),
    (s.newlyAdded + s.alreadyCached).toLocaleString(),
  ]);

  // Column widths: max of header vs every data value
  const cols = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => r[i].length))
  );

  // col 0 = text → left-align (padEnd)
  // col 1-3 = numbers → right-align (padStart)
  const fmt = (val: string, col: number) =>
    col === 0 ? val.padEnd(cols[col]) : val.padStart(cols[col]);

  const sep       = cols.map(w => "─".repeat(w)).join("─".repeat(GAP.length));
  const headerRow = headers.map((h, i) => fmt(h, i)).join(GAP);

  console.log("");
  console.log(chalk.dim(sep));
  console.log(chalk.bold(headerRow));
  console.log(chalk.dim(sep));
  for (const row of rows) {
    const name = chalk.blue(fmt(row[0], 0));
    const nums = chalk.green([1, 2, 3].map(i => fmt(row[i], i)).join(GAP));
    console.log(name + GAP + nums);
  }
}

	// Handle upstream gap (models not in models.dev)
	console.log("");
	console.log(chalk.bold("Upstream Gap Report (Not in models.dev):"));
	const upstreamGapModels: string[] = [];
	let upstreamGapCount = 0;

	for (const providerId in baseCatalog) {
		const baseModels = baseCatalog[providerId].models || {};
		const originalModels = devCatalog[providerId]?.models || {};

		for (const modelId in baseModels) {
			const origModel = originalModels[modelId];
			if (!origModel) {
				upstreamGapModels.push(`${providerId}/${modelId}`);
				upstreamGapCount++;
			}
		}
	}
	const finishtime = Date.now();
	if (upstreamGapCount === 0) {
		console.log(
			chalk.gray(" None! The cache and models.dev are perfectly synced."),
		);
	} else {
		if (upstreamGapCount < 15) {
			for (const model of upstreamGapModels) {
				console.log(chalk.gray(` - ${model}`));
			}
		}
		console.log(
			chalk.gray(`Total models not yet indexed by models.dev: ${upstreamGapCount}`),
		);

		// Prompt for upstream gap report
		if (upstreamGapCount > 0) {
			const createReport = await p.confirm({
				message: `There are ${upstreamGapCount} models in the upstream gap. Do you want to create a list of the models missing from models.dev?`,
			});
			if (createReport) {
				const outPath = resolve(outputDir);
				mkdirSync(outPath, { recursive: true });
				const reportPath = join(outPath, "upstream_gap_report.txt");
				writeFileSync(reportPath, upstreamGapModels.join("\n"), "utf-8");
				console.log(chalk.green(`Upstream gap report created: ${reportPath}`));
			}
		}

		if (exportContrib) {
			exportModelsDevContrib(baseCatalog, devCatalog, outputDir);
		}
	}

	// Final summary - split into two distinct outcomes
	console.log("");
	if (totalInjected > 0) {
		const injectedLabel = totalInjected === 1 ? "1 model" : `${totalInjected} models`;
		console.log(chalk.green(`✓ Cache Status: Added ${injectedLabel} to cache`));
	} else {
		console.log(chalk.green("✓ Cache Status: Fully up to date"));
	}

	if (upstreamGapCount > 0) {
		const gapLabel = upstreamGapCount === 1 ? "1 model" : `${upstreamGapCount} models`;
		console.log(chalk.yellow(`⚠ Upstream Gap: ${gapLabel} found in the wild that models.dev hasn't indexed yet`));
	}

	const elapsed = ((finishtime - startTime) / 1000).toFixed(1);
	console.log("");
	p.outro(chalk.green(`Cache refreshed successfully in ${elapsed}s!`));
}

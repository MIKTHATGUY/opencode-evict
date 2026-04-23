#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { consola } from "consola";
import { runRefresher } from "./core.js";

const mainCommand = defineCommand({
	meta: {
		name: "oc-evict",
		version: "1.0.0",
		description:
			"OpenCode Cache Refresher - Refresh model cache with live provider data",
	},

	args: {
		"beta-check-generic-provider": {
			type: "boolean",
			description:
				"Auto-check all providers in the catalog for a public /models endpoint",
			default: false,
		},
		"try-bearer": {
			type: "boolean",
			description:
				"Prompt for bearer token and retry if API call fails with 401/403",
			default: false,
		},
		"export-contrib": {
			type: "boolean",
			description:
				"Export missing/outdated models as TOML files for models.dev contribution",
			default: false,
		},
		"output-dir": {
			type: "string",
			description:
				"Output directory for exported files and recaps (defaults to ./modelsai)",
			default: "./modelsai",
		},
		"dry-run": {
			type: "boolean",
			description: "Run the refresher without writing to the cache file",
			default: false,
		},
		"print-missing": {
			type: "boolean",
			description:
				"Always print models that are missing/outdated from models.dev",
			default: false,
		},
		ci: {
			type: "boolean",
			description:
				"Run in CI mode (disable interactive prompts, flatten output, fail-fast on errors)",
			default: false,
		},
		recap: {
			type: "boolean",
			description: "Automatically create a recap file for missing models",
			default: false,
		},
	},
	run({ args }) {
		runRefresher({
			betaCheckGenericProvider: args["beta-check-generic-provider"],
			dryRun: args["dry-run"],
			tryBearer: args["try-bearer"],
			exportContrib: args["export-contrib"],
			outputDir: args["output-dir"],
			recap: args.recap,
			printMissing: args["print-missing"],
			ci: args.ci,
		}).catch((error) => {
			consola.error(error);
			process.exit(1);
		});
	},
});

runMain(mainCommand);

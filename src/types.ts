export interface Cost {
	// all costs are in dollars
	input: number;
	output: number;
	reasoning?: number;
	cache_read?: number;
	cache_write?: number;
	input_audio?: number;
	output_audio?: number;
	context_over_200k?: Omit<Cost, "context_over_200k">;
}

export interface Model {
	id: string;
	name: string;
	family?: string;
	attachment: boolean;
	reasoning: boolean;
	tool_call: boolean;
	open_weights: boolean;
	interleaved?: boolean | { field: string };
	structured_output?: boolean;
	temperature?: boolean;
	knowledge?: string;
	release_date: string;
	last_updated: string;
	status?: "alpha" | "beta" | "deprecated";
	modalities: {
		input: string[];
		output: string[];
	};
	cost?: Cost;
	limit: {
		context: number;
		input: number;
		output: number;
	};
	experimental?: {
		modes?: Record<
			string,
			{
				cost?: Cost;
				provider?: Record<string, unknown>;
			}
		>;
	};
	provider?: Record<string, unknown>;
}

export interface Provider {
	id: string;
	name: string;
	npm: string;
	env: string[];
	doc: string;
	api?: string;
	models: Record<string, Model>;
}

export type ModelsDevCatalog = Record<string, Provider>;

export interface AbstractProvider {
	id: string;
	isEnabled: () => boolean;
	fetchModels: () => Promise<Model[]>;
	baseConfig?: Provider;
}

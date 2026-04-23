import type { AbstractProvider } from "../types.js";
import { kiloCodeProvider } from "./provider/kilo.js";
import { openRouterProvider } from "./provider/openrouter.js";

export { fetchModelsDev } from "./modelsdev.js";

export const activeProviders: AbstractProvider[] = [
	kiloCodeProvider,
	openRouterProvider,
];

import type { AbstractProvider } from "../types.js";
import { kiloCodeProvider } from "./provider/kilo.js";

export { fetchModelsDev } from "./modelsdev.js";

export const activeProviders: AbstractProvider[] = [
	// Add providers here
	kiloCodeProvider,
];

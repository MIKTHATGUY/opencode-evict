import chalk from "chalk";
import { BRAND } from "./brand.js";

const symbols = { ok: "OK", warn: "!!", error: "XX", info: "--" } as const;

const evictOrange = chalk.hex(BRAND.colors.orange);

export function printBanner(): void {
	console.log("");
	console.log(
		`  ${evictOrange.bold(BRAND.name)}${chalk.dim(` ${BRAND.descriptor}`)}`,
	);
	console.log(chalk.dim(`  ${BRAND.description}`));
	console.log("");
}

export function printStep(
	type: keyof typeof symbols,
	message: string,
	detail?: string,
): void {
	const color =
		type === "ok"
			? chalk.green
			: type === "warn"
				? chalk.yellow
				: type === "error"
					? chalk.red
					: chalk.cyan;
	const suffix = detail ? chalk.dim(`  ${detail}`) : "";
	console.log(`${color(symbols[type])}  ${message}${suffix}`);
}

export function printLabel(label: string, value: string): void {
	console.log(`${chalk.dim(label.padEnd(12))}${value}`);
}

export function printRule(width = 56): void {
	console.log(chalk.dim("-".repeat(width)));
}

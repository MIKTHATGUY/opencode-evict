import { afterEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCachePath, readCache, writeCache } from "../src/utils.js";

let tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs) {
		rmSync(dir, { recursive: true, force: true });
	}
	tempDirs = [];
});

function tempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "evict-test-"));
	tempDirs.push(dir);
	return dir;
}

describe("getCachePath", () => {
	test("returns an absolute path to models.json", () => {
		const cachePath = getCachePath();
		expect(cachePath.endsWith("models.json")).toBe(true);
		expect(join(cachePath)).toBe(cachePath);
	});
});

describe("writeCache", () => {
	test("writes pretty-printed JSON that round-trips", () => {
		const dir = tempDir();
		const cachePath = join(dir, "models.json");
		const data = { openai: { models: {} } };

		const { backupPath } = writeCache(cachePath, data);

		expect(backupPath).toBeNull();
		expect(JSON.parse(readFileSync(cachePath, "utf-8"))).toEqual(data);
		expect(readFileSync(cachePath, "utf-8").endsWith("\n")).toBe(true);
	});

	test("preserves the previous cache as models.json.bak", () => {
		const dir = tempDir();
		const cachePath = join(dir, "models.json");
		writeFileSync(cachePath, `{"old":true}\n`);

		const { backupPath } = writeCache(cachePath, { fresh: true });

		expect(backupPath).toBe(`${cachePath}.bak`);
		expect(readFileSync(`${cachePath}.bak`, "utf-8")).toBe(`{"old":true}\n`);
		expect(JSON.parse(readFileSync(cachePath, "utf-8"))).toEqual({
			fresh: true,
		});
	});

	test("creates missing directories and leaves no temp files behind", () => {
		const dir = tempDir();
		const cachePath = join(dir, "nested", "deep", "models.json");

		writeCache(cachePath, { ok: true });

		expect(existsSync(cachePath)).toBe(true);
		for (const entry of readdirSync(join(dir, "nested", "deep"))) {
			expect(entry.endsWith(".tmp")).toBe(false);
		}
	});
});

describe("readCache", () => {
	test("returns null when no cache exists", () => {
		expect(readCache(join(tempDir(), "models.json"))).toBeNull();
	});

	test("parses an existing cache file", () => {
		const dir = tempDir();
		const cachePath = join(dir, "models.json");
		writeFileSync(cachePath, `{"openai":{"models":{}}}\n`);

		expect(readCache(cachePath)).toEqual({ openai: { models: {} } });
	});

	test("returns null for corrupt or non-object caches", () => {
		const dir = tempDir();
		const corrupt = join(dir, "corrupt.json");
		const arrayRoot = join(dir, "array.json");
		writeFileSync(corrupt, "not json{{{");
		writeFileSync(arrayRoot, "[]");

		expect(readCache(corrupt)).toBeNull();
		expect(readCache(arrayRoot)).toBeNull();
	});
});

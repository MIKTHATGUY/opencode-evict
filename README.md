# OpenCode Evict 🥾

[![npm version](https://img.shields.io/npm/v/@mikthatguy/opencode-evict.svg?color=cb3837)](https://www.npmjs.com/package/@mikthatguy/opencode-evict)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/MIKTHATGUY/opencode-evict.svg?style=social)](https://github.com/MIKTHATGUY/opencode-evict/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/MIKTHATGUY/opencode-evict.svg)](https://github.com/MIKTHATGUY/opencode-evict/issues)

> Stop letting your IDE gaslight you about what models actually exist.

Your local model registry isn't just stale — it belongs in a museum. If you’ve ever screamed at your screen because a provider dropped a shiny new model hours ago and OpenCode is still pretending it’s science fiction, congratulations: you are a victim of cached JSON.

OpenCode Evict (`oc-evict`) is a ruthless, stupid-fast CLI that refreshes OpenCode’s local `models.json` cache with live provider data, merges it with[models.dev](https://models.dev), and can even help you contribute missing models back to the community.

---

## 🛠 What it actually does

> [!NOTE]
> **TL;DR:** It fixes your models so you can code instead of debugging API configurations.

1. **Downloads the `models.dev` baseline.** Because starting from absolute zero is unhinged.
2. **Reads your existing OpenCode cache.** So whatever cursed, undocumented models you manually injected last week don’t get vaporized.
3. **Interrogates live provider APIs (concurrently).** Because the only actual source of truth for a provider's models is the provider itself. "Eventual consistency" is just a polite tech term for "broken."
4. **Overwrites the cache.** Shoves the merged, objectively correct reality straight into OpenCode’s OS-native cache folder.
5. **Generates Open Source Contributions.** Detects missing models and can automatically generate valid TOML files ready for a `models.dev` Pull Request.

---

## ⚡ Installation

### Via Public npm Registry (Recommended)

> [!TIP]
> `opencode-evict` is now officially published on the public npm registry! 

To run it instantly via `bunx` without installing:

```bash
bunx @mikthatguy/opencode-evict
```

Or install it globally using `bun` to have the `oc-evict` command always available:

```bash
bun add -g @mikthatguy/opencode-evict
oc-evict
```

### From Source (Bun)

```bash
git clone https://github.com/MIKTHATGUY/opencode-evict.git
cd opencode-evict
bun install
bun run dev
```

### Building standalone binaries

If you want a standalone executable (no Node.js/Bun required):

```bash
bun run build:bin
# For specific platforms:
bun run build:linux
bun run build:mac
```

---

## Reverting back to the old cache
> [!WARNING]
> This will overwrite your current cache with the old one. Make sure to back up any manually added models before doing this!

```bash
opencode models --refresh
```

---

## 🔌 Supported Providers

| Provider | Status | Description |
| :--- | :---: | :--- |
| **Kilo** ([kilo.ai](https://kilo.ai)) | 🟢 **Official** | Fully supported VIP provider integration. |
| **Generic OpenAI-Compatible** | 🟡 **Beta** | Any provider with a public `/models` endpoint that returns a list of models in a reasonable format. |

> [!WARNING]
> **Beta Feature:** The generic provider check (`--beta-check-generic-provider`) is a hail mary and may not work with all providers. It’s designed to be a "best effort" attempt to pull in models from providers that aren’t officially supported yet. If you rely on it, please consider contributing a proper integration!

---

## 🚀 Usage & Flags

Just run the command to refresh your cache:

```bash
bunx @mikthatguy/opencode-evict
```

### 🎛 Flags (Choose Your Own Adventure)

| Flag | Name | Description |
| :--- | :--- | :--- |
| `--dry-run` | **Coward mode** | Does all the network requests, calculates the result, and writes absolutely nothing to disk. |
| `--print-missing` | **Name and shame** | Prints every model that exists in the providers but not in the raw `models.dev` baseline. |
| `--export-contrib` | **The Good Citizen** | Exports missing/outdated models as valid TOML files for `models.dev` contribution. |
| `--output-dir <path>` | **Target Directory** | Where to drop the exported TOML files and recaps. Defaults to `./modelsai` in your current directory. |
| `--beta-check-generic-provider` | **YOLO mode** | For providers listed in the baseline, try hitting `api + /models` and inject whatever is publicly accessible. |
| `--try-bearer` | **Bribe the bouncer** | If a provider hits you with a `401/403`, prompt for a bearer token and retry. |

---

## 🤝 Exporting for models.dev

If you want to help keep the community database up to date, use the export flag:

```bash
bunx @mikthatguy/opencode-evict --export-contrib --output-dir ./my-contributions
```

> [!IMPORTANT]
> This command will create a structured directory (e.g., `my-contributions/providers/<provider-id>/models/`) containing `.toml` files matching the exact schema required by the [models.dev repository](https://github.com/anomalyco/models.dev). Just copy them over to your fork and open a PR!

---

## 📜 The Fine Print

>[!CAUTION]
> **We don’t delete things.** This tool is a hoarder, not a janitor. It injects what you’re missing; it doesn’t play whack-a-mole with deprecated models.

- **Cache location is OS-Native.** We auto-detect where OpenCode hides its cache:
  - **Windows**: `%LOCALAPPDATA%\opencode\models.json`
  - **macOS**: `~/Library/Caches/opencode/models.json`
  - **Linux**: `~/.cache/opencode/models.json`
- **VIP providers.** "Active" provider integrations live in `src/providers/index.ts` (currently just Kilo). Add more there if you want special handling.

---

**Stop trusting yesterday’s JSON. Evict it.**
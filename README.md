![Evict for OpenCode — live model registry sync](./evict-header.png)

<!-- GitHub social preview asset: ./evict-social.png (1280 × 640) -->

# Evict

### Live model registry synchronization for OpenCode

Keep OpenCode's local model registry aligned with [models.dev](https://models.dev/) and live provider APIs.

[![npm version](https://img.shields.io/npm/v/@mikthatguy/opencode-evict.svg?color=ff6b35)](https://www.npmjs.com/package/@mikthatguy/opencode-evict)
[![License: MIT](https://img.shields.io/badge/license-MIT-64748b.svg)](LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/MIKTHATGUY/opencode-evict.svg)](https://github.com/MIKTHATGUY/opencode-evict/issues)
[![CI](https://github.com/MIKTHATGUY/opencode-evict/actions/workflows/ci.yml/badge.svg)](https://github.com/MIKTHATGUY/opencode-evict/actions/workflows/ci.yml)

```bash
bunx @mikthatguy/opencode-evict
```

Evict (`oc-evict`) refreshes OpenCode's local `models.json` registry using the models.dev catalog and live provider APIs.

It preserves locally known models, discovers models exposed by providers before they are indexed upstream, and can generate models.dev-compatible contribution files.

## Install

```bash
bunx @mikthatguy/opencode-evict
```

```bash
bun add --global @mikthatguy/opencode-evict
oc-evict
```

## What it does

* Loads the current models.dev catalog
* Preserves models already present in the local cache
* Queries enabled providers concurrently
* Merges newly discovered models into the registry
* Writes atomically, keeping `models.json.bak`
* Reports models missing upstream
* Exports models.dev-compatible TOML contributions

## How it works

Evict builds a refreshed OpenCode model registry from the models.dev catalog, the existing local cache, and supported provider APIs.

During a refresh, Evict:

1. Loads the current models.dev catalog.
2. Reads the existing OpenCode `models.json` cache.
3. Queries enabled provider integrations concurrently.
4. Normalizes and merges the discovered model metadata.
5. Validates the resulting registry.
6. Preserves the current cache as `models.json.bak`.
7. Replaces `models.json` using an atomic write.

Evict is additive by default. A model is not removed simply because a provider no longer returns it.

## Usage

```bash
oc-evict [options]
```

| Option                          | Description                                                            |
| ------------------------------- | ---------------------------------------------------------------------- |
| `--dry-run`                     | Build and validate the refreshed registry without writing it to disk   |
| `--print-missing`               | Print models discovered from providers but missing from models.dev     |
| `--export-contrib`              | Export missing or changed models as models.dev-compatible TOML         |
| `--output-dir <path>`           | Set the contribution export directory. Defaults to `./modelsai`        |
| `--recap`                       | Write the upstream-gap report without prompting                        |
| `--beta-check-generic-provider` | Probe catalog providers exposing a public `/models` endpoint           |
| `--try-bearer`                  | Offer a bearer-token retry after an HTTP `401` or `403` response       |
| `--ci`                          | Disable prompts and colors, use flat logs, and fail on provider errors |

```bash
oc-evict --print-missing --export-contrib --output-dir ./models-contrib
```

Exported TOML can be reviewed and submitted upstream to models.dev.

## Providers

| Provider                             | Integration                                                   |
| ------------------------------------ | ------------------------------------------------------------- |
| [Kilo](https://kilo.ai/)             | Dedicated live adapter                                        |
| [OpenRouter](https://openrouter.ai/) | Dedicated live adapter                                        |
| OpenAI-compatible providers          | Best-effort discovery through `--beta-check-generic-provider` |

Generic discovery depends on the provider exposing a compatible public model endpoint. Where metadata accuracy matters, use a dedicated adapter.

## Safety

Evict writes through a temporary file, preserves the previous registry as `models.json.bak`, and replaces the active cache atomically. It never removes models solely because a provider response omits them.

Cache locations, in lookup order:

* Windows: `~/.cache/opencode/models.json`, `%LOCALAPPDATA%\opencode\models.json`, `%APPDATA%\opencode\models.json`
* macOS: `~/.cache/opencode/models.json`, `~/Library/Caches/opencode/models.json`
* Linux: `~/.cache/opencode/models.json`, `$XDG_CACHE_HOME/opencode/models.json`

```bash
opencode models --refresh
```

## Contributing

Provider adapters live in `src/providers/provider`. Keep mappings conservative, use request timeouts, and verify with `--dry-run`.

```bash
git clone https://github.com/MIKTHATGUY/opencode-evict.git
cd opencode-evict
bun install
bun run dev --dry-run
bun run check
bun run build
```

Bugs and provider requests: [GitHub Issues](https://github.com/MIKTHATGUY/opencode-evict/issues). See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE).

*Stop trusting yesterday's JSON.*

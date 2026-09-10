![evict for OpenCode — live model registry sync](./evict-header.png)

<!-- GitHub social preview asset: ./evict-social.png (1280 × 640) -->

# Evict
### Live model registry synchronization for OpenCode

*Stop trusting yesterday's JSON.*

Keep OpenCode's local model registry aligned with models.dev
and live provider APIs.

[![npm version](https://img.shields.io/npm/v/@mikthatguy/opencode-evict.svg?color=1f2937)](https://www.npmjs.com/package/@mikthatguy/opencode-evict)
[![License: MIT](https://img.shields.io/badge/license-MIT-64748b.svg)](LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/MIKTHATGUY/opencode-evict.svg)](https://github.com/MIKTHATGUY/opencode-evict/issues)
[![CI](https://github.com/MIKTHATGUY/opencode-evict/actions/workflows/ci.yml/badge.svg)](https://github.com/MIKTHATGUY/opencode-evict/actions/workflows/ci.yml)

```bash
bunx @mikthatguy/opencode-evict
```

Evict (`oc-evict`) refreshes OpenCode's local `models.json` cache from
the models.dev catalog and live provider APIs. It preserves local entries, adds
models that providers expose before models.dev indexes them, and can prepare
contribution files for upstream.

## Why it exists

Model catalogs move quickly. A provider may release or rename a model before the
local OpenCode cache catches up. Evict closes that gap without asking you to edit
generated JSON by hand.

- Pulls the current models.dev baseline
- Preserves models already present in the local cache
- Queries supported providers concurrently
- Writes the cache atomically and keeps the previous version as `models.json.bak`
- Reports models that are live but still missing upstream
- Exports models.dev-compatible TOML contributions

## Quick start

Run without installing:

```bash
bunx @mikthatguy/opencode-evict
```

Or install the command globally:

```bash
bun add --global @mikthatguy/opencode-evict
oc-evict
```

Preview the result without changing the cache:

```bash
oc-evict --dry-run
```

## Commands

| Option | Purpose |
| --- | --- |
| `--dry-run` | Preview the refresh without writing files |
| `--print-missing` | Print every model missing from models.dev |
| `--export-contrib` | Export missing or changed models as TOML |
| `--output-dir <path>` | Choose the export directory; defaults to `./modelsai` |
| `--recap` | Write the upstream-gap report without prompting |
| `--beta-check-generic-provider` | Probe catalog providers with a public `/models` endpoint |
| `--try-bearer` | Offer an interactive bearer-token retry after HTTP 401/403 |
| `--ci` | Disable prompts and colors, use flat logs, and fail on provider errors |

Example: inspect the upstream gap and prepare contribution files.

```bash
oc-evict --print-missing --export-contrib --output-dir ./models-contrib
```

## Supported providers

| Provider | Integration |
| --- | --- |
| [Kilo](https://kilo.ai) | Dedicated live adapter |
| [OpenRouter](https://openrouter.ai) | Dedicated live adapter |
| OpenAI-compatible providers | Best-effort discovery with `--beta-check-generic-provider` |

Generic discovery depends on each provider exposing a compatible public endpoint.
Use a dedicated adapter when accuracy matters.

## Safety and cache locations

Evict merges data; it does not remove models simply because a live provider stops
returning them. Before replacing an existing cache, it creates `models.json.bak`
in the same directory and writes the new registry through a temporary file.

The cache is discovered from the normal OpenCode locations:

- Windows: `~/.cache/opencode/models.json`, then the applicable AppData locations
- macOS: `~/.cache/opencode/models.json`, then `~/Library/Caches/opencode/models.json`
- Linux: `~/.cache/opencode/models.json` or `$XDG_CACHE_HOME/opencode/models.json`

To ask OpenCode to rebuild its standard cache instead, run:

```bash
opencode models --refresh
```

## Development

```bash
git clone https://github.com/MIKTHATGUY/opencode-evict.git
cd opencode-evict
bun install
bun run dev --dry-run
```

Quality checks and build:

```bash
bun run check
bun run build
```

Standalone binaries can be built with `bun run build:releases`.

## Contributing

Provider adapters live in `src/providers/provider`. Keep mappings conservative,
include a timeout for network requests, and verify changes with `--dry-run` before
opening a pull request. Bugs and provider requests are welcome in
[GitHub Issues](https://github.com/MIKTHATGUY/opencode-evict/issues).

MIT licensed. See [LICENSE](LICENSE).

Read the [contribution guide](CONTRIBUTING.md), [security policy](SECURITY.md),
and [changelog](CHANGELOG.md) for project governance and release history.

---

*Evict — stop trusting yesterday's JSON.*

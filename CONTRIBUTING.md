# Contributing to Evict

Thanks for improving Evict. Contributions are most useful when they are focused,
reproducible, and conservative about model metadata.

## Before you start

- Search existing issues and pull requests.
- Open an issue before making a large behavioral or architectural change.
- Never include provider credentials, bearer tokens, or private cache contents.
- Keep unrelated refactors out of the same pull request.

## Local setup

Evict uses Bun and TypeScript.

```bash
git clone https://github.com/MIKTHATGUY/opencode-evict.git
cd opencode-evict
bun install --frozen-lockfile
bun run dev --dry-run
```

Before opening a pull request, run:

```bash
bun run check
bun run build
bun run dev --dry-run --ci
```

The dry run performs live requests but does not write the OpenCode cache.

## Provider adapters

Dedicated integrations live in `src/providers/provider` and implement the
`AbstractProvider` interface. A provider adapter should:

1. Use the provider's official model-list endpoint.
2. Apply a bounded request timeout.
3. Return an empty list when the optional provider is unavailable.
4. Map only fields supported by the response; do not invent capabilities.
5. Avoid logging response bodies because they may contain sensitive data.
6. Be registered in `src/providers/index.ts`.

Include a redacted response example or official schema link in the pull request.

## Commit and pull request style

Use short, imperative commit messages. Conventional prefixes are encouraged:

- `feat:` new behavior
- `fix:` bug fix
- `docs:` documentation only
- `refactor:` internal change without new behavior
- `ci:` automation and workflow changes
- `chore:` maintenance

Pull requests should explain the user-visible outcome, verification performed,
and any compatibility considerations.

## Reporting security issues

Do not disclose vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md)
and use GitHub's private vulnerability reporting flow.


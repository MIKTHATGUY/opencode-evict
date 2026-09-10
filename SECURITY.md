# Security policy

## Supported versions

Security fixes are provided for the latest published version of Evict.

| Version | Supported |
| --- | --- |
| Latest release | Yes |
| Older releases | No |

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/MIKTHATGUY/opencode-evict/security/advisories/new).
Do not open a public issue and do not include working credentials in any report.

Please include:

- the affected version and operating system;
- a concise description of the impact;
- reproducible steps or a minimal proof of concept;
- any suggested mitigation, if known.

You should receive an acknowledgement within seven days. Confirmed reports will
be assessed, fixed on a private branch, and disclosed with the corresponding
release when practical.

## Scope

High-priority issues include credential exposure, unsafe cache-path handling,
arbitrary file writes, dependency compromise, and command execution caused by
untrusted provider data.


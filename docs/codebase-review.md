# Codebase review — October 14, 2026

Baseline: `caf8b16`. Scope: all application modules in `src/`, `worker/src/`, `worker/ui/`, their tests, migrations, build/release configuration, README, deployment/export guides and the bundled Claude skill. Generated bindings and dependencies were inspected through type/build checks and the dependency audit, not reviewed line by line.

## Findings addressed

| Priority | Finding | Resolution |
| --- | --- | --- |
| High | A retired recorder socket could clear freshly accepted login credentials during vehicle discovery. | Serialize activation and close handling, retire the old socket before storing the new session, ignore retired messages; deterministic race regressions. |
| High | Failed D1 charging writes advanced the sampling watermark, suppressing a retry. | Advance the watermark only after a successful write; replay regression. |
| Medium | Restarting the recorder lost the GPS ordering watermark, allowing old fixes to corrupt the active drive endpoint. | Restore the watermark with persisted drive state; restart/replay regression. |
| Medium | Login transitions retained old access or OTP tokens; failed responses could appear authenticated. | Clear conflicting tokens, reject missing access tokens and invalidate cached vehicle selection after login. |
| Medium | Shared MCP queries returned successful results for failures. | Set `isError: true`, preserving the useful error message. |
| Medium | Charging-history pagination silently returned partial data when a continuation cursor was missing. | Reject incomplete pages; retain existing repeated-cursor guard. |
| Medium | Rivian HTTP requests had no application timeout. | Bound each request to 30 seconds, without retrying authentication. |
| Medium | Masked CLI input treated a pasted chunk as one character and assumed a TTY. | Process pasted characters/newlines, clean up input handlers/raw mode, reject non-TTY secret prompts; regression tests. |
| Medium | Capacity charts mixed different vehicles into a single line. | Query and render separate per-vehicle series; two-vehicle SQL regression and Chrome fixture check. |
| Medium | Publishing could run without tests, lint or typechecks. | Reusable PR checks gate the release job; both package and Worker builds included. |
| Low | Zero latitude/longitude disappeared in formatted vehicle state. | Check presence rather than truthiness. |
| Low | Error/cancel screens retained observers/maps and stale navigation; selected controls and charts lacked accessibility metadata. | Tear down the old view, clear navigation, add pressed state and chart names. |
| Low | Dead convenience wrappers and palette entries obscured the production paths. | Remove `simplify`, `reverseGeocode`, `localDate` and unused palette members; tests now call production helpers. Enable unused-local/parameter checks in all three TypeScript targets. |
| Medium | Docs overstated privacy, contained invalid signatures and obsolete tool/architecture guidance, and lacked practical development/tool examples. | Correct storage and external-data descriptions, API signatures, subscription/pagination behavior, local setup and export examples. Qualify unverified Roadbook importer behavior. |

No remaining unused locals or parameters were reported. A cross-file export/reference pass was also performed; that is evidence of the reviewed paths, not a guarantee that every dynamically reachable branch is necessary.

## Dependency audit: unresolved release-tool advisories

The locked `npm` dependency used by semantic-release was updated from 11.18.0 to 11.21.0 within its existing range; its bundled dependency changes were reviewed. [Release notes](https://github.com/npm/cli/releases/tag/v11.21.0).

- Before: 14 advisory entries (13 high, 1 moderate).
- After: 12 advisory entries (10 high, 2 moderate), all in the semantic-release dependency graph.
- `npm audit --omit=dev`: **0 advisories**. This is the npm package's production graph. Worker runtime packages are classified as devDependencies here, so their security was also checked in the full audit; remaining entries were traced to release tooling.
- Remaining affected packages: `braces`/`micromatch` and propagated semantic-release entries, plus npm-bundled `brace-expansion`, `http-cache-semantics`, `ip-address`, `postcss-selector-parser` and `undici`.

Do not use `npm audit fix --force`: it proposes downgrading semantic-release to 15.14.0. The [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched version. Follow up when compatible upstream fixes are available; keep release configuration trusted. This review does not claim an advisory-free development toolchain or a completed release-security acceptance.

## Verification

| Check | Baseline | After fixes |
| --- | --- | --- |
| Node tests | 188 passed | 209 passed |
| Root, Worker and UI typechecks | Passed | Passed, with unused checks enabled |
| Biome | Passed | Passed |
| npm package build | Passed | Passed |
| Embedded UI build | Passed | Passed |
| Wrangler dry-run | Passed | Passed; no deployment |
| Package contents | Reviewed | Only README, license, package metadata and the two bundled binaries |

Browser checks used synthetic data in an isolated Chrome session: drive, stats and charging screens; 390 px mobile and 1280 px desktop; period changes; light/dark presentation; separate capacity charts for two vehicles. No browser errors or horizontal mobile overflow were observed. Stats and charging axe checks reported zero violations and one incomplete check each, so this is not a complete accessibility certification. The fixture harness exercises rendering, not the real MCP host bridge.

Independent review passes covered core/API/CLI, recorder/OAuth/data handling, and the integration diff. The read-only Rivian restriction remains unchanged. No real credentials were read, no live Rivian requests were made, and no deployment or release was performed. New GitHub checks still need their remote run; local green checks are not CI or production acceptance.

## Boundaries and follow-up

- The real OAuth reconnect, websocket recording, client-specific MCP Apps bridge and deployed Roadbook import require separate live acceptance. The expected Roadbook importer/spec was not found in the checked local checkout or at its default-branch spec path; only this repository's exporter is verified here.
- Stats/charging queries are date-bounded, not cardinality-bounded. Long retention and multi-vehicle accounts can return many samples; no production load measurement was performed. No unsupported retention policy or silent truncation was introduced.
- Photon and map tiles are external data flows, now documented. Rivian's API remains unofficial; fixture success cannot prove upstream schema stability.
- Cloudflare pricing and account-deletion guidance were checked against the current official docs linked in the deployment guide. Historical project deletion failures are labeled as observations, not universal platform behavior.

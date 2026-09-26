# Local Codex image persistence

Based on upstream `v0.30.7` (`0239edf38e2da653d662f31039e24ccea04c7837`).

This branch adds an optional Linux Hub fallback for generated PNGs whose CLI
session is no longer running. Upstream image retrieval uses the live CLI cache.
The fallback resolves an image ID from the requested session's persisted message,
then reads its file from the local Codex profile. It does not duplicate image
storage or modify native Codex history.

Enable only when Hub and the designated Codex runner share the same filesystem:

```text
HAPI_LOCAL_CODEX_HOME=/absolute/path/to/.codex
HAPI_LOCAL_CODEX_MACHINE_ID=<local HAPI runner machine UUID>
```

Only Codex sessions belonging to that machine are eligible. The existing
namespace/session authorization stays in place. Thread UUIDs and PNG basenames
are validated; reads reject symlinks, nonregular files and files over 25 MiB.
The Linux `/proc/self/fd` path is checked after opening the file. Missing or
unsupported images retain the existing RPC fallback. Other media types are
unchanged. Disabling these variables restores upstream behavior.

Validation with Bun 1.4.0:

```bash
bun install --frozen-lockfile
bun test hub/src/sync/localCodexImages.test.ts hub/src/web/routes/git.test.ts
bun run typecheck:hub
bun run build:single-exe
```

The focused tests cover byte-preserving reads without a live cache, compressed
message references, cross-session isolation, traversal, symlinks, invalid media
and oversized files. Deployments must also verify authenticated retrieval after
stopping a session and restarting the Hub. This branch is a local extension,
not a change already accepted upstream. The upstream AGPL-3.0 license applies.

## Automatic native-history handoff (2026-09-26)

The local working tree additionally supports importing native
`image_gen.generation` completion records as lightweight generated-image cards.
The Hub serves persisted image files for both live and imported message envelopes.
Reimport can fill missing images without duplicating existing dialogue or cards.
Existing names are retained.

`HAPI_CODEX_SAFE_IMPORT=1` makes the importer refuse a new duplicate when an
existing native identity has incompatible history, and refuse imports into active
sessions. A fallback matches the ordered user/assistant conversation across live
app-server status/replay events and appends the native suffix only. It ignores
synthetic context and collapses adjacent identical assistant replays for matching;
it does not delete or rewrite existing messages. Ambiguous targets are rejected.

The homelab repository owns the polling timer and its local state, not HAPI's
shared database. Deployed artifact: `0.30.7-slopthink.4` (Hub and Runner). It was
built from the source changes recorded in this patch series.

Validation: targeted Hub import/media tests, CLI native-transcript tests, Hub/CLI
typechecks; byte-identical downloads of ten imported PNGs on the server. The first
Lenovo-to-HAPI-to-Lenovo continuation succeeded. A further model-generated test
was blocked by account quota; Windows was not directly tested.

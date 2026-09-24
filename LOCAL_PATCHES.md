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

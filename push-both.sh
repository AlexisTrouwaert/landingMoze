#!/usr/bin/env bash
# Wrapper historique (cf. MozePlace-front) : la logique vit dans scripts/sync-remotes.mjs.
# Usage : ./push-both.sh "message de commit"
set -euo pipefail
exec node "$(cd "$(dirname "$0")" && pwd)/scripts/sync-remotes.mjs" push "$@"

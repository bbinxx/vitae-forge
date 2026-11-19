#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
    printf 'Usage: %s LEGACY_CONTAINER NEON_IMAGE NEON_ENV_FILE\n' "$0" >&2
    exit 2
fi

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
legacy_container=$1
neon_image=$2
neon_env=$3

docker exec -i "$legacy_container" python - < "$script_dir/export-firestore.py" |
    docker run --rm -i --env-file "$neon_env" \
        --mount "type=bind,src=$script_dir/import-postgres.py,dst=/tmp/import-postgres.py,readonly" \
        -e PYTHONPATH=/app --entrypoint python "$neon_image" /tmp/import-postgres.py

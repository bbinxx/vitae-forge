# Docker deployment

Build and run with Docker Engine and BuildKit (the default in modern Docker).
The image builds the React SPA and Python dependencies in separate stages, then
ships the backend, built frontend, and Python environment. TexCompiler runs
LaTeX in a separate service. npm and pip download caches speed subsequent dependency builds.
See [Docker's build guidance](https://docs.docker.com/build/building/best-practices/).

## Configuration and startup

Supply configuration at runtime; `.env` and local credential files are excluded
from the build context. For a deployed service, set `AUTH_REQUIRED=true` and a
strong, stable `JWT_SECRET`. Configure Firestore with `FIREBASE_SERVICE_ACCOUNT`
(JSON supplied as an environment value), or mount a service-account file read-only
and set `FIREBASE_CREDENTIALS_PATH` to its **container** path. The repository uses
Firestore; there is no active local database fallback. Configure R2 variables
used by `backend/core/upload.py` if uploads and cloud PDF storage are required.

Set `TEXCOMPILER_URL` to the base URL reachable from the backend container
and `TEXCOMPILER_API_TOKEN` to the service token. Keep the token in server-side
runtime configuration. The Atlas overlay joins the existing compiler network
and loads an additional environment file. Use `TEXCOMPILER_DOCKER_NETWORK` and
`TEXCOMPILER_ENV_FILE` to override its defaults.

Compose reads runtime settings from an existing `.env` file.

```bash
docker compose -f docker-compose.yml -f deploy/compose.atlas.yml up --build -d --wait
```

For a compiler endpoint reachable without the Atlas network, use the base
Compose file.

```bash
docker compose config --quiet
docker compose up --build -d --wait
docker compose ps
docker compose logs --tail=100 app
```

Open `http://localhost:5050`. Set `HOST_PORT` to change the host port; Compose keeps
the container port at 5050. It uses the built image without source bind mounts,
a persistent upload volume, an init process, dropped capabilities, and bounded
local logs. Existing host uploads are not automatically migrated into the volume.

For a standalone container:

```bash
docker build -t vitae-forge:local .
docker run -d --name vitae-forge --init --env-file .env \
  -p 5050:5050 --mount source=vitae-forge-uploads,target=/app/assets \
  --security-opt no-new-privileges:true --cap-drop ALL vitae-forge:local
```

For file-based Firebase credentials, additionally pass
`--mount type=bind,source=/absolute/host/service-account.json,target=/run/secrets/firebase.json,readonly`
and `-e FIREBASE_CREDENTIALS_PATH=/run/secrets/firebase.json`. Make the file readable
by container UID/GID 10001 without making it public. Use an equivalent read-only
volume override for Compose. Never add credentials to the Dockerfile.

## Runtime behavior and storage

- The service runs as UID/GID 10001. Uploads and exported PDFs require writable
  storage. The image honors `PORT` and Uvicorn receives termination signals directly.
- The health check requests `/login`, which must serve the built SPA successfully.
  It remains public with authentication enabled and uses the configured port.
  This is an HTTP/frontend availability check, not a Firestore or R2 readiness check.
- Uploads persist in `/app/assets` under Compose. Generated PDFs and logs in `/tmp` are ephemeral. Backend template edits are also ephemeral;
  manage durable template changes in source control or provision explicit storage.
- The bundled templates use standard fonts. Custom templates requiring additional
  fonts can bundle them as project assets. Additional TeX packages must be
  available in the compiler service.
- Base image tags receive updates, and several Python requirements are ranges.
  Builds are not fully reproducible; use tested image digests and a complete Python
  lock file if exact reproducibility is required.

## Verification

```bash
docker build --progress=plain -t vitae-forge:local .
docker run --rm --mount type=bind,src="$PWD/tests",dst=/tests,readonly \
  --entrypoint python vitae-forge:local -m unittest discover -s /tests -v
```

For a live integration check, run the synthetic verification script inside
the running backend container. The script uses its configured compiler and
writes synthetic PDF artifacts under `/tmp/vitae-remote-verification`.

```bash
docker compose exec -T -e EXPECT_NO_TEX=1 app python - < scripts/verify-texcompiler.py
```

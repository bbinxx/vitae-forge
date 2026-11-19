# Docker deployment

Build and run with Docker Engine and BuildKit (the default in modern Docker).
The image builds the React SPA and Python dependencies in separate stages, then
ships only the backend, built frontend, Python environment, and required TeX
packages. npm and pip download caches speed subsequent dependency builds.
See [Docker's build guidance](https://docs.docker.com/build/building/best-practices/).

## Configuration and startup

Supply configuration at runtime; `.env` and local credential files are excluded
from the build context. For a deployed service, set `AUTH_REQUIRED=true` and a
strong, stable `JWT_SECRET`. Set `DATABASE_URL` to the PostgreSQL connection
string, including the TLS settings supplied by Neon. The app initializes its
document table on startup. Configure the R2 variables used by
`backend/core/upload.py` for cloud uploads and PDF storage.

Compose expects an existing `.env` file containing your runtime configuration:

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

## Migrate existing Firestore data

Build the PostgreSQL image and prepare a restricted environment file containing
`DATABASE_URL`. Keep a legacy container with its Firestore credentials available
for the export. Pause writes to Firestore before the final snapshot.

```bash
scripts/migrate-firestore-to-neon.sh LEGACY_CONTAINER NEON_IMAGE NEON_ENV_FILE
```

The script streams a point-in-time snapshot directly to PostgreSQL. It preserves
document paths and JSON payloads, checks every destination row before committing,
and permits a rerun against an identical import. It aborts if the destination
contains records that differ from the snapshot. Start the PostgreSQL app with
the same `DATABASE_URL` after verification. Keep the source available for
rollback until the cutover is confirmed.

## Runtime behavior and storage

- The service runs as UID/GID 10001. `/app` remains writable because the existing
  LaTeX compiler generates temporary source files there. Do not enable a read-only
  root filesystem without first moving those writes to dedicated storage.
- The image honors `PORT` for standalone and hosted deployments. Uvicorn receives
  termination signals directly. Keep one worker unless concurrent PDF generation
  has been tested: current compiler paths and caches are shared within a container.
- The health check requests `/login`, which must serve the built SPA successfully.
  It remains public with authentication enabled and uses the configured port.
  This is an HTTP/frontend availability check, not a PostgreSQL or R2 readiness check.
- Uploads persist in `/app/assets` under Compose. Generated PDFs, compiler caches,
  and logs in `/tmp` are ephemeral. Backend template edits are also ephemeral;
  manage durable template changes in source control or provision explicit storage.
- The bundled templates use standard fonts. Custom templates requiring additional
  fonts/packages must extend the image and be tested with representative documents.
- Base image tags receive updates, and several Python requirements are ranges.
  Builds are not fully reproducible; use tested image digests and a complete Python
  lock file if exact reproducibility is required.

## Verification

```bash
docker build --progress=plain -t vitae-forge:local .
docker run --rm -i --entrypoint python vitae-forge:local < scripts/docker-smoke.py
```

The smoke check uses synthetic data without cloud credentials. It checks non-root
execution, bundled files, writable compiler paths, all three template compilations,
SPA/static routes, authentication enforcement, and a non-default port. It does not
validate live PostgreSQL/R2 or end-to-end authenticated resume workflows.

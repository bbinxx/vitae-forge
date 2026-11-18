# Docker deployment

Build and run with Docker Engine and BuildKit (the default in modern Docker).
The image builds the React SPA and Python dependencies in separate stages, then
ships only the backend, built frontend, Python environment, and required TeX
packages. npm and pip download caches speed subsequent dependency builds.
See [Docker's build guidance](https://docs.docker.com/build/building/best-practices/).

## Configuration and startup

Supply configuration at runtime; `.env` and local credential files are excluded
from the build context. For a deployed service, set `AUTH_REQUIRED=true` and a
strong, stable `JWT_SECRET`. Configure Firestore with `FIREBASE_SERVICE_ACCOUNT`
(JSON supplied as an environment value), or mount a service-account file read-only
and set `FIREBASE_CREDENTIALS_PATH` to its **container** path. The repository uses
Firestore; there is no active local database fallback. Configure R2 variables
used by `backend/core/upload.py` if uploads and cloud PDF storage are required.

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

For file-based Firebase credentials, additionally pass
`--mount type=bind,source=/absolute/host/service-account.json,target=/run/secrets/firebase.json,readonly`
and `-e FIREBASE_CREDENTIALS_PATH=/run/secrets/firebase.json`. Make the file readable
by container UID/GID 10001 without making it public. Use an equivalent read-only
volume override for Compose. Never add credentials to the Dockerfile.

## Runtime behavior and storage

- The service runs as UID/GID 10001. `/app` remains writable because the existing
  LaTeX compiler generates temporary source files there. Do not enable a read-only
  root filesystem without first moving those writes to dedicated storage.
- The image honors `PORT` for standalone and hosted deployments. Uvicorn receives
  termination signals directly. Keep one worker unless concurrent PDF generation
  has been tested: current compiler paths and caches are shared within a container.
- The health check requests `/login`, which must serve the built SPA successfully.
  It remains public with authentication enabled and uses the configured port.
  This is an HTTP/frontend availability check, not a Firestore or R2 readiness check.
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
validate live Firestore/R2 or end-to-end authenticated resume workflows.

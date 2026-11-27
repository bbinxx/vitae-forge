# Docker deployment

Build and run with Docker Engine and BuildKit (the default in modern Docker).
The image builds the React SPA and Python dependencies in separate stages, then
ships the backend, built frontend, and Python environment. TexCompiler runs
LaTeX in a separate service. npm and pip download caches speed subsequent dependency builds.
See [Docker's build guidance](https://docs.docker.com/build/building/best-practices/).

## Configuration and startup

Supply configuration at runtime; `.env` and local credential files are excluded
from the build context. For a deployed service, set `AUTH_REQUIRED=true` and a
strong, stable `JWT_SECRET`. Set `DATABASE_URL` to the PostgreSQL connection
string and keep the TLS settings supplied by Neon. Configure R2 variables
used by `backend/core/upload.py` if uploads and cloud PDF storage are required.
The [v4 migration guide](MIGRATION_V4.md) covers the Firestore data transfer
and TexCompiler setup for existing deployments.

Keep the same private `JWT_SECRET` across upgrades and replicas so existing
sessions can continue. Protected deployments require this setting at startup.
The browser uses an HttpOnly session cookie. API clients can use the bearer
token returned by the login endpoint.

The signed-in screens live at `/workspace/applications`,
`/workspace/saved-resumes`, `/workspace/templates`, and `/workspace/settings`.
Opening a workspace URL while signed out sends the browser to sign-in and
returns it to the requested screen afterward.

**Save PDF** downloads to the browser. If you configure a server export
folder, **Save to server folder** writes a separate copy on the application
host.

PostgreSQL enforces unique account usernames. Startup creates the required
index and reports an error if the database contains duplicate usernames.
Resolve conflicting accounts before retrying; the upgrade preserves
existing account IDs and password hashes.

Set `TEXCOMPILER_URL` to the base URL reachable from the backend container
and `TEXCOMPILER_API_TOKEN` to the service token. Keep the token in server-side
runtime configuration. The Atlas overlay joins the existing compiler network
and loads an additional environment file. Use `TEXCOMPILER_DOCKER_NETWORK` and
`TEXCOMPILER_ENV_FILE` to override its defaults.

Copy [`.env.example`](../.env.example) to `.env` for a fresh installation,
restrict its permissions, and fill in the runtime values.

```bash
cp -n .env.example .env
chmod 600 .env
```

For Atlas, use the overlay to reach the compiler on its Docker network.

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

## Runtime behavior and storage

- The service runs as UID/GID 10001. Uploads and exported PDFs require writable
  storage. The image honors `PORT` and Uvicorn receives termination signals directly.
- The health check requests `/login`, which must serve the built SPA successfully.
  It remains public with authentication enabled and uses the configured port.
  This is an HTTP/frontend availability check, not a PostgreSQL or R2 readiness check.
- Uploads persist in `/app/assets` under Compose. Generated PDFs and logs in
  `/tmp` are ephemeral. Templates saved from the workspace are stored per
  account in PostgreSQL. The bundled templates are the defaults for accounts
  without an override.
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

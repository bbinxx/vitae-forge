# Upgrade Vitae Forge to v4

Vitae Forge v4 uses PostgreSQL for application data and TexCompiler for PDF
compilation. The backend still serves the app, handles sign-in, and builds
LaTeX projects. Existing R2 objects and Docker upload volumes stay in their
current storage.

## Prepare the target

- Create a PostgreSQL database or Neon branch. Give the application role access
  to create and maintain its table and index. Use a database dedicated to Vitae Forge.
- Put the PostgreSQL connection string in a restricted environment file as
  `DATABASE_URL`. Keep the TLS options supplied by Neon.
- Configure `TEXCOMPILER_URL` and `TEXCOMPILER_API_TOKEN` from your TexCompiler
  deployment. Check that its `/ready` endpoint returns HTTP 200 from the app network.
- Retain the existing `JWT_SECRET`, upload volume, R2 configuration, and legacy
  app image for recovery. Keep credentials out of Git and terminal output.

## Migrate Firestore

Build the v4 image and keep a legacy container available with the Firebase SDK
and its existing Firestore credentials. Pause writes on **all** Firestore-backed
Vitae Forge instances before the final snapshot. The legacy container used for
the export only needs to run Python and reach Firestore.

```bash
docker build -t vitae-forge:v4 .
bash scripts/migrate-firestore-to-neon.sh LEGACY_CONTAINER vitae-forge:v4 NEON_ENV_FILE
```

The script streams a point-in-time snapshot of all collections, including nested
documents, into a PostgreSQL transaction. It preserves document paths and JSON
payloads. Firestore timestamps are represented as ISO 8601 strings. The importer
compares all rows with the source snapshot before committing. Identical reruns
are safe. If rows differ, investigate the source changes or use a fresh Neon
branch for the final copy. The script reports counts and keeps documents out of
the terminal and local export files.

The verified transfer copied **635 documents across 15 collection types**.
Database mutations were tested with synthetic records in a transaction that
rolled back.

## Start and verify v4

Add `DATABASE_URL`, `TEXCOMPILER_URL`, and `TEXCOMPILER_API_TOKEN` to the
app's runtime environment. Remove the Firebase credential variables from the
v4 environment and preserve the old environment securely for recovery.

```bash
docker compose up -d --build --wait
docker compose exec -T -e EXPECT_NO_TEX=1 app python - < scripts/verify-texcompiler.py
```

Check that an existing account can sign in and open its saved resumes,
application history, and checkpoints. The synthetic PDF check covers plain and
photo resumes, cover letters, and direct, folder, bookmark, and application
exports. The optional custom-font check takes a mounted TTF via
`TEXCOMPILER_TEST_FONT`. See [Docker deployment](DOCKER_DEPLOYMENT.md) for host
and network configuration.

## Recover after a failed cutover

If the upgrade fails before the new app accepts writes, restore the legacy app
image and its original environment. After writes reach PostgreSQL, pause the
app and reconcile those changes before switching back to Firestore. Keep the
Firestore source available until the PostgreSQL deployment has been verified.

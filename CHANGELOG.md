# Changelog

## v4.0.0

### Deployment changes

- Set `DATABASE_URL` to use PostgreSQL or Neon for application storage. Existing
  installations must migrate their Firestore data before switching.
- Set `TEXCOMPILER_URL` and `TEXCOMPILER_API_TOKEN` for PDF previews and exports.
  The application image ships without a TeX distribution.
- Follow the [v4 migration guide](docs/MIGRATION_V4.md) for configuration,
  verification, and recovery.

### Data and documents

- Preserve user IDs, password hashes, resume JSON, application versions,
  checkpoints, bookmarks, and settings during the Firestore import.
- Keep raw LaTeX and source ZIP downloads available independently of the compiler.
  Source ZIPs can include project assets such as images, fonts, and nested TeX files.
- Route resume and cover-letter previews and exports through TexCompiler.
  Map upstream authentication and timeout errors to application errors.

### Operational changes

- Keep PostgreSQL and TexCompiler credentials in backend runtime configuration.
- Add a migration command that verifies imported data before committing and rejects
  destination rows that differ from the snapshot.
- Remove the legacy tag workflow that built resumes locally and uploaded them to R2.
  Version tags publish the application container through the CD workflow.

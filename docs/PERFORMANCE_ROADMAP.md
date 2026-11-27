# Performance roadmap

Keep the React frontend and optimize data loading before deciding whether to
move any part of Vitae Forge to Rust. The priorities below are based on the
current code. Use measurements to confirm where the time goes.

## Establish a baseline

- Measure cold and warm time to the first visible application row. Use the
  same synthetic dataset, browser, network profile, and deployment region
  for each comparison.
- Record API p50 and p95, PostgreSQL connection setup time, query count, and
  the size of the initial application response.
- Measure time to the first PDF separately from page load. Break it down
  into preview request time, TexCompiler time, and browser rendering time.

## Priority changes

1. **Batch database reads and reuse connections.** The personal, library, and
   recipe documents needed by `/get-config` now load in one query. The API
   keeps a bounded PostgreSQL connection pool open for the worker lifetime.
   [PostgreSQL repository](../backend/db/postgres_repo.py) ·
   [Resume service](../backend/services/resume_service.py)
2. **Reduce the initial application payload.** Return a paginated list of
   summary fields. Load full resume JSON and version history when a record
   opens. Deduplicate in-flight reads, scope caches to the signed-in user,
   and invalidate affected entries after updates. Check that server-side
   filters and sorting still work across all pages.
   [Frontend API client](../frontend/src/services/api.ts)
3. **Load frontend code by screen.** Settings, Templates, and Saved Resumes
   now load on demand. Measure the impact on the time to the first visible
   application row. [App entry point](../frontend/src/App.tsx)
4. **Reduce duplicate PDF preview work.** Each open preview allows one
   compile request at a time. Save PDF reuses the preview for the matching
   draft, document type, and photo selection. Measure further gains before
   adding longer-lived caching. Any longer-lived cache must account for
   template and profile photo changes.
   [Live PDF preview](../frontend/src/components/common/LivePdfPreview.tsx)

## Initial measurements

In six read-only samples per variant using an empty synthetic user on Neon,
the median repository read fell from 7.38 seconds to 2.53 seconds after batching
and to 261 ms with a warm pool and single-statement transactions. These timings
cover the PostgreSQL repository call. Browser startup and larger resume payloads
still need separate measurements.

The initial production JavaScript fell from 68,613 to 58,543 gzip bytes after
splitting secondary screens, a reduction of about 15%.

After sign-in, the app navigates to the workspace in the same document and
uses the authenticated login response. Direct workspace visits still verify
the session before showing cached data.

## Where Rust fits

Consider Rust compiled to WebAssembly for an isolated browser task only
after a profile shows CPU time dominating, such as validation of very
large imports. Compare the complete interaction, including module load and
data transfer overhead.

If removing Python becomes a separate goal, migrate the API to Rust in
stages after the database and loading improvements. Preserve the API
contract and compare both implementations with the same queries, data,
and deployment configuration.

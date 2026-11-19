# Neon PostgreSQL Migration Plan

- [x] Preserve repository behavior, document IDs, user isolation, password hashes, and resume JSON in PostgreSQL.
- [x] Export Firestore documents recursively over a pipe and compare a second traversal before committing the import.
- [x] Reject conflicting destination rows and verify that PostgreSQL can read back every imported record.
- [x] Build and test the PostgreSQL-backed app. Remove Firebase from its runtime and retain the Firestore source for rollback until cutover is verified.

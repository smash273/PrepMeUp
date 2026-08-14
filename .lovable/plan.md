# Reverse-Engineering Documentation for PrepMeUp

Goal: produce a complete, granular technical reverse-engineering document of the existing app so it can be rebuilt from scratch elsewhere. No application code will be changed.

## What will be produced

A `docs/` folder in the repo, written from a full read of every source file, migration, and edge function. Split into numbered files so each stays readable, plus one consolidated blueprint:

```text
docs/
├── 00-executive-overview.md
├── 01-tech-stack.md
├── 02-system-architecture.md        (Mermaid diagram + component breakdown)
├── 03-frontend-architecture.md      (12 pages, 4 feature components, shadcn UI layer)
├── 04-user-flows.md                 (happy path + every failure branch)
├── 05-features.md                   (feature-by-feature template inventory)
├── 06-api-and-edge-functions.md     (3 edge functions + all PostgREST calls)
├── 07-database.md                   (schema tables, ER diagram, RLS, triggers, enums)
├── 08-data-flows-and-lifecycle.md
├── 09-auth-and-authorization.md
├── 10-security-analysis.md          (existing vs recommended, evidence-based)
├── 11-state-forms-errors.md
├── 12-storage-and-files.md          (5 buckets, upload/download/signed URLs)
├── 13-integrations-config-deploy.md (Lovable AI Gateway/Gemini, Resend, YouTube embed, env vars)
├── 14-performance-and-uiux.md
├── 15-feature-matrix.md
├── 16-file-tree.md
├── 17-strengths-weaknesses.md
├── 18-rebuild-recommendations.md    (current → recommended → why)
├── 19-preserve-and-improve.md       (PRESERVE list; IMPROVE list prioritised 🔴🟠🟡🟢)
├── 20-rebuild-blueprint.md          (Phases 1–12 with pitfalls + verification criteria)
└── COMPLETE-SYSTEM-BLUEPRINT.md     (single consolidated view)
```

## Sources of truth used

- All 12 pages under `src/pages/`, 4 feature components under `src/components/`, `src/App.tsx`, `src/integrations/supabase/`, `src/index.css` + `tailwind.config.ts` for the design system.
- The 3 edge functions: `generate-study-content`, `generate-mock-paper`, `evaluate-answer-sheet` — each documented line-by-line for prompts, model calls, JSON schemas, DB writes, and error paths.
- The 3 SQL migrations plus live schema (tables, enums `question_type` / `resource_type` / `test_status`, RLS policies, triggers, functions).
- Live database inspection (read-only queries) to confirm RLS state, grants, and which tables are actually populated versus vestigial (e.g. `test_attempts`/`test_answers` vs `user_test_attempts`, `verification_codes`).
- Storage bucket configuration, `package.json`, `vite.config.ts`, `supabase/config.toml`, `.env` variable names (names only, never values).

## Documentation rules followed

- Every claim traced to a file path and line range. Inferences labelled `INFERENCE`. Anything not determinable from the repo or database labelled `UNKNOWN / NOT OBSERVABLE` (e.g. CI/CD internals, Lovable hosting internals, Auth provider settings not exposed in code).
- No secret values printed — variable names and purposes only.
- Mermaid used for the architecture diagram, ER diagram, and key sequence flows.
- Known-real quirks documented rather than glossed over: client-side PDF text extraction with `pdfjs-dist`, the duplicated test-attempt data models, evaluation tables with permissive service policies, YouTube playback via `youtube-nocookie` embeds with no API key, PDF/PPT note export via `jspdf`/`pptxgenjs`.

## Technical notes

- Work is read-only: file reads plus read-only SQL queries. No schema, function, or app-code changes.
- Parallel sub-agents will read separate areas (frontend pages, edge functions, database/storage, config/deploy) and their findings will be reconciled into the docs above.
- Estimated output: a long-form document set; the consolidated blueprint at the end repeats the essentials so it can be handed over standalone.

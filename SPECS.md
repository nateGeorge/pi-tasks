# Specifications

| id | requirement | status | evidence |
| --- | --- | --- | --- |
| GA-1 | A broad verb must not reject a plan field that names a concrete file, flag, code token, or symbol; retain rejection when no concrete anchor is named. | done | `test/unit/reducer.test.ts` covers `e.g.`, `i.e.`, and a real `.ts` path; `npm test` passed (106 tests), `npm run check`, `npm run typecheck`, and `npm run build` passed. |
| GA-2 | Missing `allowedActions` and conjunctions joining nouns or subordinate clauses must not trigger the compound-action gate; every second action or passive outcome across conjunctions must be rejected, including compound `allowedActions`. | done | `test/unit/reducer.test.ts` covers later conjunctions, passive noun-phrase outcomes, noun/adjective controls, and compound and noun-list `allowedActions`; `npm test` passed (106 tests), `npm run check`, `npm run typecheck`, and `npm run build` passed. |
| GA-3 | A pinned Pi git install must load the tracked TypeScript extension and register `/tasks`; npm packages retain built JS and types. | done | `npm run test:install-smoke` performed a fresh pinned-git install under temporary `PI_CODING_AGENT_DIR` and RPC `get_commands` confirmed `/tasks`; `npm pack --dry-run` included `index.ts`, `src/`, and built `dist/`. |

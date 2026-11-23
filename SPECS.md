# Specifications

| id | requirement | status | evidence |
| --- | --- | --- | --- |
| GA-1 | A broad verb must not reject a plan field that names a concrete file, flag, code token, or symbol; retain rejection when no concrete anchor is named. | done | `test/unit/reducer.test.ts` anchor acceptance and vague rejection cases; `npm test` 98 passed, `npm run typecheck`, `npm run check`, `npm run build`, and native Pi tests 7 passed at `f02427e`. |
| GA-2 | Missing `allowedActions` and conjunctions joining nouns or subordinate clauses must not trigger the compound-action gate; actual second actions remain rejected. | done | `test/unit/reducer.test.ts` missing-actions and conjunction cases; `npm test` 98 passed, `npm run typecheck`, `npm run check`, `npm run build`, and native Pi tests 7 passed at `f02427e`. |

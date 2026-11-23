# Specifications

| id | requirement | status | evidence |
| --- | --- | --- | --- |
| GA-1 | A broad verb must not reject a plan field that names a concrete file, flag, code token, or symbol; retain rejection when no concrete anchor is named. | doing | PR #2 second fix: add regressions proving `e.g.` and `i.e.` are not file anchors while real extensions remain anchors; rerun all required checks. |
| GA-2 | Missing `allowedActions` and conjunctions joining nouns or subordinate clauses must not trigger the compound-action gate; every second action or passive outcome across conjunctions must be rejected, including compound `allowedActions`. | doing | PR #2 second fix: cover later conjunctions, passive noun-phrase outcomes, adjectival noun lists, and compound and noun-list `allowedActions`; rerun all required checks. |
| GA-3 | A pinned Pi git install must load the tracked TypeScript extension and register `/tasks`; npm packages retain built JS and types. | doing | Add a fresh temporary `PI_CODING_AGENT_DIR` install smoke test and include `index.ts`, `src/`, and `dist/` in npm files; run it against the pushed PR #2 commit. |

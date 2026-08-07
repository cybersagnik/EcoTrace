# tests/

Structure only — no runner wired up yet. Add Vitest or Jest config when
real test coverage starts (suggested: Vitest, since it needs no extra
config for the TS path aliases already in tsconfig.json).

- unit/        pure functions (utils/, lib/) — start here
- integration/ hooks + services against mocked fetch
- e2e/         Playwright/Cypress against a running dev server

## Pending work

Start here on a new machine or in the cloud: `docs/agents/NEXT_SESSION.md` holds the current state, the rules, the wallets (addresses only; keys are never in git), the task list and a progress log.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (zuemen/mandate-layer), via the `gh` CLI. **Never create, comment on, or edit issues in the original repo zuemen/pepelab_onchain_cfd** — this is a competition-only import. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context layout — CONTEXT-MAP.md at root, per-context CONTEXT.md under agent/, contracts/, frontend/, web/. See `docs/agents/domain.md`.

### Environment setup

Sandboxed shells only write for real **inside the project directory** — global installs (`winget`, `npm i -g`, `foundryup`) silently fail while still reporting success, so hand those to the user instead of running and verifying them. Bootstrap order, per-directory package manager (frontend = yarn only, agent = npm only), and Windows/Git Bash gotchas: `docs/agents/environment.md`.

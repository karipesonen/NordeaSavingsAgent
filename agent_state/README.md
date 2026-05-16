# Agent State — the "closed box"

The demo agent's runtime memory. This is **not** Claude Code's memory and **not** the build-process notes in `../notes/`. This is the storage that the *built agent* reads and writes as it runs.

Treat it as a closed box:

- Wipe between test runs so the demo starts from a clean state.
- Keep it file-based at first (JSON/SQLite) — easy to inspect, easy to reset.
- One folder per persona/session if you want parallel "accounts".

Planned structure (once the agent is running):

```
agent_state/
├── <session_id>/
│   ├── user_profile.json      Stated preferences, risk comfort, goals
│   ├── derived_state.json     Agent's interpretation (safe-to-save, readiness level, …)
│   ├── conversation.jsonl     Full dialog history
│   └── action_log.jsonl       Proposed actions, user approvals/rejections
```

## Reset

To start a fresh demo: delete the session folder. Everything about "what the agent remembers" lives here — nothing leaks into the codebase.

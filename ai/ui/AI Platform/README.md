# AgentForge with local Codex

The Requirements, PM, Architect, and UI/UX agents all use your signed-in local Codex CLI. Supabase stores projects, messages, and generated artifacts. No OpenAI API key is needed by this app.

Run these in separate terminals:

```sh
codex login
npm run dev:codex
npm run dev
```

Open the Vite URL. Describe a product idea, review the generated PRD, and type **approve** to proceed through the stages. The React app calls `/api/codex/chat`; Vite proxies it to the loopback runner at `127.0.0.1:8787`. The runner invokes Codex in read-only mode. The Vite proxy and runner are intended for local development; a deployed build needs a hosted backend with appropriate access control.

The runner searches your `PATH` and common Codex desktop app locations for the CLI. If it is installed elsewhere, start the runner with `CODEX_CLI_PATH=/absolute/path/to/codex npm run dev:codex`.

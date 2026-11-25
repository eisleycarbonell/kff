# Backend & Frontend Repository Separation Guide

`backend/` and `frontend/` are separate Git repositories containing **application code and minimal developer READMEs only**.

All AI instructions, skills, architecture guides, API contracts, and business specifications live **outside** both app folders at the workspace root (`AGENTS.md`, `CLAUDE.md`, `docs/`, `.agents/skills/`, `skills-lock.json`, `kff.cmd`, `scripts/`). Both `backend/.gitignore` and `frontend/.gitignore` explicitly ignore `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.agents/`, `skills-lock.json`, and `docs/` so AI/doc files are never committed or pushed to Git.

---

## 1. Where everything lives

| Concern | Location | Pushed to app Git? |
| --- | --- | --- |
| App quickstart & scripts | [backend/README.md](../backend/README.md), [frontend/README.md](../frontend/README.md) | Yes |
| Env templates | `backend/.env.example`, `frontend/.env.example` | Yes |
| Backend DB/test `.cmd` launchers | [backend/start-test-backend.cmd](../backend/start-test-backend.cmd), [backend/load-sample-data.cmd](../backend/load-sample-data.cmd), [backend/rebuild-test-database.cmd](../backend/rebuild-test-database.cmd), [backend/fresh-start.cmd](../backend/fresh-start.cmd) | Yes |
| Workspace launcher & doc check | [kff.cmd](../kff.cmd), [scripts/check-docs.ps1](../scripts/check-docs.ps1) | No (workspace root) |
| AI entrypoints | [AGENTS.md](../AGENTS.md), [CLAUDE.md](../CLAUDE.md) | No (workspace root) |
| App rules & architecture | [backend-rules.md](backend-rules.md), [backend-architecture.md](backend-architecture.md), [frontend-rules.md](frontend-rules.md), [frontend-architecture.md](frontend-architecture.md) | No (`docs/`) |
| Shared API contract & specs | [api-contract.md](api-contract.md), [business-rules.md](business-rules.md), [system-flow.md](system-flow.md), module specs in `docs/` | No (`docs/`) |
| AI skills | `../.agents/skills/` (17 skills) & [skills-lock.json](../skills-lock.json) | No (workspace root) |

---

## 2. Pushing the two app repositories

Run `.\kff.cmd check-docs` first to confirm zero AI/doc files sit inside `backend/` or `frontend/`. Then commit and push each repo independently:

```bash
cd backend  && git status && git add . && git commit -m "Backend update"  && git push origin main
cd ../frontend && git status && git add . && git commit -m "Frontend update" && git push origin main
```

Never commit `.env`, `.env.local`, `node_modules/`, `dist/`, `.next/`, or `.turbo/`.

---

## 3. Environment wiring across deployments

| Environment | Backend `.env` | Frontend `.env` / hosting env |
| --- | --- | --- |
| **Local development** | `PORT=3001`, `CORS_ORIGIN=http://localhost:3000`, `COOKIE_SAME_SITE=strict`, `REALTIME_ENABLED=true` | `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api` |
| **Production proxy mode (recommended)** | `CORS_ORIGIN=https://app.example.com`, `COOKIE_SAME_SITE=strict` (or `lax`), `REALTIME_ENABLED=true` | `BACKEND_URL=https://api.example.com`, `NEXT_PUBLIC_API_BASE_URL=/api`, `NEXT_PUBLIC_SOCKET_URL=https://api.example.com` |
| **Production direct CORS** | `CORS_ORIGIN=https://app.example.com`, `COOKIE_SAME_SITE=none` (requires HTTPS) | `NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api` |
| **Vercel serverless backend** | `REALTIME_ENABLED=false` + `CORS_ORIGIN=https://app.example.com` | Either proxy mode (`BACKEND_URL`) or direct CORS; 30s polling activates automatically |

---

## 4. Working with AI agents across both repos

Always open the workspace at **`c:\kff`** (the parent folder containing `backend/`, `frontend/`, `docs/`, `AGENTS.md`, and `.agents/skills/`). That way:
1. AI assistants automatically load root `AGENTS.md` + `.agents/skills/` and can read `docs/backend-rules.md`, `docs/frontend-rules.md`, `docs/api-contract.md`, and both apps together (`kff-fullstack-feature`).
2. `backend/` and `frontend/` remain clean application repositories with no AI instructions or docs pushed to Git.

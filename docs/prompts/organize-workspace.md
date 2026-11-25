# Reusable Prompt: Organize Rules, Docs, Skills & Launchers

Copy and paste the prompt below whenever you add new modules, want to audit
for duplicated instructions, or check that AI/doc files stay outside `backend/`
and `frontend/`:

```text
Audit and organize this KFF workspace (root, backend/, and frontend/) so AI
agents find clear, non-overlapping instructions, AI/docs stay outside the Git
app repos, and scripts are simple to run:

1. Read first:
   - Root AGENTS.md, CLAUDE.md, README.md, and docs/README.md
   - docs/business-rules.md, docs/api-contract.md, and docs/repo-separation-guide.md
   - docs/backend-rules.md, docs/backend-architecture.md, docs/frontend-rules.md, docs/frontend-architecture.md
   - All SKILL.md files under .agents/skills/

2. Enforce the clean separation & single-source hierarchy:
   - Keep backend/ and frontend/ free of AGENTS.md, CLAUDE.md, GEMINI.md, .agents/, skills-lock.json, and docs/ (and keep them listed in both .gitignore files).
   - docs/business-rules.md: shared domain rules only.
   - docs/system-flow.md: canonical 26-section business spec (preserve all 26 sections and examples).
   - docs/api-contract.md: single REST + Socket.IO + cross-repo handoff contract.
   - Root AGENTS.md: workspace map, read order, task routing, golden rules, commands.
   - docs/backend-rules.md & docs/frontend-rules.md: app-specific implementation, stack, module pattern, boundaries, and verification only.
   - .agents/skills/*/SKILL.md: concise procedural runbooks pointing to docs/ instead of duplicating rule paragraphs.

3. Check clarity & remove unnecessary files:
   - Flag or remove stale backups, dead debug scripts, unused migration boilerplate, obsolete skill entries, and redundant doc summaries.
   - Ensure every reference in AGENTS.md, README.md, docs/, and SKILL.md points to an actual file/heading and matches the current codebase.
   - Keep the 3 backend DB/test .cmd launchers inside backend/ and root kff.cmd + scripts/ at workspace root.

4. Verify everything:
   - Run `.\kff.cmd check-docs` to confirm 0 AI/doc files inside backend/ or frontend/ and 0 broken Markdown links.
   - Run `.\kff.cmd verify` to confirm doc checks, backend typecheck/tests, and frontend typecheck/lint/tests pass.
```

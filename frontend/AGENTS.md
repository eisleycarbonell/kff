<!-- intent-skills:start -->
## Skill Loading

Before editing files for a substantial task:
- Run `npx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `npx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# Project Rules — Inventory Micro Service (Frontend)

## Tech Stack
- **Framework**: Next.js App Router (TypeScript)
- **Styling**: Tailwind CSS v4
- **Component library**: shadcn/ui (`style: base-nova`) — ALWAYS use shadcn components first. Install with `npx shadcn@latest add <component> --yes`. Never build a UI primitive from scratch if shadcn has it.
- **Animation**: GSAP + `@gsap/react`
- **Icons**: `lucide-react`

## Folder Structure — STRICTLY FOLLOW THIS

```
frontend/
└── src/
    ├── app/
    │   ├── layout.tsx                     # Root layout
    │   ├── globals.css
    │   ├── page.tsx                       # Login (public) → /
    │   │
    │   ├── (protected)/                   # Authenticated routes (group adds no URL segment)
    │   │   ├── layout.tsx                 # Shared app shell (sidebar + header)
    │   │   ├── dashboard/
    │   │   │   └── page.tsx               # → /dashboard
    │   │   ├── users/
    │   │   │   └── page.tsx               # → /users
    │   │   ├── inventory/
    │   │   │   └── page.tsx               # → /inventory
    │   │   ├── reports/
    │   │   │   └── page.tsx               # → /reports
    │   │   └── settings/
    │   │       └── page.tsx               # → /settings
    │   │
    │   └── api/
    │       └── ...
    │
    ├── components/
    │   ├── ui/                            # shadcn components (generated)
    │   │
    │   ├── layout/                        # App shell UI
    │   │   ├── app-sidebar.tsx
    │   │   ├── nav-main.tsx
    │   │   ├── nav-project.tsx
    │   │   ├── nav-user.tsx
    │   │   └── top-header.tsx
    │   │
    │   ├── shared/                        # Reusable, feature-agnostic components
    │   │   ├── data-table.tsx
    │   │   └── loading.tsx
    │   │
    │   └── modules/                       # Feature-specific code
    │       ├── users/
    │       │   ├── user-table.tsx
    │       │   ├── user-form.tsx
    │       │   ├── user.api.ts
    │       │   └── user.schema.ts
    │       ├── inventory/
    │       │   ├── inventory-table.tsx
    │       │   ├── inventory-form.tsx
    │       │   ├── inventory.api.ts
    │       │   └── inventory.schema.ts
    │       ├── reports/
    │       │   ├── reports-table.tsx
    │       │   └── reports.api.ts
    │       └── settings/
    │           ├── settings-form.tsx
    │           └── settings.schema.ts
    │
    ├── hooks/
    │   ├── use-mobile.ts
    │   └── use-landing-animation.ts
    │
    ├── lib/
    │   ├── db.ts
    │   ├── auth.ts
    │   └── utils.ts
    │
    ├── providers/
    │   ├── query-provider.tsx
    │   ├── theme-provider.tsx
    │   └── session-provider.tsx
    │
    └── types/
        └── index.ts
```

## Rules

1. **`app/` is for routing only.** Pages import from `components/`, `hooks/`, `lib/`. No business logic lives directly in page files beyond route wiring.

2. **`components/ui/`** is owned by shadcn. Never place custom components here. Never edit these files manually unless fixing a dark-mode or type error.

3. **`components/layout/`** holds only the app shell (sidebar, nav, header) used by `(protected)/layout.tsx`.

4. **`components/shared/`** holds reusable components with no feature-specific logic. If it's only used by one feature, it belongs in `components/modules/<feature>/`.

5. **`components/modules/<feature>/`** owns everything for that feature: components, `*.api.ts` (data fetching), and `*.schema.ts` (validation/types). Features must not import from each other — promote shared code to `components/shared/`, `lib/`, or `types/`.

6. **New routes** that require auth go inside `app/(protected)/`. Public routes go directly under `app/`.

7. **Naming**: all file names use `kebab-case` (e.g. `app-sidebar.tsx`, `use-mobile.ts`), matching shadcn conventions. Exported components use `PascalCase`.

8. **Imports** use the `@/` alias (e.g. `@/components/ui/button`), never long relative paths.

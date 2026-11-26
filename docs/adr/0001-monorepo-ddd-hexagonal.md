# ADR 0001 - Monorepo with DDD and hexagonal layering

**Status:** accepted

**Context.** The product starts small (quote + contact flow) but must be able to swap storage
(XLSX -> PostgreSQL), geocoding providers and later add an admin portal.

**Decision.** npm workspaces monorepo: `shared`, `domain`, `application`, `infrastructure`
packages plus `apps/api` and `apps/web`. Dependencies point inward; ports (repository and
provider interfaces) live in `application`; adapters live in `infrastructure`; the API's
composition root wires them. Packages ship TypeScript sources (`main` -> `src/index.ts`) and are
bundled by `tsup` (API) and Vite (web), so there is no separate package build step.

**Consequences.** More files than a single app, but storage and providers are replaceable
without touching domain code; rules are enforced by ESLint and an architecture test. The web
app may depend only on `shared`, so it cannot accidentally import server code.

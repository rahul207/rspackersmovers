# ADR 0003 - Fastify with Zod validated in handlers

**Status:** accepted

**Context.** The same validation rules must run in the browser and on the server, and the API
needs OpenAPI documentation.

**Decision.** Fastify 5. Zod schemas live in `@rs/shared` and are used by both sides. The server
validates inside handlers (`parseWith`) so error shapes (`fieldErrors`) are fully controlled;
Fastify's own schema validation is disabled and route `schema` objects are generated from the Zod
schemas (`z.toJSONSchema`) purely for OpenAPI/Swagger UI.

**Consequences.** One source of truth for validation and docs, no dependence on a type-provider
package version. Documentation can theoretically drift from behaviour only if a route forgets to
use the same schema - the pattern is uniform in `apps/api/src/contexts/*`.

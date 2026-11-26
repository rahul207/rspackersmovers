# ADR 0004 - Consent enforced by signed cookies; CSRF via signed double submit

**Status:** accepted

**Context.** Analytics must not run without consent, and a client-supplied flag can be forged.
Forms post to a same-origin API and need CSRF protection without server-side sessions.

**Decision.** `POST /consents` records the decision and sets signed, HttpOnly, SameSite cookies
(`rs_consent`, `rs_vid`). The analytics endpoint trusts only those cookies. CSRF: a signed cookie
holds a random nonce; clients echo `nonce.HMAC(nonce)` in `X-CSRF-Token`; `Origin` is also
checked against the allowlist. Quotation/contact consent is a separate record with all optional
categories denied.

**Consequences.** Stateless and simple; the SPA must fetch `/config/public` first. A visitor
who clears cookies is treated as having no consent (safe default).

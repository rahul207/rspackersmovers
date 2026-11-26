# ADR 0002 - XLSX as temporary storage behind repository ports

**Status:** accepted (temporary)

**Context.** The business wants quotes and enquiries in spreadsheets immediately, with no
database to operate.

**Decision.** Implement the repository ports with ExcelJS-backed adapters. Safeguards: per-file
process mutex, atomic temp-file + rename writes, formula-injection escaping, rotating backups,
refusal to overwrite unreadable files, retention purge.

**Consequences.** Not transactional, O(n) per write, single instance only, no cross-workbook
atomicity. Accepted for a low-volume first release. The same ports will be implemented on
PostgreSQL (placeholders and a mapping guide exist). Revisit when volume, concurrency, reporting
needs or an admin portal arrive.

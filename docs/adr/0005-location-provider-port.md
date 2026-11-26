# ADR 0005 - Location search behind a provider port; approximate distance

**Status:** accepted

**Context.** Pickup/drop need coordinates; API keys must not reach the browser; the public
Nominatim service forbids heavy/autocomplete use; no routing provider has been chosen; and India's
smaller localities, villages and PIN codes are patchily indexed by any single free source.

**Decision.** `LocationSearchProvider` port with adapters: `india` (default - a keyless waterfall
that tries Photon, then Open-Meteo/GeoNames, then a throttled Nominatim, then the India Post
PIN/post-office directory, then a relaxed-query retry, before a clearly-labelled approximate
fallback at India's centroid, so a search practically never comes back empty), `photon` alone
(keyless, fair use), `locationiq` (Nominatim-grade data purpose-built for autocomplete, free tier
with signup, noticeably better coverage of Indian localities/neighbourhoods), `google` (Geocoding
API, server-side key) and `static` (offline cities for dev/tests). The browser calls
`/api/v1/locations/*`; query text and coordinates are never logged. Distance = straight line x
`roadDistanceFactor`, always labelled approximate; the animation is labelled "Illustration only -
not a driving route".

**Consequences.** No key exposure and easy provider swaps. The `india` waterfall trades a little
latency (worst case, several sequential upstream calls) for coverage; every result carries a
`confidence` (high/medium/approximate/none) so low-confidence results (resolved only to a
district, or the final country-centroid fallback) can be told apart from a precise match.
Distance can still differ from real driving distance; operations confirm the final quote. A
routing adapter (OSRM/Google Routes) can later implement the same seam.

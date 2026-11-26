# ADR 0006 - Selective, lazy-loaded 3D with an SVG baseline

**Status:** accepted

**Context.** A 3D scene adds engagement but costs bytes, CPU and accessibility risk, and the
booking form must never be delayed.

**Decision.** The SVG road/vehicle scene is the real, accessible implementation and the fallback.
A three.js layer is a separate chunk loaded only when the figure is visible and the browser is
idle, WebGL works, motion is not reduced and the device is not low-power (cores, memory,
save-data). It renders only while something moves, pauses off-screen/hidden, caps pixel ratio,
disposes everything on unmount and falls back to SVG on context loss.

**Consequences.** The 3D chunk is large (~220 KB gzip) but never in the initial bundle. Plain
three.js is used (not React Three Fiber) to save weight.

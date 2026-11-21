# Trace-X implementation checklist

This checklist distinguishes implemented features from verification. A checked feature is not a claim of production readiness. Use synthetic data only.

## Checkpoint 1 — Working investigation foundation

- [x] Local TypeScript application, React interface and SQLite case store.
- [x] Two synthetic cases with planted split/converging transfers and a benign salary comparison.
- [x] PDF, XLSX and CSV table extraction with column mapping and explicit review.
- [x] Original file retention, SHA-256, source row references, reviewed corrections and exclusions.
- [x] Deterministic risk explanations and chronological UTR-based candidate tracing.
- [x] Interactive graph, timeline controls, account/transfer/source inspectors.
- [x] Passive public intelligence adapters with timestamped sources and unavailable states.
- [x] Exact cross-case matches, notes, configurable rules and local activity log.
- [x] Generated PDF/Excel reports and editable request drafts.
- [x] First verification: 21 analysis/parser/API tests and two browser workflow checks passed.

What this delivers: a working end-to-end local investigation, rather than disconnected mock screens.

## Checkpoint 2 — Readability and investigator workflow

- [x] Refine the dashboard into a distinctive case-file view with a coherent investigation narrative.
- [x] Improve graph edge-label readability, selection feedback and narrow-screen navigation.
- [x] Check keyboard interactions, focus behaviour and field validation.
- [x] Verify new-case creation, new source evidence and submitted indicator associations.
- [x] Resolve validation edge cases found during review, including precision and ambiguous records.
- [x] Inspect desktop and mobile screens after the final changes.

Acceptance: an investigator can explain every displayed figure, follow the trail and open its evidence without guessing what an interaction does.

## Checkpoint 3 — Exports and submission artifact

- [x] Generate a self-contained HTML preview with embedded synthetic fixtures and local fonts.
- [x] Verify the generated HTML with the network disabled, including navigation and source entry.
- [x] Re-render the report after fixing an orphaned section heading; inspect every page.
- [x] Reopen the Excel export and verify its six sheets and 17 demo transactions.
- [x] Exercise live public lookup adapters with example.com and 1.1.1.1. RDAP/DNS/network observations returned; CT timeout was correctly retained as unavailable.
- [x] Finish the demo instructions, architecture notes and known-limitations review.

Acceptance: submission HTML works by itself; generated reports are legible and agree with the on-screen findings. Live-data limitations remain visible.

## Checkpoint 4 — Final verification and Git handoff

- [x] Final verification: 24 analysis/parser/API tests, four browser checks, TypeScript checking and production build passed. The standalone HTML also passed with networking disabled.
- [x] Resolve known dependency advisories; installation audit reports zero vulnerabilities.
- [x] Verify that secrets, uploads, databases, dependencies and test artifacts are excluded from Git.
- [x] Created initial commit `7d8b2b8`, resolving the missing-main-ref error.
- [x] Pushed to `https://github.com/harshitbadera/Trace-x` on `main`; upstream tracking is configured.
- [x] Handoff: local app at http://127.0.0.1:5173 (`npm run dev`); standalone file `submission/Trace-X-prototype.html` (0.79 MB); 24 automated core tests and four browser checks passed.

## Later milestones requiring additional data or separate scope

Initial-round package prepared on 21 November 2026:

- [x] Created the 12-slide action plan, then replaced its rejected PDF with an editable PPTX.
- [x] Created eight wireframe screens, then replaced the rejected PDF with a combined static PNG.
- [x] Rebuilt the standalone HTML and verified the exact file offline without external requests.
- [x] Reran all 24 core tests and inspected every PDF page, including repaired captures.
- [x] Checked that every upload file is below 25 MB and added an upload guide in `submission/initial-round/`.
- [ ] User upload and final portal submission before 24 November, 11:59 pm IST. The assistant has not submitted the package.

Remaining engineering milestones:

- [ ] Adapt and validate against R4C's actual statement formats when supplied.
- [ ] Add OCR only if scanned statements require it; retain source-image references and review confidence.
- [ ] Add statement-period coverage and balance reconciliation against supplied opening/closing balances.
- [ ] Integrate historical DNS/IP or reputation data when provider access is available.
- [ ] Add authentication, authorization and stronger audit controls before any shared deployment.
- [ ] Confirm the competition's prebuilt-code rules for the 24-hour final.

These items are intentionally not presented as implemented or verified.

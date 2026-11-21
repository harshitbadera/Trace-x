# Trace-X submission plan

Participant-supplied deadline: **24 November 2026, 11:59 pm IST**. At least one accepted artifact is required. Uploading locks the problem statement according to the supplied portal instructions; verify the selected statement before uploading. The application does not submit to the portal.

## Positioning

**From a victim transaction to a connected investigation, with a source behind every finding.**

Trace-X addresses the investigator's three linked tasks: normalize fragmented statements, follow suspicious movement and examine related infrastructure. Its differentiator is reviewable evidence and explicit uncertainty throughout the workflow.

## Initial artifact

The completed upload package is in `submission/initial-round/`:

| Portal slot              | File                      | Contents                                                                                  |
| ------------------------ | ------------------------- | ----------------------------------------------------------------------------------------- |
| Action plan presentation | `Trace-X-Action-Plan.pdf` | 12 slides covering the problem, implementation, architecture, validation and 24-hour plan |
| Wireframe                | `Trace-X-Wireframes.pdf`  | Eight annotated screens captured from the working app using synthetic data                |
| HTML prototype           | `Trace-X-Prototype.html`  | Self-contained interactive preview tested with networking disabled                        |

`UPLOAD-GUIDE.txt` explains the upload steps. Each file is below 25 MB. The presentation slot explicitly accepts PDF, so a separate PPTX is unnecessary. Upload the HTML directly; no ZIP is required. The package has not been submitted to the portal.

Preparation checks on 21 November: 24 core tests passed, the standalone investigation workflow passed offline without external requests, and both PDFs were rendered for page-by-page visual review. The four browser regression checks also passed in the 17 November project baseline.

The package sources are `scripts/capture-submission.mjs`, `scripts/build-initial-round.py` and `scripts/render-initial-round.mjs`. Capture against an isolated local demo at port 5174. The PDF builder uses ReportLab and pypdf installed under `tmp/pdf-deps` and the local Windows Arial fonts. Generated files and temporary captures remain outside Git.

Generate `submission/Trace-X-prototype.html` with `npm run package:submission`. It is a self-contained interactive preview, with embedded synthetic data and bundled fonts. It is clearly distinguished from the local application that performs ingestion, persistence, public lookups and generated exports.

Recommended accompanying presentation narrative:

1. Investigator receives disconnected statements, transaction references and domains.
2. Trace-X unifies them in a case workspace.
3. Reviewable normalization retains source rows, original timestamps and evidence fingerprints.
4. Explainable account rules identify a planted mule pattern and show the benign comparison.
5. Replay the split and reconvergence of a reported INR 240,000 transaction.
6. Connect submitted payment identifiers and passive domain/IP observations without inventing ownership.
7. Reveal the exact shared account and UPI identifier in a second complaint.
8. Identify the missing endpoint statement and prepare a lawful-request draft.
9. Export the report, inspect test coverage and describe remaining validation against R4C data.
10. Present the implementation schedule and next scoped milestones.

## Demonstration sequence

| Time      | Show                | Explain                                                      |
| --------- | ------------------- | ------------------------------------------------------------ |
| 0:00–0:40 | Case overview       | Reported loss, available evidence, review priorities         |
| 0:40–1:20 | Upload and review   | Normalization, corrections, source preservation              |
| 1:20–2:20 | Money trail         | Split, convergence, chronological order and missing endpoint |
| 2:20–3:00 | Account explanation | Supporting rows, explicit rules, benign comparison           |
| 3:00–3:40 | Infrastructure      | Public-source observations versus synthetic fixtures         |
| 3:40–4:20 | Cross-case links    | Exact shared identifiers with source context                 |
| 4:20–5:00 | Report and request  | Evidence-backed output and next lawful action                |

## Claims to make accurately

- The implemented tests cover the supplied synthetic fixture and parser/analysis boundary cases; they do not establish population-level fraud accuracy.
- All displayed demo entities and infrastructure are synthetic. Live public lookups are separately labelled.
- Onward money paths are candidates, not exact allocation of commingled funds.
- The local application is implemented, but arbitrary bank formats, OCR, historical intelligence and a production multi-user deployment remain separate milestones.
- Winning is not guaranteed; the submission emphasizes demonstrable completeness, explanation, useful interaction and honest scope.

Confirm the rules for prebuilt-code reuse in the 24-hour final before representing this implementation as eligible for that stage.

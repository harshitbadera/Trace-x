# Trace-X

An evidence-first financial crime investigation workspace for **PS05: Financial Crime Infrastructure & Money-Trail Analysis System**.

Start with a victim transaction. Follow documented transfers. Connect submitted digital indicators. Inspect the evidence behind every finding.

## Run locally

Requires **Node.js 22.17 or newer** and npm. Node's built-in SQLite currently prints an experimental-feature notice on Node 22; the database is persisted locally.

```powershell
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. The API runs at **http://127.0.0.1:8000**. Both bind to the loopback interface. Two synthetic cases are created on the first run.

For a production frontend build served by the local server:

```powershell
npm run build
npm start
```

Then open **http://127.0.0.1:8000**.

## Demo in five minutes

1. Open **Aurum investment fraud**. The starting UTR is `SYN2611160001`, for **INR 240,000**.
2. Explore **Money trail**. Replay the timeline and click a transfer to see its original timestamp and source rows.
3. Open **Aster Trading** in Account analysis. Inspect five deterministic rule explanations and their supporting transactions.
4. Open **Infrastructure**. Inspect explicitly labelled synthetic DNS/RDAP/CT fixtures and the submitted complaint association. Use a real public domain/IP only when demonstrating a live lookup.
5. Open **Cross-case links**. A second synthetic complaint shares an account identifier and a UPI identifier. Inspect both sources.
6. Download the **PDF investigation report** and **Excel evidence workbook**. Prepare an editable information-request draft; nothing is sent.
7. To demonstrate real ingestion, create a new case, set its starting UTR to `SYN2611160001`, download a sample from Statements, upload it, review the mapping, and confirm import. Import additional sample accounts using the sample API, e.g. `/api/samples/xlsx?account=SYN-B2081`.

The demo deliberately includes benign salary/rent activity, a pre-incident observation, split/converging flows, multiple observations of the same transfer, and an endpoint whose statement is missing.

## Implemented

- Persistent local cases, notes, rule settings, evidence register and activity log using SQLite.
- CSV, XLSX and selectable-text PDF table ingestion, header mapping, original source locations, reviewable corrections, explicit exclusions, original file SHA-256, and original file download.
- Common transaction schema: original and UTC timestamps, precision, timezone, direction, integer-paise amount, available balance, account, counterparty, UTR and narration.
- Matching transfer observations merge provenance without adding their amounts twice. Missing-UTR rows are not automatically matched across source rows.
- Explainable rapid forwarding, rolling 24-hour fan-in, repeated round amounts, repeated recipients and observed inactivity-gap rules.
- Interactive UTR-rooted financial graph, hop limit, amount filter, timeline playback and evidence inspection.
- Passive domain/IP lookup adapters: RDAP, Google DNS A/AAAA/MX/NS/TXT/CNAME, crt.sh Certificate Transparency, reverse DNS, RIPE network/ASN data. Each stores its observation time, source and availability.
- Infrastructure relationship view; exact account and submitted-indicator matches across local cases.
- PDF/Excel reports and editable, downloadable lawful-request drafts.
- Responsive interface and a self-contained offline HTML submission preview.

## Important interpretation limits

The system is a **local, single-analyst hackathon application**, not a production police deployment. It has no authentication, multi-user authorization or tamper-proof audit service. Do not expose it to a network or process real personal data without a separate deployment/security project.

The initial investigation data is entirely synthetic. Use only synthetic or hackathon-provided statements. Uploaded evidence remains in `data/`, which is ignored by Git. Public intelligence queries send only the requested indicator to the named public providers; files and transactions are not sent.

- Risk scores prioritize review; they are not fraud probabilities or findings of guilt.
- Financial edges are observed transfers. The onward trail is a **candidate** flow through available records; the software does not allocate commingled funds or claim recoverable/current balances.
- A missing counterparty is an unresolved import row, not an invented entity. A UTR collision is surfaced rather than selecting an arbitrary starting record.
- Date-only entries preserve date precision; they cannot trigger rapid-transfer rules. Unzoned timestamps use the explicitly selected fixed UTC offset. Historical daylight-saving conversion is not implemented.
- Inactivity is an observed record gap, not proof of dormancy or complete statement coverage.
- Shared infrastructure and indicative network geography do not establish a person, location or common operator. Financial-to-domain links require supplied evidence, not just temporal similarity.
- Live DNS is current, not historical. Historical DNS/allocation and VPN/proxy/Tor classifications require additional providers. Unknown is not displayed as a negative result.
- CT entries describe certificate names; they do not establish live hosts. No target websites are visited, scanned or probed.
- Subscriber, login and access records are not publicly discovered. Drafts require investigator completion and the applicable lawful process.
- Evidence hashes support later integrity comparisons; they do not prove source authenticity. The local activity log can be changed by a person controlling the database.

## Ingestion scope

Supported uploads: `.csv`, `.xlsx`, `.pdf`; **10 MB**, **5,000 extracted rows**, **100 PDF pages** maximum. XLSX reads the first worksheet. Legacy `.xls`, password-protected files and scanned-PDF OCR are not implemented. Unrecognized bank formats should be adapted using column mapping or exported to the template. Footer/header fragments may appear as review rows in PDF extraction and must be explicitly excluded.

Canonical CSV headers:

```csv
timestamp,account,counterparty,direction,amount,balance,utr,narration
2026-11-16T10:02:00+05:30,SYN-A1042,SYN-V001,credit,240000,,SYN2611160001,Investment payment
```

Alternative `from,to,amount` or separate `debit,credit` columns are supported. INR amounts use at most two decimals. Store account/UTR identifiers as **text** in Excel to preserve leading zeros and full precision. Supported dates include `YYYY-MM-DD` and `DD/MM/YYYY`, optionally with a time and numeric UTC offset.

## Test and package

```powershell
npm test
npm run test:ui
npm run build
npm run package:submission
```

The browser suite uses installed Chrome on Windows, or a Playwright Chromium installation elsewhere (`npx playwright install chromium`). API and browser tests use isolated temporary SQLite databases and synthetic data. Browser checks run on ports 5174/8001, leaving the development workspace on 5173/8000 unchanged. Generate the submission file before running browser tests, since the suite also verifies that file with networking disabled.

The self-contained file is **`submission/Trace-X-prototype.html`**. Open it directly without a server. Its fixture-only mode is prominently labelled. It supports graph interaction, searches, evidence inspection, local preview cases/notes, rule changes and request drafting. Upload parsing, live lookup adapters and generated PDF/XLSX exports require the full local application. The preview's report can be printed to PDF.

## Project structure

```text
src/                 React interface, graphs, review workflows
server/              Express API, SQLite, parsers, intelligence, reports
shared/              Typed schema, deterministic analysis, synthetic fixtures
tests/               Analysis, ingestion, API and browser tests
scripts/             Submission packaging
docs/                Architecture, validation and submission plan
data/                Runtime database and original uploads (Git ignored)
submission/          Generated standalone preview (Git ignored)
```

## Next engineering milestones

1. Validate against the actual R4C sample formats when supplied; add adapters and meaningful regression fixtures.
2. Add statement-period metadata, reconciliation against supplied opening/closing balances, and explicit transfer-conflict review.
3. Add OCR with per-field confidence and source-image bounding boxes if scanned samples require it.
4. Add supported historical intelligence providers only when API access and licensing are available.
5. Benchmark extraction and planted-chain recall on a held-out synthetic set. No general accuracy claim is made from the included demo.

## Sources and implementation references

- [React Flow](https://reactflow.dev/learn) for interactive graphs.
- [PDF.js](https://mozilla.github.io/pdf.js/examples/) for selectable PDF text extraction.
- [ICANN RDAP transition](https://www.icann.org/en/announcements/details/icann-update-launching-rdap-sunsetting-whois-27-01-2025-en).
- [Certificate Transparency](https://certificate.transparency.dev/howctworks/).
- [Google Public DNS JSON API](https://developers.google.com/speed/public-dns/docs/doh/json).
- [RIPEstat Network Info](https://stat.ripe.net/docs/data-api/api-endpoints/network-info).

The repository includes only project source and self-made synthetic fixtures. Organizer-provided data should remain outside Git and be used only within the hackathon's rules.

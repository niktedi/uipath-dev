# uipath-dev

🇵🇱 [Wersja polska](README_PL.md)

End-to-end UiPath automations of everyday back-office tasks in a Polish company: vendor verification, invoice processing (KSeF), mailbox triage and travel expenses. Each automation is a separate UiPath project built around a real business rule, deployed to Orchestrator and run by an unattended robot.

All projects share one UiPath library (`UipathDev.Shared`) and use Google Workspace (Sheets, Docs, Drive, Gmail, Forms) instead of Excel and Outlook.

## Projects

| # | Project | What it automates | Status |
|---|---|---|---|
| 00 | [shared-library](00-shared-library/) | Library `UipathDev.Shared`: NIP / IBAN validation, VAT White List check, Google Sheets / Docs / Gmail activities, business event logging | ✅ v1.0.0 |
| 01 | [vendor-verification](01-vendor-verification/) | Verifies vendors before they are added to the vendor master and rechecks them daily: Polish VAT White List, GUS REGON, EU VIES, name match → OK / WARNING / BLOCK, PDF report, email, register | ✅ v1.0.0 |
| 02 | agentic-mailbox-triage | AI agent (Agent Builder) + Maestro over an AP mailbox: bank detail changes and invoices are routed to the right process | 🔜 planned |
| 03 | invoice-processing-ksef | Purchase invoices from KSeF (XML) and PDF (Document Understanding), pre-payment check, split payment (MPP), human review in Action Center | 🔜 planned |
| 04 | travel-expenses | Business trip settlement: receipts (Document Understanding), per diems (dieta), NBP exchange rates, approval | 🔜 planned |

Each project folder has its own README with the business context, process flow, configuration and limitations.

## Repository layout

```
uipath-dev/
├── README.md / README_PL.md        # this file
├── 00-shared-library/              # UiPath Library (UipathDev.Shared)
├── 01-vendor-verification/         # Dispatcher (Process) + Performer (REFramework)
├── 02-agentic-mailbox-triage/      # planned
├── 03-invoice-processing-ksef/     # planned
└── 04-travel-expenses/             # planned
```

The repository root is not a UiPath project. Every numbered folder holds one or more independent UiPath projects with their own `project.json`, package and README.

## Shared library

`00-shared-library` is published to the Orchestrator Tenant Libraries feed and installed in each process as a regular dependency. Versions follow semver (minor: new activities, major: changed signatures); a process upgrades the library on its own schedule. Release tags: `lib-vX.Y.Z`.

| Area | Activities (1.0.0) |
|---|---|
| Validation | `ValidateNip`, `ValidateIban` |
| Finance | `CheckVatWhiteList` (Polish VAT White List API: status and bank account) |
| Google | `SheetsReadTable`, `SheetsAppendRows`, `SheetsUpsertByKey`, `DocsRenderTemplate` (Docs template → PDF) |
| Notify | `SendGmail` (HTML template, attachments from Drive) |
| Common | `LogBusinessEvent` |

## Common conventions

- **Platform**: UiPath Studio 2026.x (Windows, C#), Orchestrator (Automation Cloud), one unattended robot.
- **Orchestrator resources**: one folder `uipath-dev`; queues, Assets and Integration Service connections are project resources (bindings), never hard-coded. Asset names carry a project prefix (`SH_`, `VV_`, …).
- **Queue-based processes**: Dispatcher / Performer split, REFramework for the Performer, deterministic queue references (re-running the Dispatcher never creates duplicates).
- **Error handling**: business rule exceptions are not retried; system exceptions are retried by the queue; known temporary outages (API maintenance windows, daily limits) postpone the item instead of failing it.
- **Naming**: English only in folders, packages, workflows, arguments, Assets, sheets and columns (the only exception is KSeF). Arguments `in_` / `out_` / `io_`, DataTables `dt_`.
- **Data**: synthetic test data and public data of well-known Polish and EU companies; no personal data. Email addresses are aliases of the robot's own mailbox.
- **Tags**: `lib-vX.Y.Z` for the library, `NN-vX.Y.Z` for a project (for example `01-v1.0.0`).

## Running a project

Each project README lists exactly what it needs. In general:

1. UiPath Studio 2026.x and an Orchestrator tenant with a folder `uipath-dev`.
2. The library `UipathDev.Shared` published to the tenant feed (see [00-shared-library](00-shared-library/)).
3. A Google account for the robot and Integration Service connections (Sheets, Docs, Drive, Gmail) in the folder.
4. The Google resources, queues and Assets described in the project README.
5. Publish the project, create the process and triggers in Orchestrator.


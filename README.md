# UipathDev.Shared

Shared UiPath library used by the `uipath-dev` processes (01–04). It holds the building blocks that every scenario needs: Polish tax ID and bank account validation, the Polish VAT white list check, Google Sheets / Docs / Gmail operations, and structured business logging.

The library shows how one package is reused across several processes, versioned with SemVer and upgraded independently in each consumer.

| | |
|---|---|
| Package | `UipathDev.Shared` |
| Version | 1.0.0 |
| Activities category | `UipathDev` |
| Project type | Library, Windows compatibility, C# |
| Studio | 2026.10 |

## Installation

1. Publish the library to the Orchestrator **Tenant Libraries feed** (or use the published version).
2. In the consuming process: **Manage Packages → Orchestrator Tenant → `UipathDev.Shared`** → install the required version.
3. Activities appear in the Activities panel under `UipathDev → Validation / Finance / Google / Notify / Common`.

### Dependencies

- `UiPath.GSuite.Activities` — Google Workspace activities with Integration Service connections
- `UiPath.WebAPI.Activities` — HTTP Request (VAT white list API)
- `Newtonsoft.Json`

### Google connections

Google activities use **Integration Service connections** (no Scope activity, no credentials in the package). Each activity exposes a connection selector per Google service it uses, so every process picks its own connection:

| Activity | Connections |
|---|---|
| `SheetsReadTable`, `SheetsAppendRows`, `SheetsUpsertByKey` | Google Sheets |
| `DocsRenderTemplate` | Google Drive, Google Docs |
| `SendGmail` | Google Drive, Gmail |

Use a dedicated robot Google account, not a personal one.

## Design rules

- **Resource IDs come in as arguments.** Activities never read Orchestrator Assets; processes do.
- **Validate before side effects.** Invalid input fails with `ArgumentException` before any API call or write.
- **Errors keep their type.** Exceptions are rethrown unchanged (no wrapping), so processes can tell business errors from system errors.
- **Retry only what is safe to repeat.** Idempotent operations retry transient errors; non-idempotent writes (append, send) retry only `429`.
- **Sheets values are strings.** All cells are read and compared as `String`; parse numbers in the process with `CultureInfo.InvariantCulture`.

## Activities

| Activity | Purpose |
|---|---|
| [`Validation/ValidateNip`](#validatenip) | Normalize and validate a Polish NIP |
| [`Validation/ValidateIban`](#validateiban) | Normalize and validate an IBAN |
| [`Finance/CheckVatWhiteList`](#checkvatwhitelist) | Check VAT status and bank account on the Polish VAT white list |
| [`Google/SheetsReadTable`](#sheetsreadtable) | Read a sheet into a DataTable |
| [`Google/SheetsAppendRows`](#sheetsappendrows) | Append rows, aligned to the sheet header |
| [`Google/SheetsUpsertByKey`](#sheetsupsertbykey) | Insert or update rows by a key column |
| [`Google/DocsRenderTemplate`](#docsrendertemplate) | Render a Google Docs template, optionally export to PDF |
| [`Notify/SendGmail`](#sendgmail) | Send an HTML email (or draft) with placeholders and Drive attachments |
| [`Common/LogBusinessEvent`](#logbusinessevent) | Write a structured business event to the robot log |

---

### ValidateNip

Pure function: no API calls, no logging, no exceptions.

| Argument | Type | Description |
|---|---|---|
| `in_Nip` | String | NIP; hyphens, spaces and the `PL` prefix are allowed |
| `out_IsValid` | Boolean | |
| `out_NormalizedNip` | String | ASCII digits after normalization (also for invalid input) |
| `out_Reason` | String | `OK`, `NIP must contain exactly 10 digits`, `Invalid checksum` |

Checksum: weights 6,5,7,2,3,4,5,6,7, sum mod 11 must equal the 10th digit; remainder 10 is always invalid. Non-ASCII digits (e.g. full-width digits from OCR) are removed during normalization.

### ValidateIban

Pure function: no API calls, no logging, no exceptions.

| Argument | Type | Description |
|---|---|---|
| `in_Iban` | String | IBAN; spaces, hyphens and lowercase are allowed |
| `in_DefaultCountry` | String | Default `PL`. Exactly 26 digits without a country code are treated as an account of this country |
| `out_IsValid` | Boolean | |
| `out_NormalizedIban` | String | Uppercase letters and digits |
| `out_Reason` | String | `OK`, `Invalid IBAN format`, `Unsupported country: XX`, `IBAN for XX must be N characters`, `Invalid checksum` |

Checks: format → supported country (28 EU/EEA countries + GB) → length for the country → mod 97 = 1.

### CheckVatWhiteList

Checks a company on the Polish VAT white list (`wl-api.mf.gov.pl`) and, optionally, whether a bank account belongs to it.

| Argument | Type | Description |
|---|---|---|
| `in_Nip` | String | NIP, validated with `ValidateNip` |
| `in_Iban` | String | Optional; validated with `ValidateIban` |
| `in_Date` | <!-- TODO: confirm type in xaml --> | Check date; empty = today |
| `out_Status` | String | `Active`, `Exempt`, `NotRegistered`, `NotFound` |
| `out_IbanOnList` | Boolean? | `true` / `false`; `null` when no IBAN is passed |
| `out_RequestId` | String | `searchId`, or `searchId;checkId` when the account check endpoint was called. Store it as audit evidence |
| `out_RawJson` | String | Raw API response |

- Account lookup: the account is searched in `accountNumbers`; if not found and the company has virtual accounts, the `check` endpoint is called. Non-Polish accounts and `NotFound` companies return `false`.
- Errors: invalid NIP/IBAN or HTTP 400 → `BusinessRuleException` (before/without retry); HTTP 429 and other non-200 responses → `System.Exception`.
- Retry: 3 attempts with exponential backoff on 500/502/503/504. HTTP 429 is not retried.
- **API limit:** the `search` method allows about 100 requests per day per IP address; after that requests are blocked until midnight. Cache results in the process when checking many vendors.

### SheetsReadTable

| Argument | Type | Description |
|---|---|---|
| `in_SpreadsheetId` | String | Required |
| `in_SheetName` | String | Required |
| `in_Range` | String | Optional, e.g. `A1:E10`; empty = whole sheet |
| `in_HasHeaders` | Boolean | Default `True` |
| `out_Data` | DataTable | All columns are `String` |
| `out_RowCount` | Int32 | |

Retry: 3 × 15 s on `429`, `5xx` and network errors.

### SheetsAppendRows

| Argument | Type | Description |
|---|---|---|
| `in_SpreadsheetId`, `in_SheetName` | String | Required |
| `in_Data` | DataTable | Rows to append |
| `out_RowsAppended` | Int32 | |

- Columns are matched **by name** (case-insensitive) to the sheet header row, not by position. Sheet columns missing in `in_Data` stay empty.
- Columns of `in_Data` that are not on the sheet → `ArgumentException` (nothing is written). Sheet without a header row → `InvalidOperationException`.
- Empty `in_Data` → `0`, no API calls. The caller's DataTable is not modified.
- Retry: 3 × 15 s on `429` **only** — append is not idempotent, so a timeout or `5xx` is passed to the process to avoid duplicate rows.

### SheetsUpsertByKey

| Argument | Type | Description |
|---|---|---|
| `in_SpreadsheetId`, `in_SheetName` | String | Required |
| `in_KeyColumn` | String | Key column name (case-insensitive) |
| `in_Data` | DataTable | Rows to insert or update |
| `out_RowsUpdated` | Int32 | Rows where at least one value changed |
| `out_RowsInserted` | Int32 | |

- Read-modify-write: the sheet is read, merged in memory by key, and written back in one request.
- Updates change only the columns passed in `in_Data`; other cells of the row are kept. New rows get empty values for columns not passed.
- Keys are trimmed and compared case-sensitively. No changes → no write request.
- `ArgumentException`: empty/duplicate keys in `in_Data`, key column missing in `in_Data`, columns not on the sheet. `InvalidOperationException`: no header row, key column missing on the sheet, duplicate keys on the sheet.
- Retry: 3 × 15 s on `429`, `5xx` and network errors (rewriting the same values is idempotent).

**Limitations**
- The sheet must contain values only: formulas are overwritten with values.
- One writer per sheet: concurrent upserts can lose changes.
- Pass values in the format Sheets stores them (`"99.9"`, not `"99.90"`), otherwise the row counts as changed on every call.

### DocsRenderTemplate

| Argument | Type | Description |
|---|---|---|
| `in_TemplateDocId` | String | Google Docs template |
| `in_OutputFolderId` | String | Drive folder for the result |
| `in_OutputName` | String | File name without extension |
| `in_Placeholders` | Dictionary&lt;String, String&gt; | Keys without braces: `"Nip"` fills `{{Nip}}`; `null` value → empty string |
| `in_ExportPdf` | Boolean | Default `False` |
| `out_DocId` | String | Rendered document |
| `out_PdfFileId` | String | PDF on Drive; `""` when no PDF was requested |

- The template text is read first: placeholders without a value → `ArgumentException` before anything is created on Drive. Extra dictionary keys are ignored.
- Values are inserted literally (`$1`, `&` are safe); formatting of the placeholder is kept.
- PDF: the document is downloaded as PDF and uploaded to the same folder as `<in_OutputName>.pdf`.
- Retry: 3 × 15 s on `429`, `5xx` and network errors; a retry starts again from copying the template.

**Limitations**
- Placeholders are processed in the document body, including tables; headers and footers are not processed.
- Placeholder format is strictly `{{Key}}`, case-sensitive, no spaces inside.
- Rendering again with the same name in the same folder replaces the document (new ID) and the PDF (same ID).
- Do not keep the template in the output folder under the output name — it would be replaced. Duplicate file names in the folder make the replace fail.
- Google Docs API write quota is about 60 requests per minute per user; one request is made per unique placeholder.

### SendGmail

| Argument | Type | Description |
|---|---|---|
| `in_To` | String | One or more addresses separated by `;` or `,` |
| `in_Subject` | String | May contain placeholders |
| `in_HtmlTemplate` | String | HTML body with placeholders |
| `in_Values` | Dictionary&lt;String, String&gt; | Optional placeholder values |
| `in_Attachments` | String[] | Optional Google Drive file IDs |
| `in_SaveAsDraft` | Boolean | Default `False`; `True` creates a draft instead of sending |

- Placeholders `{{Key}}` work in the subject and the body. Body values are HTML-encoded, so data cannot change the markup; HTML can only come from the template. Line breaks in subject values are replaced with spaces (no header injection).
- All checks run before sending: empty arguments, invalid addresses, missing placeholder values, empty attachment IDs → `ArgumentException`.
- Attachments are attached directly from Drive with their original names. Google Docs/Sheets files and folders are rejected (`ArgumentException`): render them to PDF first (`DocsRenderTemplate` with `in_ExportPdf = True`).
- Retry: reading attachments — 3 × 15 s on `429`, `5xx` and network errors; sending — `429` only (sending is not idempotent).
- Gmail sending limits of the robot account apply (a regular Gmail account has a daily recipient limit).

### LogBusinessEvent

| Argument | Type | Description |
|---|---|---|
| `in_Process` | String | Business process name |
| `in_TransactionId` | String | Transaction or document ID |
| `in_Event` | String | Event name, e.g. `WhiteListChecked` |
| `in_Data` | Dictionary&lt;String, Object&gt; | Optional event data |

- Writes one Info log line `BusinessEvent | <Process> | <TransactionId> | <Event>` with custom log fields `bizProcess`, `bizTransactionId`, `bizEvent`, `bizData` (JSON of `in_Data`, `{}` when empty).
- The fields are removed after the log line, so they do not leak into later logs.
- Never throws: if logging fails, a Warn log is written instead.

## Exceptions

| Exception | Meaning | Typical handling in a process |
|---|---|---|
| `ArgumentException` | Invalid arguments or data from the caller | Fix the input; business exception |
| `BusinessRuleException` | Invalid NIP/IBAN for the VAT white list check | Business exception, no retry |
| `InvalidOperationException` | The target sheet is not in the expected shape | Configuration problem, no retry |
| `GSuiteException` | Google API error (e.g. 404 not found, 400 bad request) | System exception |
| `System.Exception` | VAT white list API error / limit | System exception, retry later |

## Tests

| Kind | Files | Notes |
|---|---|---|
| Test Cases (data-driven) | `Tests/ValidateNip_Test.xaml`, `Tests/ValidateIban_Test.xaml`, data in `Tests/Data/*.json` | No external calls, suitable for CI. All logic branches are covered (Studio shows 91% for `ValidateIban` because `Else If` blocks are not counted as executed) |
| Smoke workflows (private) | `Tests/*_Smoke.xaml` | Manual integration runs against the robot's Google account and test resources (Assets `SH_*`); not run in CI |

## Versioning

[Semantic Versioning](https://semver.org/). Breaking changes to arguments or behavior bump the major version. See [CHANGELOG.md](CHANGELOG.md).

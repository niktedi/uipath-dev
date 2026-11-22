# uipath-dev

🇬🇧 [English version](README.md)

Kompletne automatyzacje UiPath codziennych zadań back-office w polskiej firmie: weryfikacja kontrahentów, obsługa faktur (KSeF), sortowanie skrzynki pocztowej i rozliczanie delegacji. Każda automatyzacja to osobny projekt UiPath oparty na rzeczywistej regule biznesowej, wdrożony w Orchestratorze i uruchamiany przez robota unattended.

Wszystkie projekty korzystają z jednej biblioteki UiPath (`UipathDev.Shared`) oraz z Google Workspace (Sheets, Docs, Drive, Gmail, Forms) zamiast Excela i Outlooka.

## Projekty

| # | Projekt | Co automatyzuje | Status |
|---|---|---|---|
| 00 | [shared-library](00-shared-library/) | Biblioteka `UipathDev.Shared`: walidacja NIP / IBAN, sprawdzenie na białej liście VAT, aktywności Google Sheets / Docs / Gmail, logowanie zdarzeń biznesowych | ✅ v1.0.0 |
| 01 | [vendor-verification](01-vendor-verification/) | Weryfikuje kontrahentów przed dodaniem do kartoteki i codziennie sprawdza ich ponownie: biała lista VAT, GUS REGON, VIES, porównanie nazwy → OK / WARNING / BLOCK, raport PDF, e-mail, rejestr | ✅ v1.0.0 |
| 02 | agentic-mailbox-triage | Agent AI (Agent Builder) + Maestro na skrzynce działu płatności: zmiany rachunków bankowych i faktury trafiają do właściwego procesu | 🔜 planowany |
| 03 | invoice-processing-ksef | Faktury zakupowe z KSeF (XML) i PDF (Document Understanding), kontrola przed płatnością, mechanizm podzielonej płatności (MPP), weryfikacja przez człowieka w Action Center | 🔜 planowany |
| 04 | travel-expenses | Rozliczenie delegacji: paragony (Document Understanding), diety, kursy NBP, akceptacja | 🔜 planowany |

W folderze każdego projektu znajduje się osobny README z kontekstem biznesowym, przebiegiem procesu, konfiguracją i ograniczeniami.

## Struktura repozytorium

```
uipath-dev/
├── README.md / README_PL.md        # ten plik
├── 00-shared-library/              # biblioteka UiPath (UipathDev.Shared)
├── 01-vendor-verification/         # Dispatcher (Process) + Performer (REFramework)
├── 02-agentic-mailbox-triage/      # planowany
├── 03-invoice-processing-ksef/     # planowany
└── 04-travel-expenses/             # planowany
```

Katalog główny repozytorium nie jest projektem UiPath. Każdy numerowany folder zawiera jeden lub kilka niezależnych projektów UiPath z własnym `project.json`, pakietem i README.

## Wspólna biblioteka

`00-shared-library` jest publikowana w feedzie Tenant Libraries Orchestratora i instalowana w każdym procesie jak zwykła zależność. Wersje zgodne z semver (minor — nowe aktywności, major — zmiana sygnatur); każdy proces aktualizuje bibliotekę we własnym tempie. Tagi wydań: `lib-vX.Y.Z`.

| Obszar | Aktywności (1.0.0) |
|---|---|
| Validation | `ValidateNip`, `ValidateIban` |
| Finance | `CheckVatWhiteList` (API białej listy podatników VAT: status i rachunek bankowy) |
| Google | `SheetsReadTable`, `SheetsAppendRows`, `SheetsUpsertByKey`, `DocsRenderTemplate` (szablon Docs → PDF) |
| Notify | `SendGmail` (szablon HTML, załączniki z Drive) |
| Common | `LogBusinessEvent` |

## Wspólne zasady

- **Platforma**: UiPath Studio 2026.x (Windows, C#), Orchestrator (Automation Cloud), jeden robot unattended.
- **Zasoby Orchestratora**: jeden folder `uipath-dev`; kolejki, Assety i połączenia Integration Service są zasobami projektu (bindings), nigdy nie są wpisane na sztywno. Nazwy Assetów mają prefiks projektu (`SH_`, `VV_`, …).
- **Procesy oparte na kolejce**: podział Dispatcher / Performer, REFramework w Performerze, deterministyczne referencje elementów kolejki (ponowne uruchomienie Dispatchera nie tworzy duplikatów).
- **Obsługa błędów**: wyjątki reguł biznesowych nie są ponawiane; wyjątki systemowe ponawia kolejka; znane przejściowe niedostępności (okna serwisowe API, limity dzienne) odraczają element zamiast oznaczać go jako błąd.
- **Nazewnictwo**: tylko angielski w nazwach folderów, pakietów, workflow, argumentów, Assetów, arkuszy i kolumn (jedyny wyjątek to KSeF). Argumenty `in_` / `out_` / `io_`, DataTable `dt_`.
- **Dane**: syntetyczne dane testowe i publiczne dane znanych polskich i unijnych firm; bez danych osobowych. Adresy e-mail to aliasy skrzynki samego robota.
- **Tagi**: `lib-vX.Y.Z` dla biblioteki, `NN-vX.Y.Z` dla projektu (na przykład `01-v1.0.0`).

## Uruchomienie projektu

README każdego projektu dokładnie opisuje, czego potrzebuje. Ogólnie:

1. UiPath Studio 2026.x i tenant Orchestratora z folderem `uipath-dev`.
2. Biblioteka `UipathDev.Shared` opublikowana w feedzie tenanta (zob. [00-shared-library](00-shared-library/)).
3. Konto Google robota i połączenia Integration Service (Sheets, Docs, Drive, Gmail) w folderze.
4. Zasoby Google, kolejki i Assety opisane w README projektu.
5. Publikacja projektu, utworzenie procesu i triggerów w Orchestratorze.



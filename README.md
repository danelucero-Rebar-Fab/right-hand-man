# Right Hand Man — field & project management PWA
Designed by Joe Dane Lucero P.E. · Rebar-Fab, 207 Sentry Dr, Mansfield TX 76063 · (817) 908-0069 · direct 817.798.2483 · d.lucero@rebar-fab.com

Works offline on iPhone (Safari → Share → Add to Home Screen) and Android (Chrome → Install app). Data stays on the device in IndexedDB. Use Projects → Backup/Restore (JSON) to move it to another device.

## Modules (Home tiles)
Plans · Takeoff · Pay App · Daily Log · Change Order/Quote · Shop Drawings · Standards · Cost Data, plus Projects/Clients, Settings and About.
- **Clients:** G702/G703 or simple format, retainage %, tax %, SOV template, logo, extra pay-app checklist items.
- **Plans:** upload multi-sheet PDFs or images. Sheet numbers are read from the title block. Calibrate by printed scale or by two known points. Length, area, count and volume tools; markup layers (Redline/Takeoff/Progress/Notes); % complete per SOV line; OCR; export a PDF.
- **Takeoff:** templates for 10 trades. All math is shown, each line cites sheet + PDF page + spec, blanks become RFIs, laps go on their own rows, and the higher schedule quantity is carried. Exports PDF and CSV.
- **Shop Drawings:** bar list and bending schedule by mark, with ACI 315 shapes and a user-entered CRSI code. Cut lengths add the CRSI Manual of Standard Practice standard-hook detailing dimension (A or G) for each hook. A missing leg is flagged as an RFI and never invented. Tabloid PDF with the Rebar-Fab title block, plan reference, revision block, and a FOR REVIEW stamp until approved. Shop drawings are charged $35/T on fabricated tons only.
- **Pay App:** two formats per client: AIA G702/G703 style, or a one-page **simple invoice** (contract / previously billed / this invoice / to date, then retainage and amount due). A 5-step wizard covering previous, this period and stored, retainage, G702/G703, backup and a quality checklist. Share PDF only unlocks once all checks pass.
- **Daily Log:** weather from Open-Meteo, crew, quantities vs plan, photos, PDF.
- **CO / Quote / T&M:** Rebar-Fab rules (fab $0.72, straight $0.64, epoxy $0.82/lb; trucking $1,200/load = ROUNDUP(tons/24); separate Material/Trucking/Shop Drawings columns; concrete by others). Text is linted. Sending uses mailto or Share PDF only; nothing is ever sent automatically.
- **Cost Data:** import your own CSV (for example, your licensed RSMeans export) and apply a city cost index. The shipped rows are labeled EXAMPLE, plus Joe's rates (45% burden). No RSMeans data is included.
- **Standards:** summaries with official links (verified 2026-10-15) for TxDOT 2024, NCTCOG, FAR/Davis-Bacon, USACE/UFGS, FHWA and AIA, plus a CO justification helper.
- **Safety nets (v1.1):** one-tap 💾 Back up now (a single file with every plan image and record), a Home reminder after 7 days, and a recover prompt if the phone ever clears the app's storage. Reduced-set (11x17) warning on plan sheets. A page picker for big PDF sets. Huge phone photos are shrunk as they load. A first-run tutorial (🎓 on Home to replay it).
- **Ease of use:** 52px targets, one sticky main action per screen, wizards with defaults and undo, split view on tablets, outdoor high-contrast and glove modes in Settings.

## Upload to GitHub Pages
1. Create a repo (for example `right-hand-man`). Upload **the contents** of `gh_upload/` (or unzip `rightHandMan_gh_upload.zip`) to the repo root, including the `.nojekyll` file.
2. Go to Settings → Pages → Deploy from branch → main / root.
3. Open `https://<user>.github.io/right-hand-man/` and install it to the home screen.
4. After any later update, bump `VER` in `sw.js` so phones pick up the new files.

## Tests
`node tests/unit.js` (67/67) · `unit2` 118 · `unit3` 371 · `unit4` 36 · `unit5` 162 · `unit6` 20 · `unit7` 25 · `unit8` 15 · `unit9` 10 (XLSX) · `field.js` 216/216 · `fuzz` 0 problems · `orders` 66 · `baseline` 50 · `rules` 54. See tests/TEST_LOG.md and KNOWN_ISSUES.md.

## v1.2.0: Project types (oilfield, mechanical, underground)
- **Project wizard, step 2:** pick General, 🛢 Oilfield, 🔧 Mechanical/industrial piping or 🚧 Underground utilities. A typed project starts from that type's SOV template. Lines and units are filled in; **quantities and prices start at 0** for you to fill from takeoff and your bid. Buttons on step 3 swap between the type template and the client template.
- **Takeoff:** the type's trades are listed first. There are 26 new templates: 8 oilfield, 8 mechanical, 10 underground (js/calc_trades.js). Every row shows its math. A blank required box becomes an RFI. **No rates or prices are built in.** Densities, compaction allowances, NDE %, support spacing and test pressures are typed by you from the spec or geotech.
- **🦺 Trench safety selector** (Takeoff screen): checks OSHA 1926 Subpart P. It covers protection at 5 ft and deeper, egress at 4 ft and deeper, App. B slopes, PE design over 20 ft, and the shield's rated depth, 2 ft bottom gap and length. It also gives the Tex. H&S 756 / TxDOT 402 trench-safety LF. Tap "Add trench line to takeoff" to carry the inputs over.
- **Daily log:** adds per-type fields (e.g., H2S bump test, JSA, permits, welds/DI, NDE, hydro, competent person, soil type, protective system, 811 ticket). They are printed on the daily PDF.
- **CO helper:** adds type-specific situations (operator reroute, standby/SIMOPS, liner/berm upsizing, caliche haul, line-class change, weld repairs, extra hydro, extra supports, unmarked utility, rock/groundwater, deeper pipe, added tests). It adds Operator MSA and plant/EPC contract choices.
- **Standards:** 36 new summaries with verified links, plus type filter buttons that default to the project's type.

## v1.3.0: easier to use, plus estimating
- **Getting around:** bottom nav on phones and a sidebar on tablets; a + quick-add button (11 actions); "Continue where you left off" and recent projects on Home; global search (projects, sheets, takeoff lines, logs, COs, pay apps, standards).
- **Entering data:** a '?' help on every field; friendly validation; number keypads; feet-inch entry (12'-6"); swipe-to-delete with UNDO; a Saved indicator; haptics where the device supports them; 18 px default text with M/L/XL sizes; dark mode; skeleton screens; empty states with one next step.
- **Daily log:** voice-to-text notes (Web Speech API, falls back to the keyboard); take a photo straight from the log; today's log is pre-filled from yesterday's crew and SOV lines.
- **Repeat work:** project templates; duplicate a project; copy the last pay-app period; reuse takeoff templates.
- **Estimating (CO / quote):** Settings → Equipment library (machines with hour/day/week/month rates, operated or bare, mobilization, fuel gal/hr x $/gal, delivery; **no rates are shipped**, so blanks become RFIs and examples must be flagged EXAMPLE). Labor rates & burden (45% default, Joe's standard, editable or itemized; OT; Davis-Bacon with entered wage determinations). Sales tax (TX 6.25% + local; materials / all / exempt with a certificate note; separated vs. lump-sum contracts). Allowances with reconciliation on quotes, COs and pay apps.
  Rollup on screen and in the PDF: Material + Labor (burdened) + Equipment + Subs → Allowances → Markup → Tax → Total, with the math shown at every step.

## v1.4.0: Joe's expert-bot construction logic
- **js/rules.js** pulls in the rules from all 13 bot_logic files (concrete, excavation, masonry, steel, welding, roofing, piping, coatings, electrical, rebar_shopdrawings, autocad_checks, margin, competitive_quote) and the fabricated-rebar-takeoff skill. No prices were taken from them.
- **New trade templates:**
  - concrete element with order rounding, ductbank
  - CMU wall
  - steel member/plate with connection % and galv %
  - pipe welds/DI/joints/supports, hydrotest
  - conduit with risers, stub-ups and wire makeup
  - lining SF/gallons/MH
  - structure pit (vertical or OSHA slope), swell/loads
  - roof squares, standing seam panels + clips
  - fillet and groove welds
- **Takeoff check:** runs Joe's rules on every line as you type. It flags misses, red flags and RFI triggers, and asks before you save. Each note has a **Rule source** link naming the bot file and section.
- **Quote / CO check:** runs before a PDF is made or shared. "all-in" stops it; concrete is flagged as by others; never promise a 1-week fab; supply-only wording; BELOW COST blocks the send.
- **VERIFY / DEFAULT tags:** values the bots wrote from memory are tagged until Joe confirms them in **Settings → Assumptions for Joe to confirm**. Shop-drawing hook values show "VERIFY vs CRSI manual" on screen and on the PDF.
- **Shop drawings:** shop weight vs takeoff check, 0 to +5%; under = HOLD fab.
- **Rebar math:** now shows 20-ft sticks = ROUNDUP(LF/20).

### Send, orders and address book (v1.4.0)
- **Send** on every quote / CO: ✉ Email (mailto pre-filled; the PDF goes through the Share sheet where the phone supports files), 💬 Text (an sms: link with a short summary and totals, or share the PDF to Messages / WhatsApp), and 📤 Share. Nothing auto-sends; you press Send in your own app. The quote check runs first.
- **Convert to Order:** an accepted quote becomes Sales Order SO-0001… with customer, billing and ship-to, PO, tax-exempt cert, terms and payment, delivery date/window, required-by date, site contact, delivery instructions, notes, and a customer signature with printed name and date.
  - Lines and prices stay locked (Material / Trucking / Shop Drawings). Changes only come through a re-sync revision with a reason.
  - Status runs Quoted → Accepted → Ordered → Scheduled → Delivered → Invoiced, with time stamps.
  - The Order Confirmation PDF can be sent by email, text or share.
- **Address Book** (More → Address Book) fills order forms and the "Send to" field.

## v1.5.0: Baseline costs (real published sources only)
- `data/baseline/` is split per trade and lazy-loaded (about 94 KB in total, down from 2.6 MB raw). Rebuild it with `python3 tests/build_baseline.py` from `data/baseline_src/`, which is kept out of the deploy zip.
- **Sources:**
  - TxDOT Bid Item Average Cost dashboard (CSV export): Statewide, Fort Worth District and Dallas District, pulled 2026-10-15.
  - BLS OEWS May 2025 hourly mean wages (private market) for DFW and the Midland / Odessa oilfield metros.
  - EIA Gulf Coast diesel retail, weekly.
- **What shows where:**
  - Takeoff lines: a "Baseline cost" card under the Takeoff check, with an optional unit price and a baseline-extended amount.
  - CO lines: a chip with Baseline avg, your price and the variance %.
  - T&M labor: compared against the OEWS wage.
  - Rebar quotes: an honest "no public baseline" note.
- Outside ±25% (DEFAULT - CONFIRM, editable) shows ⚠ and adds a warning to the CO check before send.
- Each chip shows the source label, date, project count, range, the variance math and the TxDOT window caveat. Baselines stay internal and never print on customer PDFs. More → Baseline costs lists the sources, browses items by trade, and shows the labor and diesel tables.

## v1.6.0: Field + PM screens and bid tools
- **RFI log:** cites, ball in court, status, due date with OVERDUE flag, days open, impact. "Pull RFIs from the takeoff" turns blanks and check RFIs into drafts. Email opens the mail app.
- **Submittal log:** spec section, type, status, ball in court, resubmit with revision history.
- **Punch list on plan pins:** tap the sheet to drop a pin, with photo, assignee and status. Closed pins turn green.
- **Signatures:** a customer signature (canvas) with printed name and date on T&M tickets and COs. It prints on the PDF.
- **Timecards by cost code (SOV line):** regular and OT hours at 1.5×, base rate (blank = $0 flagged), optional 📍 location stamp (with permission), weekly hours by cost code, CSV export.
- **Project dashboard:** earned value (installed from daily logs vs budget), actual cost from timecards, CPI, forecast at completion, cost to complete with the math shown, and open RFI / submittal / punch / CO counts.
- **Bid tools:** leveling with plugs for excluded scopes, alternates with add / deduct, escalation clause, inclusions / exclusions / clarifications library (inserts into the quote notes), bid / no-bid.

## v1.7.0: Receiving, safety, weather, waste UI, bid form, past unit costs
- **Delivery / material receiving log:** ticket #, date, vendor, SOV/cost-code, qty, amount (blank = $0 + RFI), optional ticket photo, CSV export. Receipts roll into the dashboard earned-value AC via `RHMF.earnedValue`'s recv arg.
- **Safety:** toolbox / JHA sign-in (topic, date, leader, crew name + company) and incident report (date, who, what, injury Y/N, photos). Share opens mailto only — never auto-sends.
- **Weather delay documentation:** date, hours delayed, weather note (prefill from daily-log Open-Meteo when stored), impact, CSV export.
- **Waste factors UI:** optional waste % on takeoff lines and on bid-form lines; math shown via `RHMF.waste`. Blank = no waste added.
- **Unit-price bid form:** CSV import/export (TxDOT-style item #, desc, unit, qty, price, waste) using `RHMF.bidForm` / `bidTotals`. Blank price/qty = RFI; no invented prices.
- **Past-jobs unit costs:** browse averages from your own SOV unit prices (`RHMF.pastUnitCosts`); source + math labeled; blank when no data. Optional "completed projects only" filter.
- Home / More / Dashboard tiles for Receiving, Safety, Weather delays. VER `rhm-v1.7.0`.

## v1.8.0: Lookahead, documents, stamped photos, bid tabs
- **3-week lookahead:** 21 calendar days from a Monday start; Day / Activity / Crew / Location / Duration hrs / Done; hours math per week; CSV export; empty state with CTA.
- **Document control:** Doc #, title, rev, Current/Superseded/Void, type (Drawing/Spec/Addendum/Transmittal/Other), cite, issued, supersedes; Current-set filter; addenda filter; transmittal mailto summary only.
- **Photo log:** capture/upload burns project + CT time + GPS (or "GPS denied") onto the image before save; gallery + meta CSV.
- **Bid tab history** (Bid tools → Bid tabs): Our/Low bid spread math, Winner, rank, win-rate math; CSV. Blanks = RFI.
- More menu + Dashboard tiles for Lookahead, Documents, Photo log. VER `rhm-v1.8.0`.


## v1.9.0: Revision compare + true Excel export
- **Revision compare** (Plans → Compare revisions, or More → Rev compare): pick two stored sheets; old in red, new in blue, common linework dark via multiply. Opacity slider, nudge, two-point align, show/hide each layer, pinch/zoom, Save PNG or PDF (share/download only).
- **Excel (.xlsx) export** next to every log CSV (timecards, receiving, weather, lookahead, docs, photo meta, bid form, bid tabs, takeoff). Dependency-free writer in `js/xlsx.js` (zip STORE + OOXML); numbers as numeric cells; CSV formula-injection guard on text; header row bold.
- VER `rhm-v1.9.0`.


## v1.9.1: Round 4 bug hunt + stamped photos everywhere
- **Every field photo is stamped:** punch, daily log, receiving ticket, safety incident and pay-app backup photos use the same stamp as the Photo log (project + CT time + GPS, or "GPS denied" / "no GPS"), burned in before save. Photo log has an **All field photos** view with a Source column in CSV / Excel.
- Bug fixes: whitespace-only prices no longer count as a real $0 (RFI instead); bid-form import keeps "1,250" / "$1,200.50" and finds the Unit column even when "Unit Price" comes first; garbage dates no longer print NaN on RFI / submittal logs; typing a Doc # no longer asks to supersede a different doc mid-word; lookahead / weather ignore negative hours so the math adds up; escalation ignores a non-date firm date (flagged); rev compare reloads when you pick other sheets and no longer stacks wheel-zoom handlers; Excel keeps "00123" as text and "-5" as a number; address book entries with no company no longer break "Save customer".
- New test `tests/sweep.js` (hostile data on every route, both GPS allowed and denied). Fuzz covers more field / bid / Excel math and runs on 7 seeds.
- VER `rhm-v1.9.1`.

## v2.0.0: Welding, activity-linked consumables, Activities / Evolutions
- **Welding** (🔥 nav, Takeoff → Welding). Weld types: fillet, seal, CJP single/double V and bevel, PJP V/bevel, J, U (enter area from detail), plug, slot, stud (+2% attrition), tack. Pipe: butt by NPS + schedule, socket, branch/olet, flange WN / slip-on. Processes SMAW/GMAW/FCAW/GTAW/SAW; positions 1F-4F, 1G-6G.
  - Math (bot_logic/welding.md): LF = count x length x sides / 12; DI = count x NPS; deposited lb = A x 12 x 0.283 x LF; filler = deposited / efficiency x 1.05; arc hr = deposited / lb-hr; MH = arc hr / operating factor x position x field factor.
  - Deposition rates only from **PUBLISHED** data sheets (Atom Arc 7018, ESAB Dual Shield 7100 Ultra; URLs in Welding → Rates) or your own number. Blank rate or blank operating factor = MH NOT COMPUTED + RFI. welding.md MH tables are EXAMPLE only and never auto-used.
  - Welding screen tabs: Weld lines (map each to a Cost Data "Line Number" from YOUR licensed CSV import; CSV/XLSX export, no RSMeans data copied), Rates, WPS / PQR / WPQ log (WPQ continuity = last weld + 6 months, VERIFY; LAPSED flag), Codes (VERIFY). Takeoff also has NDE (ROUNDUP % + 2 per reject) and Preheat / PWHT lines.
- **Consumables** (🧰 nav, Takeoff line card, CO estimate card). Each activity's recipe is driven by its quantity: weld filler / flux / gas / discs; rebar tie wire, chairs, dobies (priced from accessories_pricelist.xlsx at each item's own markup, never the rebar markup); concrete curing compound, form oil, saw blades; machine fuel (optional move out of Equipment); PPE / small tools % of labor. Ratios without a cited source stay blank until you enter them (Consumables → Your ratios). ✎ override, ✕ remove, ➕ add, ↺ reset. Per-activity and job subtotals; "Put job consumables in the latest CO estimate" adds a Consumables step to the rollup with full math. Receiving tickets can be linked to a consumable (received vs needed).
- **Words**: Settings → Words = Activities (default) or Evolutions; a client can override. One helper (js/term.js) drives screen labels, help, PDFs and CSV/XLSX headers.
- VER `rhm-v2.0.0`.

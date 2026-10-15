# Known issues / gaps (updated v1.9.1, 2026-10-15)
- **iOS Share sheet and real-device memory** couldn't be tested here; the download fallback was tested. On a real iPhone, check: Share PDF, Back up now (Share → Save to Files), and loading a 30+ page set.
- **Reduced-set detection** uses paper size (11x17 or smaller) and "half size"/"reduced" notes. A full-size sheet printed on 24x36 but drawn for 30x42 can't be detected, so always check one known dimension. Two-point calibration is always the safe choice.
- **CRSI hook allowances** come from the CRSI MSP standard-hook table as reproduced by NCDOT Fig. 10-11 and irebar.com. Joe should confirm them against his CRSI manual and shop standard. Tie hooks above #8 become RFIs. Bend deductions aren't applied; dimensions are out-to-out.
- **Simple invoice** is a generic layout. Client-specific forms still need each client's template.
- **Big PDFs:** up to 60 pages per import (the picker appears above 20). Each page is stored as a 4096 px JPEG, about 1.7 MB.
- **Backup file size** grows with plan images (about 32 MB for 26 sheets). Restore merges by record id and doesn't delete anything.
- NCTCOG and RSMeans content is copyrighted, so only division-level summaries are included and no RSMeans data ships.
- Davis-Bacon wage rates must be entered from the SAM.gov WD for each project.
- OCR quality depends on the scan; always verify quantities.
- There is no cloud sync; data stays on one device plus the backup files.
- axe checks automated WCAG rules only. A manual VoiceOver/TalkBack pass is still recommended.

## v1.2.0 project types
- B31.8 / 49 CFR 192 test pressures depend on class location and design factor. The hydrotest template asks for the designed test pressure; it does not compute one.
- Pipe weights come from the ASME B36.10 OD/wall formula for carbon steel, NPS 1/2–24, Sch 40/80 or an entered wall. For stainless/alloy/HDPE, enter lb/ft from the supplier.
- Support spacing (MSS SP-58 / project spec), caliche/embedment densities, compaction allowance, NDE % and depth-class bands are user inputs. Nothing is defaulted from a standard table.
- The trench selector is a check of entered data. Soil classification and box ratings come from the competent person and the manufacturer's tabulated data. Over 20 ft always needs a PE design.
- Standards entries are plain-language summaries. API/ASME/AWS/AWWA/ASTM/MSS texts are paid publications and are not reproduced. The MSS site blocks automated fetches, so its edition was confirmed via the search index.
- Type SOV templates start with 0 quantities and prices (by design).

## v1.3.0
- Voice-to-text needs the Web Speech API (Chrome/Edge on Android, Safari on iOS 14.5+). Firefox and some in-app browsers show the keyboard instead.
- Haptics: iOS Safari does not support navigator.vibrate, so there are no buzzes on iPhone. Android works.
- No equipment, labor or tax-local rates are included. Every rate is user-entered; blanks show $0 plus an RFI.
- Hours from production come from production rates you enter in Cost Data. The app never assumes a rate.
- Swipe-to-delete needs a touch or pen swipe. With a mouse, use the item's Delete button.
- Tap counts were measured in Chrome device emulation, not on physical phones.

## v1.4.0
- Many code clauses, tables and catalog values in the bot files are marked VERIFY: CRSI bend types and hook tables, ACI development lengths, spirals, TxDOT 440 splices, TMS 402, GFRP, cut-length rounding, the 1/8" closure tolerance, AWS/ASME clauses and NDE %, IBC/IRC/IECC roofing items, AISC table numbers, deck psf, and ACI cover. They stay tagged until Joe confirms them. Only the OSHA Subpart P values were verified against the eCFR (an API pull; the site blocks plain page fetches).
- The groove-weld labor formula is a placeholder (UNCALIBRATED). The app only uses the MH/LF rate you enter.
- The Takeoff check asks before saving but never blocks a takeoff line; the user decides. On quotes, BELOW COST blocks sending.
- Two arithmetic slips in the bot docs (concrete §9 ductbank 0.103 → 0.0947 CY/LF; competitive quote $/T 1,668.37 → 1,668.42) were reported. The app uses the exact math.

## v1.7.0
- Weather-delay prefill only uses a daily log that already has weather filled (typed or Open-Meteo). It never invents conditions.
- Past unit costs only average SOV lines with a real unit price and a non-LS unit. Mark projects complete when they finish if you want the "completed only" filter.
- Bid-form CSV import needs Description and Quantity columns; blank unit prices stay blank and flag an RFI.
- Receiving amount blank = $0 on the dashboard AC plus an RFI — never a guessed price.
- Safety share / email opens the mail app only after the user taps; nothing auto-sends.

## v1.9.0
- **Revision compare** tints linework by luminance (dark ink → red/blue; light paper → transparent) then multiplies layers so overlapping ink goes dark. Scanned sheets with heavy gray background may look muddy — raise New opacity or toggle one layer. Color photos / rendering sheets are not ideal; line drawings work best.
- Two-point align needs four taps (old1 → new1 → old2 → new2). One pair only translates; two pairs set scale + rotation. Nudge buttons move the new sheet in screen pixels scaled by zoom.
- Overlay PNG/PDF is share sheet or download only — nothing auto-sends. Full-res snapshot uses the old sheet’s pixel size.
- **XLSX** is a minimal STORE zip (no compression) with sharedStrings + bold header style. Opens in Excel / Sheets / openpyxl. Formula-injection guard prefixes text cells that start with `= + - @` (same as CSV). Numbers without commas/$ become numeric cells; currency-formatted strings stay text.
- Ranks 24–25 still deferred (geofence clock-in; multi-user cloud).

## v1.8.0
- **Photo GPS** is optional. If the user denies location (or the device has no GPS), the photo still saves with a burned-in stamp that says "GPS denied" or "no GPS" plus project name and America/Chicago time.
- The stamp is drawn as a semi-transparent bar on the bottom of the JPEG before IndexedDB storage. Very tall/narrow images may crowd the text; caption is truncated on the gallery tile, full text is in the enlarge view and CSV.
- ~~Punch / daily / receiving / safety photos unstamped~~ — fixed in v1.9.1 (see below).
- Document "mark Current → supersede prior same Doc #" asks once via confirm; cancel leaves prior revs Current.
- Bid tab win rate only counts rows with Winner filled; type "Us" or "Rebar-Fab" (not rank alone) to count a win. Blank Our/Low bid = RFI, never invented.
- Lookahead never prefills fake work; hours math is from activities you add. Start Monday floored from today (or the date you pick).

## v1.9.1 (Round 4 bug hunt)
- **Every field photo is now stamped** (photo log, punch, daily log, receiving, safety incident, pay-app backup) with project + America/Chicago time + GPS or "GPS denied" / "no GPS", burned into the JPEG before it is saved. The location prompt can add up to ~8 s per photo when the phone is slow to answer; with a mixed batch the cached fix (≤ 60 s old) is reused. Coordinates are never invented.
- Photos taken **before v1.9.1** stay unstamped (the pixels can't be re-stamped honestly after the fact). The Photo log "All field photos" view and CSV mark them "not stamped (pre-v1.9.1)".
- "no GPS" now means the device had no fix / timed out; "GPS denied" means the user said no. Earlier builds labeled both "GPS denied".
- Bid-form CSV import strips `$`, commas and spaces from Qty / Unit Price / Waste % ("1,250" → 1250, "$1,200.50" → 1200.50, "5%" → 5). Text like "TBD" stays as typed and is flagged as a blank RFI — never converted to a number.
- Lookahead and weather-delay totals ignore negative hours (the row shows "ignored (negative)" and the week formula notes how many were skipped).
- Escalation: a firm-through date that is not a real date is treated as blank (0 quarters) and flagged — it is never guessed.
- Excel export keeps leading-zero codes ("00123" tickets) and 16+ digit IDs as text, writes strict negative numbers ("-5") as numbers, strips XML-illegal control characters, and caps a cell at 32,767 characters (Excel's limit).
- Pay-app backup photos are stamped too. If you attach a scanned invoice image there, it will also carry the stamp bar along the bottom.

## v2.0.0
- Published deposition data covers SMAW E7018 (Atom Arc) and FCAW E71T-1 (ESAB 7100 Ultra, 100% CO2) only. GMAW solid wire, GTAW, SAW have no loaded chart: enter your own lb/hr, or MH is not computed (RFI).
- Operating factor (arc-on %) is never defaulted; MH stays blank until you enter yours.
- Pipe OD / wall (ASME B36.10M) and the 37.5 deg / 1/16 in bevel (B16.25) were entered from memory: VERIFY (listed in Settings → Assumptions). Sch 160 table stops at NPS 8 (larger = error, not a guess).
- Deposition efficiency, position and field factors are welding.md DEFAULT - CONFIRM values. Groove MH via your MH/LF is UNCALIBRATED.
- J- and U-groove volume needs the cross-section area from the joint detail / WPS (no generic formula carried).
- Consumable ratios for chairs, dobies, tie wire, gas, discs, curing, form oil, blades have no free cited source loaded: they show "ratio needed" until you enter yours. Only filler = 1:1 with takeoff filler and SAW flux 1:1 (welding.md §2.6) are fixed.
- Machine fuel stays inside Equipment by default; tick "move fuel to Consumables" on the CO estimate to split it out (totals unchanged).
- Received-vs-needed compares receipt quantity to the consumable quantity as typed; units must match (no unit conversion).
- The Words picker itself still lists "Activities" as a choice when Evolutions is on (by design).
- tests/smoke.js is still the out-of-date v1.0 scratch script (blocked by the tutorial overlay); not part of the suites.

# Right Hand Man — gap analysis (through v1.9.0)
Designed by Joe Dane Lucero P.E. · 2026-10-15

Compared against what estimators and field/PM staff rely on daily in **Procore** (RFIs, submittals, punch, documents, daily, dashboards), **HCSS HeavyBid** (bid items, resources, quote leveling/"bid day", alternates, cost history), **HCSS HeavyJob / B2W Track** (timecards by cost code, quantities installed, earned value/forecast, T&M with signatures, safety), **PlanSwift / Bluebeam / STACK** (takeoff, waste factors, overlays/revision compare, bid forms), **Raken** (daily reports, toolbox talks, time, photos with stamps), **Fieldwire** (punch on plan pins, tasks, lookahead).

Score: **Value** 1–5 (how often Joe's team needs it × money/risk it protects), **Effort** 1–5 (build size in this PWA). Rank = Value ÷ Effort, ties broken by value.

| Rank | Gap | Who uses it | Value | Effort | V/E | Round |
|---|---|---|---|---|---|---|
| 0 | **Joe's expert-bot construction logic in every trade template + Takeoff check before save / before send** (new top priority, 11:19) | Estimator / field | 5 | 3 | 1.7 | 1 ✅ |
| 1 | Signature capture (finger) on T&M tickets and change orders | Field / PM | 5 | 1 | 5.0 | 2 ✅ (v1.6) |
| 2 | Quantities installed vs. budget, earned value, cost-to-complete forecast, per-project dashboard | PM | 5 | 2 | 2.5 | 2 ✅ (v1.6) |
| 3 | RFI log + submittal log with status and ball-in-court, days open | PM | 5 | 2 | 2.5 | 2 ✅ (v1.6) |
| 4 | Bid-day quote leveling (subs/suppliers, scope gaps plugged, low leveled bidder) | Estimator | 5 | 2 | 2.5 | 2 ✅ (v1.6) |
| 5 | Timecards per cost code (SOV line), optional location stamp with permission | Field | 4 | 2 | 2.0 | 2 ✅ (v1.6) |
| 6 | Export logs to Excel (CSV) | PM / office | 4 | 1 | 4.0 | 2 ✅ (v1.6/1.7) |
| 7 | Inclusions / exclusions / clarifications library on proposals | Estimator | 4 | 1 | 4.0 | 2 ✅ (v1.6) |
| 8 | Escalation clause (firm through date, then +$/cwt per quarter on unshipped tons, tariffs passed through) | Estimator (rebar) | 4 | 1 | 4.0 | 2 ✅ (v1.6) |
| 9 | Alternates and add/deducts | Estimator | 4 | 1 | 4.0 | 2 ✅ (v1.6) |
| 10 | Bid / no-bid checklist | Estimator | 3 | 1 | 3.0 | 2 ✅ (v1.6) |
| 11 | Waste factors with math | Estimator | 4 | 1 | 4.0 | 2 ✅ math + UI (v1.7) |
| 12 | Delivery / material receiving log with ticket photo | Field | 4 | 1 | 4.0 | 2 ✅ (v1.7) |
| 13 | Punch list with photos and sheet pin | Field / PM | 4 | 2 | 2.0 | 2 ✅ (v1.6) |
| 14 | Safety: JHA / toolbox talk sign-in, incident report | Field | 4 | 2 | 2.0 | 2 ✅ (v1.7) |
| 15 | Weather delay documentation | Field / PM | 3 | 1 | 3.0 | 2 ✅ (v1.7) |
| 16 | Unit-price bid form import/export (CSV, TxDOT-style item numbers) | Estimator | 4 | 2 | 2.0 | 2 ✅ (v1.7) |
| 17 | Past-jobs unit cost database (from Joe's SOV unit prices on completed jobs) | Estimator | 4 | 2 | 2.0 | 2 ✅ (v1.7) |
| 18 | 3-week lookahead schedule | PM | 3 | 2 | 1.5 | 2 ✅ (v1.8) |
| 19 | Document control (current set, superseded, transmittals) + addenda log | PM / estimator | 3 | 2 | 1.5 | 2 ✅ (v1.8) |
| 20 | Photo log with GPS/time stamp burned in | Field | 3 | 2 | 1.5 | 2 ✅ (v1.8) |
| 21 | Bid tab history (who won, by how much) | Estimator | 3 | 2 | 1.5 | 2 ✅ (v1.8) |
| 22 | Revision compare (overlay two sheets, red/blue) | Estimator / PM | 4 | 3 | 1.3 | 2 ✅ v1.9 |
| 23 | XLSX (true Excel) export | Office | 2 | 2 | 1.0 | 3 ✅ v1.9 |
| 24 | Geofenced auto clock-in | Field | 2 | 4 | 0.5 | deferred (privacy + battery; manual clock-in with optional location stamp instead) |
| 25 | Multi-user sync / cloud | All | 5 | 5 | 1.0 | deferred (needs a server; app is offline single-device by design — backup file covers transfer) |

Rules kept everywhere: every number shows its math with sheet / PDF page / spec cites; no prices or rates shipped (blank = RFI, demo values flagged EXAMPLE); nothing auto-sends (share sheet / mailto only); rebar quotes keep Material / Trucking / Shop Drawings columns and never say "all-in"; 48 px+ targets.

## Round plan (5-hour block, 11:15 AM - 4:15 PM CT)
- **Round 1 (v1.4.0):** bot logic from all 13 bot_logic files + the rebar skill → js/rules.js (formulas, 9 new trade templates, 40+ Takeoff-check rules with Rule source, VERIFY / DEFAULT tags, Settings "Assumptions for Joe to confirm"), save gate, quote gate (all-in, concrete, 1-week fab, BELOW COST blocks send), shop-drawing VERIFY vs CRSI + fab tolerance 0 to +5%. Field/bid math engine (js/calc_field.js) with tests.
- **Round 2:** Baseline Cost dataset (TxDOT bid item averages, DFW bid tabs, Joe's past quotes, BLS / Davis-Bacon) + "Baseline avg" and variance on takeoff / quote / CO lines.
- **Round 3:** Field + PM UI from the ranked list (v1.6: ranks 1–10, 13)
- **Round 3b (v1.7.0):** ranks 11–12, 14–17 UI (receiving, safety, weather, waste, bid form, past costs) (signatures on T&M / CO, RFI + submittal logs, punch with pins + photos, receiving, safety, weather, timecards, dashboard with earned value, CSV export) and the bid tools UI (leveling, alternates, escalation, clauses library, bid/no-bid, bid form import/export, past unit costs).
- **Round 3c (v1.8.0):** ranks 18–21 (3-week lookahead, document control + addenda, stamped photo log, bid tab history).
- **Round 3d (v1.9.0):** ranks 22–23 (revision compare overlay, true XLSX export).
- **Round 4:** randomized-input bug hunts (Playwright fuzz), performance checks (load time, big plan sets, 1,000-line takeoff), full regression, docs.
- **Round 4 (v1.9.1, 3 PM CT hour):** ✅ shipped. Photo stamp on every field photo caller (punch, daily, receiving, safety, pay-app backup — same path as the Photo log: project + CT time + GPS or "GPS denied"/"no GPS" burned in before IndexedDB). Focused bug hunt with a new hostile-data route sweep (`tests/sweep.js`, 2 devices, GPS allowed + denied) — 12 fixes (see TEST_LOG v1.9.1). Fuzz widened to lookahead / bid tabs / days-open / EV / bid-form import / escalation / XLSX and run on 7 seeds, 0 problems. Full regression + perf budgets re-run. Ranks 24–25 still deferred.
- Ranks 2-17 below move to rounds 3-4; 18+ as time allows.

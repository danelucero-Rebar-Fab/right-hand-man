# Right Hand Man v1.3.0 — UX review (Nielsen heuristics)
Designed by Joe Dane Lucero P.E.
Devices: iPhone 13 (390x664), Pixel 7 (412x839), iPad gen 7 (810x1080). Screenshots: screens/ux/old_* (v1.2.0) and new_* (v1.3.0).

| # | Heuristic | Finding in v1.2.0 (screens) | Fix in v1.3.0 |
|---|---|---|---|
| H1 | Visibility of system status | No save feedback; blank screen while routes load; the calibrate result was easy to miss | "Saving… / ✓ Saved" pill on every DB write; skeleton screens after 120 ms; "Scale set ✔ - Length tool is ready" toast plus haptic; nav marks the current screen (aria-current) |
| H2 | Match with the real world | Feet had to be decimal; jargon labels (SOV, ppf) | 12'-6" / 12 6 / 12.5 parsing with "= 12.50 ft" read-back; plain labels plus a '?' on every field |
| H3 | User control and freedom | Delete had no undo; 🏠 was the only way out | Swipe-to-delete with a 5 s UNDO; persistent bottom nav (phone) and sidebar (tablet); Escape closes sheets; "Change client" inside the quick project flow |
| H4 | Consistency | Main action moved around on some screens | One sticky primary per screen; the same + quick-add sheet everywhere |
| H5 | Error prevention | Negative or >100% values were accepted silently; wrong keypad | Inline warnings (negative, >100%, email, unreadable length); inputmode decimal/numeric on every number field; submitted pay apps can't be swiped away |
| H6 | Recognition over recall | Users had to remember where they were and which template they used | "▶ Continue: <screen · project>"; recent projects; "Use again" takeoff templates; saved project templates; global search |
| H7 | Flexibility and efficiency | Every task started from Home | Quick-add (11 actions); duplicate a project or pay-app period; "Import all" on shop drawings; "Skip to review" on pay apps; today's log pre-filled from yesterday |
| H8 | Minimalist design | Empty lists showed blank cards | Empty states with a single next step |
| H9 | Help users recover from errors | "NaN" and generic errors | Friendly messages ("Couldn't read "12'-x". Try 12'-6" or 12.5"); aria-invalid plus a message linked to the field |
| H10 | Help and documentation | Help only in the tutorial | Inline '?' help on every field; tutorial kept |
| — | Accessibility / field use | 16 px text; light theme only | 18 px default; text size M/L/XL; dark mode (auto/light/dark); outdoor and glove modes kept; 48 px+ targets; axe 0 violations in light, dark, XL and dark+XL |

Per-screen notes: Home, Projects, Project setup, Plans, Takeoff (+ wizard step 3), Daily list/form, Pay app, CO/quote, Shop, Standards, Costs, Settings, Search, Quick add and About were each checked on all 3 devices (old and new screenshots). On the iPad the sidebar replaces the bottom nav, so the content gets the full height.

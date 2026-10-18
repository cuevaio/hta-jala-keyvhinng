# Reference journey design QA

final result: passed

## Source and rendered evidence

Source visual truth: the supplied CleanShot references, especially:

- Home: `/Users/keyvhinng/Library/Application Support/CleanShot/media/media_fTPUheJ3Qh/CleanShot 2026-10-18 at 4.35.28 AM@2x.png`
- Destination: `/Users/keyvhinng/Library/Application Support/CleanShot/media/media_G3yyzhaHt3/CleanShot 2026-10-18 at 4.36.25 AM@2x.png`
- Admin: `/Users/keyvhinng/Library/Application Support/CleanShot/media/media_CJ4DItFMJE/CleanShot 2026-10-18 at 4.38.32 AM@2x.png`

Browser-rendered screenshots (local QA artifacts): `/tmp/jala-home-final.png`, `/tmp/jala-destination-final.png`, `/tmp/jala-selfie.png`, `/tmp/jala-group.png`, `/tmp/jala-chat.png`, `/tmp/jala-route.png`, `/tmp/jala-safety.png`, `/tmp/jala-qr.png`, `/tmp/jala-verify.png`, `/tmp/jala-fare.png`, `/tmp/jala-saved.png`, `/tmp/jala-trips.png`, `/tmp/jala-ratings.png`, `/tmp/jala-admin-final.png`, `/tmp/jala-admin-mobile-final.png`.

Combined comparison inputs: `/tmp/jala-home-comparison-final.png`, `/tmp/jala-destination-comparison-final.png`, `/tmp/jala-admin-comparison.png`. These place the source and rendered implementation in the same image and were opened for visual review. Home spacing was subsequently tightened; the latest standalone screenshot is `/tmp/jala-home-final.png`.

Viewports: passenger 390 × 844 CSS px, narrow-screen checks at 320 × 780, desktop admin 1512 × 1100. Screenshots are at density 1. Source destination is 716 × 1434 pixels; the 625 × 1350 app region was scaled to 390 × 844. Home source app region is 625 × 1340, scaled to 390 × 836. The implementation's 29px demo disclosure was removed from comparison crops; on a mobile screen it intentionally reduces available app height by 29px. Admin source is 2020 × 2112, normalized to the same width as the implementation. Rounded screenshot frames and the Next development indicator are not product-owned comparisons.

## Required fidelity surfaces

- Typography: existing Plus Jakarta Sans retained; bold compact headings, orange second lines, muted body text, and clear form hierarchy reproduce the reference. Initial inherited heading colors were corrected. Body and home spacing were tightened following the combined comparison.
- Spacing/layout: separate passenger screens, narrow column, form rhythm, clipped/scrollable district list, full-width primary buttons, itinerary, bottom tabs, chat composer, safety sheet, QR, saved summary and ratings follow the reference. Admin uses a dark header, floating controls, four metrics, plotted routes and adjacent group table. At 320px, table scrolling stays inside its region and page width equals viewport width.
- Colors/tokens: dark teal, orange actions, pink group accents, pale teal selections and light neutral inputs match the source palette. Muted text was darkened where automated contrast checks identified failures.
- Images/assets: existing project logo intentionally retained rather than replacing the established brand with the reference's alternate wordmark. Real selected photos and a licensed sample portrait replace illustrative example selfies; initials remain the existing avatar fallback. These are deliberate asset choices. QR is encoded by qrcode.react, not an illustrative pattern. Route diagrams are actual plots of the simulation model, not image stand-ins for live routes. Decorative promo ring omitted as nonfunctional P3 polish.
- Copy/content: Spanish reference labels and sequence retained. Deliberate disclosures identify sample data, unavailable SMS, browser-local history/ratings, synthetic routes and manual demo verification. Live email authentication links directly into the existing live ride flow. Financial amounts are computed from segment-distance shares, with exact cents rather than copying rounded reference totals.

Focused controls and text were readable in the full-size combined mobile comparisons. The admin comparison was supplemented with a full-size 1512px screenshot for table, chart, and metric inspection.

## Comparison history and fixes

1. Initial capture found P1 inherited dark text hiding promo and admin titles. Set explicit white heading colors and recaptured home/admin; titles are visible.
2. Initial destination comparison found P2 excess header/list-row padding and bold timing labels. Reduced header and row padding and set regular legend weight; final destination comparison shows aligned structure.
3. Admin narrow-screen check found P2 document overflow (372px at a 320px viewport). Added min-width:0 to grid sections and stats; post-fix document width is 320px.
4. Accessibility checks found P2 muted text contrast in admin controls and the home destination preview, plus the selected role helper. Darkened muted colors. Added keyboard access and an accessible region label to the scrollable admin table. Post-fix audits: admin, home, and ratings have zero WCAG 2 A/AA violations. Destination has zero violations; automated contrast review flags offscreen clipped district nodes as incomplete, whose text tokens are the same compliant colors as visible rows.
5. Combined home comparison showed P2 excess spacing before the search card and a wrapping privacy note. Tightened intro/heading margins and privacy type; recaptured the final home screen.

## Primary interactions verified

- Required name entry → home → destination selection, address entry, time/role choices → selfie → group.
- Sample selfie selection, open group chat, send a typed message, return to group; message count updates.
- Open/close safety modal; it traps focus through native dialog behavior. Emergency dialing and external sharing were not invoked.
- Open route plot, return, show an encoded QR, reject an incorrect code, accept the example code, and enable the meeting-complete action.
- Reject a negative fare, split a positive fare, start trip, show saved trip, open browser-local history, rate three companions with yes/no selections.
- After trip start, there are no selfie image nodes and no photo data in localStorage. The only persisted key is the versioned sample history key.
- Change all admin controls and regenerate; metric values and plotted/table routes update.
- Console/runtime error checks returned no errors.

## Verification and limits

Lint, type generation/TypeScript and production build passed. Vitest: 170 passed, 49 database-dependent tests skipped by existing configuration. Live database/auth service end-to-end tests were not run; their existing implementation remains reachable and unchanged.

The passenger reference journey is a frontend sample, not a production SMS/QR/ride-history backend. `/admin` is a synthetic public validation panel, not privileged administration. These boundaries are visible in the UI and README.

No actionable P0/P1/P2 findings remain within this frontend reference-flow scope. Follow-up P3 polish: use the final reference brand assets if supplied; reproduce the decorative promo ring; replace the sample portrait with approved illustrated avatars.

Final code review: Approve within the documented sample-frontend scope. Rebased onto main with its notification/matching improvements preserved; lint, types and tests rerun after rebase. The production build was also rerun.

The clean post-rebase production build passed after moving aside a cache containing a sandbox-denied worker-socket error. No application code change was needed.

# Jala frontend direction

## 1. Change summary

Apply the frontend-design skill to the existing home → event → join → waiting-room journey.
Make the interface recognizable, readable on a phone after an event, and accurate about the
current shared-session milestone. Backend behavior and the planned group engine are outside
this visual implementation.

## 2. Existing system

Preserve server-rendered event pages, the existing session API adapter, browser identity,
transactional joins and polling. Current shared styles are generic shadcn defaults and the
root layout constrains every screen to the same narrow width. The session form and room already
have working pending/error/expiry states; retain their semantics and form contracts.

## 3. Design system and approach

_Updated 2026-10-18: the visual language now follows the `jala-saint-v2` prototype; the
features and contracts below are unchanged._

- Ink `#12343B`: text, headings and dark surfaces (place pass, fare share, CTA band).
- Orange `#FF6B35`: the one primary action per screen, routes and map stops. Text on
  orange is ink, never white.
- Sage `#F3F6F4` / Surface `#F5F7F8`: section bands and grouped rows.
- Line `#E1E7E4`, muted text `#56676B` (AA on white).

Plus Jakarta Sans 400–800 for everything; headings are heavy with tight tracking. The
wordmark is `jala↗`. Type floor stays at 12px metadata and 16px inputs.

Landing follows the prototype's structure: hero (headline, origin/destination search,
route illustration) → three steps → benefits on a sage band → real places → dark CTA band.
The hero search only carries what was typed to `/ride` (`dq`), where the destination
picker runs the address search so the person chooses the exact match.

The ride form is two panels beside one shared map with both pins; a toggle chooses which
pin a tap places. Session rooms use a main column plus a side column (map and meeting
point for a matched group, destination and invite for the waiting pool); on phones the
matched group's map and meeting point come first.

Removed as noise: the driver panel, fake prices and passenger counts, the trust strip,
manual coordinate entry, and repeated per-card "ficticio" labels (one page note remains).
The hero illustration states real rules (groups of 2–3, fare by distance) and no
invented data.

## 4. Contract

Preserve API payload field names and mutation behavior. Inputs keep visible labels, required
validation and numeric coordinate limits. Error, pending, membership and expiry states remain
visible. The page shows a shared waiting pool; it must never imply that a vehicle group has
already been assigned. Exact destinations remain private to the requesting participant.

## 5. Risks and edge cases

Check long fictional event names, zero events, empty roster, loading, backend error, no willing
delegate and expired session. Use narrow-screen stacking, minimum 44px controls and visible
keyboard focus. Respect reduced-motion preferences; the only unsolicited animation is the
hero routes drawing in once, disabled under reduced motion. Fonts are self-hosted by
next/font at build time.

## 6. Verification

Run formatting, lint, type checking and production build. Inspect desktop/mobile screenshots
and walk the existing join/refresh journey. Existing domain/API tests remain relevant; do not
add tests that only assert CSS class names. Apply the React and code-review checklists after
implementation.

## 7. Reviewability

Changes are confined to layout, global design tokens, public pages and presentation components.
No dependencies, database migration, matching simulation or backend redesign is required.
The visual vocabulary is documented here for the next group-proposal slice to reuse.

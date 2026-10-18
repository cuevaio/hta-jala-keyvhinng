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

- Cobalt `#2457E6`: main actions and the distinctive departure-pass illustration.
- Ink `#162C45`: readable text and headings.
- Paper `#F6F8FD`: page canvas.
- Sky `#E6EEFF`: supporting surfaces and route context.
- Yellow `#F6D65B`: departure marker, used sparingly.
- White `#FFFFFF`: form and ticket surfaces.

Barlow Condensed, weights 600/700/800, carries the energy of event posters and transport signs.
DM Sans carries body text, controls and user information. Use sentence case throughout.

Layout: left-aligned, spacious desktop composition with a narrower form reading column.
The home page's one expressive element is a departure pass with three paths leaving one point.
Event rows adapt the ticket structure into useful date/event/action columns. Waiting-room
members form one roster rather than a pile of unrelated cards.

    Desktop home                     Mobile home
    [Jala]               [Eventos]   [Jala]      [Eventos]
    [Headline] [Departure pass]      [Headline + action]
    [Copy/CTA] [Route illustration]  [Departure pass]
    [Three sequential actions]      [Sequential actions]

    Event detail                    Session
    [Event + venue] [Join pass]      [Back to event]
    [Meeting-point list]            [Title + expiry]
                                    [Form or shared roster]

Plan critique: the first idea used identical feature cards, which would be interchangeable
with a generic app. Replace them with one connected sequence and a single departure-pass
illustration grounded in this product. Do not introduce invented savings, safety claims,
matching results or fake route data to make the design look complete.

## 4. Contract

Preserve API payload field names and mutation behavior. Inputs keep visible labels, required
validation and numeric coordinate limits. Error, pending, membership and expiry states remain
visible. The page shows a shared waiting pool; it must never imply that a vehicle group has
already been assigned. Exact destinations remain private to the requesting participant.

## 5. Risks and edge cases

Check long fictional event names, zero events, empty roster, loading, backend error, no willing
delegate and expired session. Use narrow-screen stacking, minimum 44px controls and visible
keyboard focus. Respect reduced-motion preferences; no unsolicited page animations. Fonts are
self-hosted by next/font at build time. Keep manual coordinate entry honestly labeled until
address/map entry is implemented as a separate product slice.

## 6. Verification

Run formatting, lint, type checking and production build. Inspect desktop/mobile screenshots
and walk the existing join/refresh journey. Existing domain/API tests remain relevant; do not
add tests that only assert CSS class names. Apply the React and code-review checklists after
implementation.

## 7. Reviewability

Changes are confined to layout, global design tokens, public pages and presentation components.
No dependencies, database migration, matching simulation or backend redesign is required.
The visual vocabulary is documented here for the next group-proposal slice to reuse.

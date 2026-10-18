# UX pass

Fixes from a manual review of the phone-after-a-venue journey.

**Done**

- Action errors persist until the next action (polling no longer erases them).
- Copy matches the product: no roadmap text, no "free rides" promise, no pitch language;
  one phrase for the booker ("quien reserva el taxi").
- Matched view has a route map, a "Tu parte" card in soles (percentage secondary) and a
  fare field that validates its input.
- Leaving is styled as destructive and states how many people it affects.
- Branded `not-found`, `error` and `loading` pages.
- Type floor: 14px body copy, 12px metadata. Inputs are 16px so iOS does not zoom.
- Join form: address search (Nominatim, only on submit), a visible reason when the join
  button is disabled, two-finger map gestures on touch, accessible map labels.
- Room loads on the server (no spinner), polling pauses in hidden tabs, focus moves to the
  new heading on every screen change, WhatsApp share and a "copied" state that resets.
- Header: right-aligned account controls, mobile menu, active link, reserved auth space.
- Place names are clean in the data (no `[DEMO]` stripping in three places); meeting
  points are listed in the order matching uses them.
- API errors are Spanish and user-safe.

**Not done, on purpose**

- "Use my location": the pickup is the place's meeting point and the destination is not
  where the person is, so GPS would add a permission prompt without helping the join.
- Replacing the hand-written stylesheet with Tailwind/shadcn components and adding
  success/warning tokens: a larger refactor best done as its own change.
- The dark theme was deleted instead of being finished.

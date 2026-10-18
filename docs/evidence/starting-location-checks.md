# Starting-location checks

Initial checks on 2026-10-18 using an isolated browser session and the task worktree.
The dropdown described below was subsequently simplified to a direct address field
and **Usar mi ubicación** button; see the follow-up checks at the end.

- Home offers current location, **Otra dirección** and featured places.
- Choosing **Otra dirección** exposes a required starting-address input.
- Entering `Plaza San Martín, Lima` and destination `Miraflores` carries both
  addresses into `/ride`; both show actual Nominatim search results.
- Selecting the Lima results and submitting public discovery returned HTTP 200.
  The request used the selected origin (`-12.0516596, -77.0346048`) and destination
  (`-12.121498, -77.0259064`); the UI displayed the no-matching-rooms state.
- **Cambiar mi ruta** restores the selected addresses and map points.
- GPS is requested only by **Usar mi ubicación**. With the browser geolocation
  boundary replaced by controlled callbacks, typing another starting address
  before GPS resolves prevents the late callback from replacing that address.
- A controlled GPS denial preserves the typed address and displays the manual
  entry/map fallback message. A subsequent successful GPS retry resolves its address.
- No browser page errors were reported.

Checks: lint and typecheck passed; 93 tests passed, with 33 integration tests
skipped by the existing environment configuration. This check covers public
origin selection and discovery, not authenticated joins or real taxi trips.

## Follow-up: direct starting-address entry

- Removed the home starting-point dropdown. A single **Punto de partida** field
  accepts an address directly and offers **Usar mi ubicación** beside its label.
- Typing `Plaza San Martín, Lima` and `Miraflores`, then continuing, preserves both
  texts on `/ride` and displays actual address search results.
- At a 320 px viewport, the home page content width is 320 px and the form has no
  starting-point select menu.
- Controlled GPS denial displays the address-entry fallback. A successful retry
  uses actual reverse geocoding to fill the starting address, and continuation
  carries the GPS coordinates into `/ride`.
- Lint and typecheck passed; 93 tests passed, 33 existing integration tests skipped.

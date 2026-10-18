# Starting-location checks

Checked locally on 2026-10-18 using an isolated browser session and the task worktree.

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

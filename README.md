# palomares-site

Pages for palomares.app, served by GitHub Pages. Plain HTML and one
stylesheet; no build step, external fonts, analytics or embedded forms. The only
scripts are the Guide's own and Apple's MapKit JS, on `guide/` alone.

- `index.html`: the night-road holding page and a link to beta information.
- `beta/`: the first invited TestFlight pilot, recording guidance, optional ride
  submissions, and email/TestFlight feedback. No public join link is available yet.
- `privacy/`: the current app's location/sensor use, storage and deletion, sharing,
  review exports, TestFlight, Zoho email, and GitHub Pages hosting.
- `safety/`: Safety and limits, the app's two one-time agreements (Before you ride,
  Before coaching) word for word, as in Garage ▸ Safety and limits. When the app's
  words change (`Agreement` in RideLogger's `Features/Safety/Agreements.swift`), change
  them here too.
- `guide/`: the Guide, curvy roads and loops near a town, ZIP or the browser's location,
  from the app's road library (2026-10-29). `index.html`, `guide.css`, `guide.js` (no
  libraries) and `mapkit-token.js`. Wide windows: Apple's map fills the page and the list
  floats over it as the site's night sky; narrow ones: search, map, then the list. One
  page: `?at=lat,lon&place=…&sort=…` lists roads, `&road=<ref>` shows one (a ref is its
  home tile and a hash of the app's road id, so links survive a rebuild that keeps the
  road). Searching runs in the browser; nothing is sent to us.
  - `guide/data/` is generated, never edited: RideLogger's `tools/_run web_guide.py
    --gazetteer <dir>` splits `RideLogger/Roads/index-usa.json` into 1° tiles (each road
    in every tile its line touches), writes each road's card sentences
    (`road_words.index_sentences`, the app's words), numbers, rating parts and note, and
    loop lines into them, puts loops' connecting roads in `joins/`, and town and ZIP
    centers from the Census 2024 Gazetteer in `places/` and `zips/`. Rerun it whenever
    the road index or the words change (with `tools/open-data sync`).
  - `mapkit-token.js`: the MapKit JS token from Gabe's developer account (Certificates,
    Identifiers & Profiles ▸ Services ▸ Maps ▸ Tokens; MapKit JS, domain palomares.app,
    no expiry). Apple honors it only on palomares.app; anywhere else, or if Apple's code
    doesn't load, the Guide draws the roads on their own and says so. For local checks,
    a short-lived unrestricted token goes in the browser's storage only:
    `localStorage.setItem('palomares.mapkitDevToken', '<token>')` on localhost. Never commit it.
- `data/`: the open-data page and the two ODbL files the app ships: `index-usa.json`
  (a copy of RideLogger's `RideLogger/Roads/index-usa.json`, the lower 48 since 2026-10-28) and `track-outlines.json`
  (only the OpenStreetMap-derived fields of RideLogger's `TrackCards.json`). Refresh both whenever
  an app release changes them.
- `style.css`: neutral surfaces, teal controls, system fonts and the night road,
  following RideLogger's brand guide. Supports light/dark appearance and phone/
  desktop layouts. Skip links and visible keyboard focus are included.
- `.nojekyll`: serve the static files directly when Pages is enabled.

## Status — October 29, 2026

Live at palomares.app on GitHub Pages over HTTPS since October 26. The privacy policy
is effective October 29, 2026 (the Guide's location on iPad, and the site as hosted).

October 29 (Gabe approved the proposals): the beta page names the lower 48, describes
Coaching as it now works, carries the app's Before you ride points and small print,
and starts its first step with the agreement; a fourth screenshot shows Coaching; the
new `safety/` page and a Safety link in every footer; the data page's date is
October 28. The home tagline and "free during the beta" are unchanged.

The policy names **K. Gabriel Coelho-Kostolny** as publisher. Beta emails, submitted
rides, attachments and extracted copies are kept through the beta. The copies we
control are deleted within 90 days after it ends. Earlier deletion requests can
be sent to beta@palomares.app. Include that cleanup in the beta closeout process.

Still to do: add the actual TestFlight join link only when the public beta is available.

The first friends pilot uses email and TestFlight feedback. A hosted feedback form
can be added later, with its provider and data handling described in the policy.

## Assets and reproduction

All assets are local in `assets/`:

- `wordmark.svg`: the app's Palomares wordmark vector, also inlined in the pages
  with `fill="currentColor"`. Its proportions are unchanged.
- `app-icon.png`: the existing night-road app icon, 256 px.
- `hero-wide.svg`, `hero-tall.svg`: the night-road scene from RideLogger's
  `docs/design/palomares-branding/icon-concepts/night-road/build_night_road.py`.
  The existing scene and framing are unchanged.
- `screen-ride.jpg`, `screen-replay.jpg`, `screen-corner.jpg`, `screen-coaching.jpg`:
  captured October 29 from a debug build of RideLogger `f0c048d` in the iPhone 17 Pro /
  iOS 27 Simulator, dark appearance, large text and a 9:41 status bar. The first three
  show the bundled Palomares Road sample `2026-10-24_122105_Sample`; Coaching (For you)
  shows Gabe's own nine rides of October 20–24 (their analyzed files copied into the
  Simulator; the sample never counts toward coaching). Captures keep the complete screen
  and Apple Maps attribution.
- `share-story.jpg`: the app-generated Story picture from that same sample,
  retrieved from the debug render `tmp/sharepic.png`; no map or photo was invented.

Launch the sample with `SIMCTL_CHILD_RIDELOGGER_DEMO` set to:

- Ride: `ride=2026-10-24_122105_Sample;drawin=4;mapbase=map`
- Replay: `ride=2026-10-24_122105_Sample;replay=1;seek=5:20`
- Corner: `ride=2026-10-24_122105_Sample;corner=11`
- Coaching: `coaching=1` (needs analyzed rides in the Simulator)
- Story: `ride=2026-10-24_122105_Sample;sharepic=story`

The screenshots are JPEGs at 603 × 1311; the Story is 675 × 1200. They are real
development-build captures, not a claim that the external beta has been released.

## Preview and checks

From this directory:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/`, `/beta/`, `/privacy/`, `/safety/`, `/data/` and `/guide/`.

October 29 (the Guide): checked in the Claude app's browser (Chromium) at 375 and 1280
px, light and dark: town and ZIP suggestions by keyboard, the sort chips, picking a road
on the map, a road's page with How it rates and both loops drawn, Show all on phones,
Apple's map with a localhost token, and the fallback when Apple refuses the token. Not
yet checked: Safari, Firefox and Edge, a real phone and touch, Use my location, and the
palomares.app token on the live site.

The October 26 check covered all local links, anchors and image files; no empty
`href="#"` links or scripts remain. All three pages were checked at 390 and 1280
pixels wide without page overflow; light/dark views and the invitation link were
also checked in the browser. Publisher and retention fields have now been filled;
no highlighted policy placeholders remain. Public hosting, HTTPS and the actual
TestFlight invitation flow remain to be verified after deployment.

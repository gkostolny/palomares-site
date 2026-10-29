# palomares-site

Pages for palomares.app, served by GitHub Pages. Plain HTML and one
stylesheet; no build step, external fonts, scripts, analytics or embedded forms.

- `index.html`: the night-road holding page and a link to beta information.
- `beta/`: the first invited TestFlight pilot, recording guidance, optional ride
  submissions, and email/TestFlight feedback. No public join link is available yet.
- `privacy/`: the current app's location/sensor use, storage and deletion, sharing,
  review exports, TestFlight, Zoho email, and planned GitHub Pages hosting.
- `data/`: the open-data page and the two ODbL files the app ships: `index-usa.json`
  (a copy of RideLogger's `RideLogger/Roads/index-usa.json`, the lower 48 since 2026-10-28) and `track-outlines.json`
  (only the OpenStreetMap-derived fields of RideLogger's `TrackCards.json`). Refresh both whenever
  an app release changes them.
- `style.css`: neutral surfaces, teal controls, system fonts and the night road,
  following RideLogger's brand guide. Supports light/dark appearance and phone/
  desktop layouts. Skip links and visible keyboard focus are included.
- `.nojekyll`: serve the static files directly when Pages is enabled.

## Status — October 26, 2026

Draft banners and `noindex` removed; the privacy policy is effective October 26, 2026
(change the date in `privacy/index.html` if it publishes later). The Send for review
section now lists the ride title, ride notes and motorcycle name, which review copies
keep. Gabe asked for both on October 26; a read-through of all three pages' copy is
still open. This repository is public, so
a push shows the pages on GitHub even before Pages is on.

The policy names **K. Gabriel Coelho-Kostolny** as publisher. Beta emails, submitted
rides, attachments and extracted copies are kept through the beta. The copies we
control are deleted within 90 days after it ends. Earlier deletion requests can
be sent to beta@palomares.app. Include that cleanup in the beta closeout process.

Still to do:

1. Read through the three pages' copy and screenshots. The app's branding/copy
   approval record is in RideLogger's `docs/design/palomares-branding/CONTEXT.md`.
2. Enable GitHub Pages, verify palomares.app, configure web DNS while preserving
   Zoho's email records, and check HTTPS (RideLogger's `docs/TESTFLIGHT-PLAN.md`, section 3).
3. Add the actual TestFlight join link only when the public beta is available.

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
- `screen-ride.jpg`, `screen-replay.jpg`, `screen-corner.jpg`: captured October 26
  from the app's current installed debug build (`665282b-dirty`) in a separate
  iPhone 17 Pro / iOS 27 Simulator, dark appearance and a 9:41 status bar. They show
  the bundled Palomares Road sample `2026-10-24_122105_Sample`, replacing the old
  Redwood sample. Captures keep the complete screen and Apple Maps attribution.
  `screen-ride.jpg` was recaptured later on October 26 (debug build `d1c3f78-dirty`,
  map base forced with `mapbase=map`) to show the current tabs: Ride, My rides,
  Coaching, Guide.
- `share-story.jpg`: the app-generated Story picture from that same sample,
  retrieved from the debug render `tmp/sharepic.png`; no map or photo was invented.

Launch the sample with `SIMCTL_CHILD_RIDELOGGER_DEMO` set to:

- Ride: `ride=2026-10-24_122105_Sample;drawin=4;mapbase=map`
- Replay: `ride=2026-10-24_122105_Sample;replay=1;seek=5:20`
- Corner: `ride=2026-10-24_122105_Sample;corner=11`
- Story: `ride=2026-10-24_122105_Sample;sharepic=story`

The screenshots are JPEGs at 603 × 1311; the Story is 675 × 1200. They are real
development-build captures, not a claim that the external beta has been released.

## Preview and checks

From this directory:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/`, `/beta/`, and `/privacy/`.

The October 26 check covered all local links, anchors and image files; no empty
`href="#"` links or scripts remain. All three pages were checked at 390 and 1280
pixels wide without page overflow; light/dark views and the invitation link were
also checked in the browser. Publisher and retention fields have now been filled;
no highlighted policy placeholders remain. Public hosting, HTTPS and the actual
TestFlight invitation flow remain to be verified after deployment.

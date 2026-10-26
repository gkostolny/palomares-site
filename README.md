# palomares-site

Draft pages for palomares.app, intended for GitHub Pages. Plain HTML and one
stylesheet; no build step, external fonts, scripts, analytics or embedded forms.

- `index.html`: the night-road holding page and a link to beta information.
- `beta/`: the first invited TestFlight pilot, recording guidance, optional ride
  submissions, and email/TestFlight feedback. No public join link is available yet.
- `privacy/`: the current app's location/sensor use, storage and deletion, sharing,
  review exports, TestFlight, Zoho email, and planned GitHub Pages hosting.
- `style.css`: neutral surfaces, teal controls, system fonts and the night road,
  following RideLogger's brand guide. Supports light/dark appearance and phone/
  desktop layouts. Skip links and visible keyboard focus are included.
- `.nojekyll`: serve the static files directly when Pages is enabled.

## Review status — October 26, 2026

These pages remain local drafts, with visible draft banners and `noindex`. GitHub
confirms this repository is public, the default branch is `main`, and Pages is off.
The October 26 update is not publication or final approval of page copy.

Before publication:

The policy names **K. Gabriel Coelho-Kostolny** as publisher. Beta emails, submitted
rides, attachments and extracted copies are kept through the beta. The copies we
control are deleted within 90 days after it ends. Earlier deletion requests can
be sent to beta@palomares.app. Include that cleanup in the beta closeout process.

1. Review the remaining page copy and current screenshots. The app's branding/copy
   approval record is in RideLogger's `docs/design/palomares-branding/CONTEXT.md`.
2. Enable GitHub Pages, verify palomares.app, configure web DNS while preserving
   Zoho's email records, and check HTTPS. Remove draft markings after review and
   set the privacy policy's effective date when publishing.
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
- `share-story.jpg`: the app-generated Story picture from that same sample,
  retrieved from the debug render `tmp/sharepic.png`; no map or photo was invented.

Launch the sample with `SIMCTL_CHILD_RIDELOGGER_DEMO` set to:

- Ride: `ride=2026-10-24_122105_Sample;drawin=4`
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

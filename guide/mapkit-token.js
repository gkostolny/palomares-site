// Apple MapKit JS token for palomares.app (Gabe's developer account, team ZZU5538TP5; created 2026-10-29 in
// Certificates, Identifiers & Profiles ▸ Services ▸ Maps ▸ Tokens: type MapKit JS, restricted to the palomares.app
// domain, no expiry). Apple only honors it on that origin, so elsewhere (localhost) the Guide draws the roads on their own.
window.PALOMARES_MAPKIT_TOKEN = "eyJraWQiOiJENlJKNFU2NTVGIiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJaWlU1NTM4VFA1IiwiaWF0IjoxNzkzMzI5NDc3LCJvcmlnaW4iOiJwYWxvbWFyZXMuYXBwIiwic2NvcGUiOiJtYXBraXRfanMifQ.pKn9MK8FJA8zT7SAcZqWnJw4nflvFw4z9VThCX5S4onQGYPe8qxvDB-cOOZUudaUV3JAW4fZo4GsdP5vEAqRKg";
// Local checks: a short-lived unrestricted token kept in this browser only (never committed), set with
// localStorage.setItem('palomares.mapkitDevToken', '<token>') on http://localhost.
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  try { window.PALOMARES_MAPKIT_TOKEN = localStorage.getItem('palomares.mapkitDevToken') || window.PALOMARES_MAPKIT_TOKEN; } catch { /* no storage */ }
}

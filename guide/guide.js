/* The Guide on palomares.app: roads near a town, ZIP or the rider's location, from the road library's tiles in
   data/ (built by RideLogger's tools/web_guide.py, which also writes every road's words). Searching happens here in
   the browser: the only requests are for this site's files and, when a token is set, Apple's map. */
(() => {
  'use strict';

  const RADIUS = 20, WIDER = 50, FIRST_ROWS = 8;
  // browsing Apple's map: roads show once the view is at most this many degrees of latitude tall (about 70 miles),
  // and at most this many of the best rated are drawn and listed
  const BROWSE_SPAN = 1.0, BROWSE_MAX = 250;
  // past this many degrees tall the map shows the best roads in the country (data/overview/top.json)
  const OVERVIEW_SPAN = 6;
  const STATES = { AL: 'Alabama', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
    DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana',
    IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts',
    MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
    NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
    OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
    SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
    WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
    // Canada's provinces (2026-10-30): no code is shared with a state
    AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick', NL: 'Newfoundland and Labrador',
    NS: 'Nova Scotia', ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec', SK: 'Saskatchewan' };

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window: fine */ } },
  };

  // MARK: Geometry

  /** Google encoded polyline → [[lat, lon], …] */
  function decode(str) {
    const out = [];
    let i = 0, lat = 0, lon = 0;
    while (i < str.length) {
      for (let k = 0; k < 2; k++) {
        let shift = 0, result = 0, b;
        do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        const v = result & 1 ? ~(result >> 1) : result >> 1;
        if (k === 0) lat += v; else lon += v;
      }
      out.push([lat / 1e5, lon / 1e5]);
    }
    return out;
  }
  const pts = r => r.pts || (r.pts = decode(r.line));

  const MI_PER_DEG = 69.05;
  /** Straight-line miles from p to the nearest point of a line (flat over a few dozen miles). */
  function milesTo(p, line) {
    const k = Math.cos(p[0] * Math.PI / 180);
    const xy = q => [(q[1] - p[1]) * k * MI_PER_DEG, (q[0] - p[0]) * MI_PER_DEG];
    let best = Infinity, a = xy(line[0]);
    if (line.length === 1) return Math.hypot(a[0], a[1]);
    for (let i = 1; i < line.length; i++) {
      const b = xy(line[i]), dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / L)) : 0;
      best = Math.min(best, Math.hypot(a[0] + t * dx, a[1] + t * dy));
      a = b;
    }
    return best;
  }
  function meters(a, b) {
    const k = Math.cos((a[0] + b[0]) / 2 * Math.PI / 180);
    return Math.hypot((b[1] - a[1]) * k, b[0] - a[0]) * 111195;
  }
  /** RideKit RoadFinder.cut: a line between two fractions of its length. */
  function cut(l, lo, hi) {
    if (l.length < 2 || (lo <= 0 && hi >= 1)) return l;
    const along = [0];
    for (let i = 1; i < l.length; i++) along.push(along[i - 1] + meters(l[i - 1], l[i]));
    const total = along[along.length - 1], a = Math.max(0, Math.min(lo, hi)) * total, b = Math.min(1, Math.max(lo, hi)) * total;
    const at = d => {
      let j = along.findIndex(x => x >= d); if (j < 0) j = l.length - 1;
      const k = Math.min(l.length - 2, Math.max(0, j - 1));
      const u = along[k + 1] > along[k] ? (d - along[k]) / (along[k + 1] - along[k]) : 0;
      return [l[k][0] + (l[k + 1][0] - l[k][0]) * u, l[k][1] + (l[k + 1][1] - l[k][1]) * u];
    };
    return [at(a), ...l.filter((_, i) => along[i] > a && along[i] < b), at(b)];
  }
  /** RideKit RoadDirection.stops: points evenly along a line. */
  function stopsAlong(l, count) {
    const cum = [0];
    for (let i = 1; i < l.length; i++) cum.push(cum[i - 1] + meters(l[i - 1], l[i]));
    const total = cum[cum.length - 1];
    return Array.from({ length: count }, (_, k) => {
      const i = cum.findIndex(x => x >= total * (k + 1) / (count + 1));
      return l[i < 0 ? l.length - 1 : i];
    });
  }
  /** A road's shape for a 56-point thumbnail. */
  function shapePath(line, size = 56, pad = 6) {
    const k = Math.cos(line[0][0] * Math.PI / 180);
    const xs = line.map(p => p[1] * k), ys = line.map(p => -p[0]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const s = (size - 2 * pad) / Math.max(x1 - x0, y1 - y0, 1e-9);
    const ox = (size - (x1 - x0) * s) / 2, oy = (size - (y1 - y0) * s) / 2;
    return line.map((_, i) => `${i ? 'L' : 'M'}${(ox + (xs[i] - x0) * s).toFixed(1)} ${(oy + (ys[i] - y0) * s).toFixed(1)}`).join(' ');
  }

  // MARK: Data

  let meta = null;
  const tileCache = new Map(), roads = new Map(), joinCache = new Map();
  const getJSON = (url, init) => fetch(url, init).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
  function loadMeta() {
    return meta ? Promise.resolve(meta) : getJSON('data/meta.json', { cache: 'no-cache' }).then(m => { meta = m; meta.tileSet = new Set(m.tiles); return m; });
  }
  function loadTile(name) {
    if (!meta.tileSet.has(name)) return Promise.resolve([]);
    if (!tileCache.has(name)) {
      tileCache.set(name, getJSON(`data/tiles/${name}.json`).then(d => d.roads.map(r => {
        if (!roads.has(r.ref)) roads.set(r.ref, r);
        return roads.get(r.ref);
      })).catch(e => { tileCache.delete(name); throw e; }));
    }
    return tileCache.get(name);
  }
  const homeTile = ref => ref.split('_').slice(0, 2).join('_');
  /** The overview's roads (a line cut to ~10 points; the whole road loads with its page). */
  const overviewCache = new Map();
  function loadOverview(name) {
    if (!overviewCache.has(name)) {
      overviewCache.set(name, getJSON(`data/overview/${name}.json`).then(rows => rows.map(([ref, name, score, miles, cpm, corners, loopCount, loopRank, line, bestLoop]) =>
        ({ ref, name, score, miles, cpm, corners, loopCount, loopRank, line, bestLoop, overview: true })))
        .catch(e => { overviewCache.delete(name); throw e; }));
    }
    return overviewCache.get(name);
  }
  async function road(ref) {
    await loadMeta();
    await loadTile(homeTile(ref));
    return roads.get(ref) || null;
  }
  function tilesAround(p, miles) {
    const dLat = miles / MI_PER_DEG, dLon = dLat / Math.max(0.1, Math.cos(p[0] * Math.PI / 180)), out = [];
    for (let a = Math.floor(p[0] - dLat); a <= Math.floor(p[0] + dLat); a++)
      for (let b = Math.floor(p[1] - dLon); b <= Math.floor(p[1] + dLon); b++) out.push(`${a}_${b}`);
    return out;
  }
  /** The roads within 20 miles (50 when fewer than three are that close): through roads only, as the app's default
      (no dead ends, no sweepers: those are the app's own filters). */
  async function nearby(p) {
    await loadMeta();
    for (const radius of [RADIUS, WIDER]) {
      const lists = await Promise.all(tilesAround(p, radius).map(loadTile));
      const seen = new Set(), out = [];
      for (const r of lists.flat()) {
        if (seen.has(r.ref) || r.sweeper || r.deadEnd) continue;
        seen.add(r.ref);
        const m = milesTo(p, pts(r));
        if (m <= radius) out.push({ road: r, miles: m });
      }
      if (out.length >= 3 || radius === WIDER) return { radius, list: out };
    }
  }
  const SORTS = {
    rating: n => n.road.score,
    nearest: n => -n.miles,
    curves: n => n.road.cpm,
    loops: n => (n.road.loops ? Math.max(0, ...n.road.loops.map(lp => lp.rank)) : n.road.loopRank),
  };
  /** RideKit RoadFinder.sorted: ties to the higher rating, then the nearer, then the name. */
  function sorted(list, sort) {
    const key = SORTS[sort] || SORTS.rating;
    return [...list].sort((a, b) => key(b) - key(a) || b.road.score - a.road.score || a.miles - b.miles || a.road.name.localeCompare(b.road.name));
  }
  /** RideKit RoadWords.parts: which piece of a road each one is when a list holds more than one with its name. */
  function partNames(list) {
    const out = new Map(), groups = new Map();
    for (const n of list) groups.set(n.road.name, [...(groups.get(n.road.name) || []), n.road]);
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const mids = group.map(r => { const l = pts(r), a = l[0], b = l[l.length - 1]; return { ref: r.ref, lat: (a[0] + b[0]) / 2, lon: (a[1] + b[1]) / 2 }; });
      const k = Math.cos(mids[0].lat * Math.PI / 180), lats = mids.map(m => m.lat), lons = mids.map(m => m.lon);
      const ns = Math.max(...lats) - Math.min(...lats) >= (Math.max(...lons) - Math.min(...lons)) * k;
      const ordered = mids.sort((a, b) => ns ? a.lat - b.lat : a.lon - b.lon);
      const ends = ns ? ['south', 'north'] : ['west', 'east'];
      ordered.forEach((m, i) => out.set(m.ref, ordered.length > 3 ? `${i + 1} of ${ordered.length}`
        : i === 0 ? ends[0] : i === ordered.length - 1 ? ends[1] : 'middle'));
    }
    return out;
  }
  const nameOf = (r, parts) => parts && parts.has(r.ref) ? `${r.name} · ${parts.get(r.ref)}` : r.name;

  // Places: towns by first letter, ZIPs by first digit (Census Gazetteer); Canada's towns among them (Geographical Names
  // Database) and its postcode areas, the first three characters ("V0N"), by first letter (Statistics Canada)
  const placeCache = new Map();
  function loadPlaces(file) {
    if (!placeCache.has(file)) placeCache.set(file, getJSON(file).catch(e => { placeCache.delete(file); throw e; }));
    return placeCache.get(file);
  }
  async function suggest(text) {
    const q = fold(text);
    if (!q) return [];
    if (/^[a-z]\d[a-z]?$/.test(q.replace(/\s+/g, '')) || /^[a-z]\d[a-z]\s*\d/.test(q)) {
      const fsas = await loadPlaces(`data/postcodes/${q[0]}.json`), k = q.replace(/\s+/g, '').slice(0, 3).toUpperCase();
      return Object.keys(fsas).filter(z => z.startsWith(k)).slice(0, 8)
        .map(z => ({ label: z, detail: 'postcode', at: fsas[z] }));
    }
    if (/^\d{3,5}$/.test(q)) {
      const zips = await loadPlaces(`data/zips/${q[0]}.json`);
      return Object.keys(zips).filter(z => z.startsWith(q)).slice(0, 8)
        .map(z => ({ label: z, detail: 'ZIP', at: zips[z] }));
    }
    const first = q[0];
    if (!/[a-z0-9]/.test(first)) return [];
    const [towns, roadsFound] = await Promise.all([
      /[a-z]/.test(first) ? suggestTowns(q, await loadPlaces(`data/places/${first}.json`)) : [],
      q.length >= 3 ? suggestRoads(q) : [],
    ]);
    // towns first, as most searches are for a place; then roads by name, best rated first
    return [...towns.slice(0, roadsFound.length ? 4 : 8), ...roadsFound].slice(0, 8);
  }
  function suggestTowns(q, list) {
    // "sunol, ca", "sunol ca" or just "sunol"
    let name = q, st = '';
    const comma = q.split(',');
    if (comma.length > 1) { name = comma[0].trim(); st = comma.slice(1).join(',').trim(); }
    const match = (nm, s) => list.filter(p => fold(p[0]).startsWith(nm) && (!s || p[1].toLowerCase().startsWith(s)));
    let found = match(name, st);
    if (!found.length && !st) {
      const m = q.match(/^(.*\S)\s+([a-z]{2})$/);
      if (m) { name = m[1]; found = match(name, m[2]); }
    }
    const exact = found.filter(p => fold(p[0]) === name), rest = found.filter(p => fold(p[0]) !== name);
    return [...exact, ...rest].slice(0, 8).map(p => ({ label: `${p[0]}, ${p[1]}`, at: [p[2], p[3]] }));
  }
  /** Roads by name (data/roads.json): every word typed starts a word of the road's name, the riders' or the map's
      ("dragon" finds Tail of the Dragon, "calderwood" too). Ones whose name starts with it first, then by rating. */
  async function suggestRoads(q) {
    const data = await loadPlaces('data/roads.json');
    if (!data.folded) data.folded = data.roads.map(r => (fold(r[0]) + ' ' + fold(r[1])).split(/[^a-z0-9]+/).filter(Boolean));
    const words = q.split(/[^a-z0-9]+/).filter(Boolean);
    if (!words.length) return [];
    const starts = [], others = [];
    for (let i = 0; i < data.roads.length && starts.length < 5; i++) {
      const w = data.folded[i];
      if (!words.every(x => w.some(y => y.startsWith(x)))) continue;
      (fold(data.roads[i][0]).startsWith(q) || fold(data.roads[i][1]).startsWith(q) ? starts : others).push(i);
    }
    return [...starts, ...others].slice(0, 5).map(i => {
      const [title, , ref, , where] = data.roads[i];
      const town = typeof where === 'number' ? data.towns[where] : null;
      return town
        ? { label: title, detail: `road near ${town[0]}, ${town[1]}`, road: ref, at: [town[2], town[3]], place: `${town[0]}, ${town[1]}` }
        : { label: title, detail: `road in ${STATES[where] || where}`, road: ref, at: null, place: '' };
    });
  }

  // MARK: State in the address: ?at=lat,lon&place=Sunol, CA&sort=rating&road=ref

  function readState(search = location.search) {
    const q = new URLSearchParams(search);
    const at = (q.get('at') || '').split(',').map(Number);
    return {
      at: at.length === 2 && at.every(Number.isFinite) ? at : null,
      place: q.get('place') || '',
      sort: SORTS[q.get('sort')] ? q.get('sort') : 'rating',
      road: q.get('road') || null,
    };
  }
  function href(s) {
    const q = new URLSearchParams();
    if (s.road) q.set('road', s.road);
    if (s.at) q.set('at', s.at.map(v => v.toFixed(s.place === 'your location' ? 3 : 4)).join(','));
    if (s.place) q.set('place', s.place);
    if (s.sort && s.sort !== 'rating') q.set('sort', s.sort);
    const t = q.toString();
    return t ? `?${t}` : './';
  }
  let S = readState();
  function go(next, { replace = false, focus = true } = {}) {
    S = { ...S, ...next };
    history[replace ? 'replaceState' : 'pushState'](null, '', href(S));
    render({ focus });
  }
  window.addEventListener('popstate', () => { S = readState(); render({ focus: true }); });

  // MARK: Views

  const main = $('.guide'), statusEl = $('#g-status'), listEl = $('#g-list'), moreEl = $('#g-more');
  const shortPlace = () => (S.place ? S.place.split(',')[0] : '');
  const setStatus = (text, error = false) => { statusEl.textContent = text; statusEl.classList.toggle('error', error); };
  let current = null;    // { radius, list } for the list view
  let picked = null;     // a road picked on the map
  let loopShown = null;  // { ref, index } on the road view

  function setView(view) {
    main.dataset.view = view;
    $$('.v-list').forEach(el => { el.hidden = view !== 'list'; });
    $$('.v-road').forEach(el => { el.hidden = view !== 'road'; });
    if (view === 'list') $('#g-results').hidden = !current;
  }

  async function render({ focus = false } = {}) {
    picked = null; showPick(null);
    if (S.road) return renderRoad(focus);
    setView('list');
    document.title = 'Guide · Palomares';
    $$('.g-chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sort === S.sort)));
    if (S.place && $('#g-q') !== document.activeElement) $('#g-q').value = S.place === 'your location' ? '' : S.place;
    // on Apple's map the list is the roads in view: back from a road or a new sort, the map stays where it was
    if (browsing() && listRegion && !fitNext) {
      appleMap.map.region = listRegion;
      return refreshInView({ force: true });
    }
    fitNext = false;
    if (!S.at) {
      current = null; setView('list');
      setStatus(browsing() ? 'Curvy paved roads across the lower 48 and southern Canada for now. Search for a town, ZIP, postcode or road, use your location, or zoom the map in on an area. The search runs in your browser; nothing is sent to us.'
        : 'Curvy paved roads across the lower 48 and southern Canada for now. Search for a town, ZIP, postcode or road, or use your location. The search runs in your browser; nothing is sent to us.');
      mapView.draw({ roads: [], fit: 'us' });
      return;
    }
    setStatus('Finding roads…');
    let found;
    try { found = await nearby(S.at); } catch { setStatus('The road library didn’t load. Check your connection and try again.', true); return; }
    current = found;
    setView('list');
    const n = found.list.length;
    const where = S.place === 'your location' ? 'of you' : S.place ? `of ${shortPlace()}` : '';
    if (!n) setStatus(`No curvy paved roads in the library within ${WIDER} miles${where ? ' ' + where : ''}. The library covers the lower 48 and southern Canada for now.`);
    else setStatus(`${n} ${n === 1 ? 'road' : 'roads'} within ${found.radius} miles${where ? ' ' + where : ''}`);
    drawList(focus);
  }

  function ringSmall(score) {
    const r = 17, c = 2 * Math.PI * r;
    return `<svg class="g-ring-sm" width="42" height="42" viewBox="0 0 42 42" aria-hidden="true"><circle class="track" cx="21" cy="21" r="${r}"/>
      <circle class="value" cx="21" cy="21" r="${r}" stroke-dasharray="${(c * score / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 21 21)"/>
      <text x="21" y="26" text-anchor="middle">${score}</text></svg><span class="visually-hidden">Rating ${score} of 100</span>`;
  }
  /** A road's shape as a little night road: a white line with the glow of the splash's road, on the night sky. */
  function tile(line) {
    const d = shapePath(line);
    return `<svg class="g-shape" viewBox="0 0 56 56" aria-hidden="true"><path class="glow" d="${d}"/><path class="road" d="${d}"/></svg>`;
  }
  /** Apple's map is up (it can be moved; the roads drawn on their own can't). */
  const browsing = () => mapView.impl === appleMap && appleMap.map;
  let listRegion = null, fitNext = false, shownKey = '', everShown = false;
  /** The list and the map's roads become the curvy roads in view (through roads, as the app's default). */
  async function refreshInView({ force = false } = {}) {
    // before MapKit is ready its region is 0°, 0° (and our fits are dropped): wait for the first real view
    if (S.road || !browsing() || !appleMap.ready) return;
    const mk = window.mapkit, reg = appleMap.map.region;
    listRegion = new mk.CoordinateRegion(new mk.Coordinate(reg.center.latitude, reg.center.longitude),
      new mk.CoordinateSpan(reg.span.latitudeDelta, reg.span.longitudeDelta));
    const c = [reg.center.latitude, reg.center.longitude], h = reg.span.latitudeDelta / 2, w = reg.span.longitudeDelta / 2;
    // zoomed out past the tiles: the best roads from the overview (5° blocks for a state, the best 1,500 for the country)
    const far = reg.span.latitudeDelta > BROWSE_SPAN, country = reg.span.latitudeDelta > OVERVIEW_SPAN;
    let lists;
    try {
      await loadMeta();
      const names = [];
      const step = far ? meta.overviewBlock : 1;
      for (let a = Math.floor((c[0] - h) / step) * step; a <= c[0] + h; a += step)
        for (let b = Math.floor((c[1] - w) / step) * step; b <= c[1] + w; b += step) names.push(`${a}_${b}`);
      const have = far ? new Set(meta.overview) : meta.tileSet;
      if (!names.some(t => have.has(t))) {
        current = null; shownKey = ''; setView('list'); listEl.innerHTML = ''; moreEl.hidden = true;
        setStatus('The road library covers the lower 48 and southern Canada for now. Move the map there to see roads.');
        return mapView.draw({ roads: [], center: S.at, label: shortPlace(), fit: 'none' });
      }
      lists = far ? await Promise.all((country ? ['top'] : names.filter(t => have.has(t))).map(loadOverview))
        : await Promise.all(names.map(loadTile));
    } catch { return setStatus('The road library didn’t load. Check your connection and try again.', true); }
    if (S.road) return;
    const seen = new Set(), found = [];
    for (const r of lists.flat()) {
      if (seen.has(r.ref) || r.sweeper || r.deadEnd) continue;
      seen.add(r.ref);
      if (!r.box) { const l = pts(r); r.box = [Math.min(...l.map(p => p[0])), Math.min(...l.map(p => p[1])), Math.max(...l.map(p => p[0])), Math.max(...l.map(p => p[1]))]; }
      if (r.box[2] < c[0] - h || r.box[0] > c[0] + h || r.box[3] < c[1] - w || r.box[1] > c[1] + w) continue;
      found.push(r);
    }
    found.sort((a, b) => b.score - a.score);
    const kept = found.slice(0, BROWSE_MAX);
    const key = kept.map(r => r.ref).join() + '|' + S.sort + '|' + (S.at || '');
    if (!force && key === shownKey) return;
    shownKey = key;
    picked = null; showPick(null);
    current = { list: kept.map(r => ({ road: r, miles: milesTo(S.at || c, pts(r)) })), inView: true };
    setView('list');
    const n = found.length;
    if (!everShown && !S.at && country) return drawList(false, 'none');   // the opening line stays on the first look
    everShown = true;
    setStatus(!n ? 'No curvy paved roads in the library here. It covers the lower 48 and southern Canada for now.'
      : country ? `The ${kept.length} best rated roads in view. Zoom in for more.`
      : n > kept.length ? `The ${kept.length} best rated of ${n.toLocaleString()} roads in view. Zoom in for the rest.`
      : `${n} ${n === 1 ? 'road' : 'roads'} in view`);
    drawList(false, 'none');
  }

  function drawList(focus, fit = 'roads') {
    // Best for a loop lists only roads with a loop, each with its best one (Gabe, 2026-10-29)
    const forLoops = S.sort === 'loops';
    const list = sorted(forLoops ? current.list.filter(n => n.road.bestLoop) : current.list, S.sort), parts = partNames(list);
    if (forLoops) setStatus(list.length ? `${list.length} ${list.length === 1 ? 'road' : 'roads'} in view with a loop` : 'No loops through the roads here. Move the map or zoom out.');
    const narrow = !matchMedia('(min-width: 900px)').matches;
    listEl.innerHTML = list.map((n, i) => {
      const r = n.road;
      return `<li${narrow && i >= FIRST_ROWS ? ' hidden' : ''}><a class="g-row" data-ref="${esc(r.ref)}" href="${esc(href({ ...S, road: r.ref }))}">
        ${tile(pts(r))}
        <span class="g-row-text"><span class="g-row-name">${esc(nameOf(r, parts))}</span>
          ${forLoops ? `<span class="g-row-sub">${esc(r.bestLoop)}</span>` : ''}
          <span class="g-row-sub">${r.miles.toFixed(1)} mi · ${r.cpm.toFixed(1)} curves a mile</span>
          ${S.at && n.miles < 100 ? `<span class="g-row-sub">${n.miles.toFixed(1)} mi away in a straight line</span>` : ''}</span>
        ${ringSmall(r.score)}</a></li>`;
    }).join('');
    moreEl.hidden = !(narrow && list.length > FIRST_ROWS);
    moreEl.textContent = `Show all ${list.length}`;
    mapView.draw({ roads: list.map(n => ({ road: n.road })), center: S.at, label: shortPlace(), fit });
    if (focus) $('h1', $('.g-head')).focus({ preventScroll: true });
  }

  function ringBig(score) {
    const c = 2 * Math.PI * 27;
    return `<title>Rating ${score} of 100</title><circle class="track" cx="32" cy="32" r="27" fill="none" stroke-width="7"/>
      <circle class="value" cx="32" cy="32" r="27" fill="none" stroke-width="7" stroke-linecap="round"
        stroke-dasharray="${(c * score / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 32 32)"/>
      <text x="32" y="39" text-anchor="middle" aria-hidden="true">${score}</text>`;
  }
  function mapsLinks(r) {
    const l = pts(r), way = [l[0], ...stopsAlong(l, 2)], end = l[l.length - 1];
    const ll = p => `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
    const apple = 'https://maps.apple.com/directions?' + [...way.map(p => 'waypoint=' + ll(p)), 'destination=' + ll(end), 'mode=driving'].join('&');
    const google = 'https://www.google.com/maps/dir/?' + new URLSearchParams({ api: '1', destination: ll(end), waypoints: way.map(ll).join('|'), travelmode: 'driving' });
    return { apple, google };
  }

  /** An email to beta@ about a road, with its name and link filled in (the rider writes the rest). */
  function reportLink(r) {
    const link = `${location.origin}/guide/?road=${encodeURIComponent(r.ref)}`;
    return `mailto:beta@palomares.app?subject=${encodeURIComponent(`Guide: ${r.name}`)}&body=${encodeURIComponent(`\n\n${r.name}, ${STATES[r.state] || r.state || ''}\n${link}`)}`;
  }

  async function renderRoad(focus) {
    setView('road');
    // a road opens at its top: the panel (or the page, on phones) had kept the list's scroll
    $('.g-body').scrollTop = 0;
    if (!wide()) window.scrollTo(0, 0);
    loopShown = null;
    let r;
    try { r = await road(S.road); } catch { r = undefined; }
    const body = $('#g-road');
    if (!r) {
      $('#g-road-name').textContent = 'Road not found';
      $('#g-road-map').hidden = true;
      $('#g-road-sub').textContent = r === undefined ? 'The road library didn’t load. Check your connection and try again.'
        : 'The road library has changed since this link was made. Search for a town or ZIP to find it again.';
      $('#g-road-ring').innerHTML = '';
      body.innerHTML = '';
      $('#g-back').textContent = '‹ Roads near you';
      $('#g-back').href = href({ ...S, road: null });
      mapView.draw({ roads: [], fit: 'us' });
      return;
    }
    document.title = `${r.name} · Guide · Palomares`;
    const l = pts(r);
    $('#g-back').textContent = S.at ? `‹ Roads near ${S.place === 'your location' ? 'you' : shortPlace() || 'here'}`
      : listRegion ? '‹ Roads on the map' : '‹ Roads nearby';
    $('#g-back').href = href({ ...S, road: null, at: S.at || (listRegion ? null : l[Math.floor(l.length / 2)]), place: S.at ? S.place : '' });
    $('#g-road-name').textContent = r.name;
    // a riders' name leads, the map's under it (written by the build, as the app's RoadWords.mapNameLine)
    $('#g-road-map').hidden = !r.mapLine;
    $('#g-road-map').textContent = r.mapLine || '';
    const sub = [STATES[r.state] || r.state, `${r.miles.toFixed(1)} mi`];
    if (S.at) {
      const m = milesTo(S.at, l).toFixed(1);
      sub.push(S.place === 'your location' ? `${m} mi from you in a straight line` : `${m} mi from ${shortPlace() || 'here'} in a straight line`);
    }
    $('#g-road-sub').textContent = sub.filter(Boolean).join(' · ');
    $('#g-road-sub').insertAdjacentHTML('beforeend', '<span class="mapped">Mapped from open data. We haven’t ridden it.</span>');  // Gabe approved 2026-10-29: the road is mapped, not ridden (the app card's Mapped chip)
    const ring = $('#g-road-ring');
    ring.setAttribute('aria-label', `Rating ${r.score} of 100`);
    ring.innerHTML = ringBig(r.score);
    const links = mapsLinks(r);
    body.innerHTML = `
      <dl class="g-card g-stats" aria-label="The numbers">${r.stats.map(([v, k]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <section class="g-card g-words" aria-labelledby="g-h-road"><h2 id="g-h-road">The road</h2>${r.words.map(t => `<p>${esc(t)}</p>`).join('')}</section>
      <details class="g-card g-rates"><summary>How it rates</summary><div class="inner">
        ${r.rating.map(([k, v, w]) => `<div class="g-bar" role="img" aria-label="${esc(meta.parts[k])}: ${Math.round(v * 100)} percent, ${Math.round(w * 100)} percent of the rating">
          <span aria-hidden="true">${esc(meta.parts[k])}</span><span class="track" aria-hidden="true"><span style="width:${(v * 100).toFixed(1)}%"></span></span>
          <span class="w" aria-hidden="true">${Math.round(w * 100)}%</span></div>`).join('')}
        <p class="note">${esc(r.ratingNote)}</p></div></details>
      ${r.loops.length ? `<section class="g-card g-loops" aria-labelledby="g-h-loops"><h2 id="g-h-loops">Loops from here</h2>
        ${r.loops.map((lp, i) => `<button class="g-loop" type="button" data-loop="${i}" aria-pressed="false">
          <span class="t">${esc(lp.title)}</span><span class="d">${esc(lp.line)}</span></button>`).join('')}</section>` : ''}
      <section class="g-card" aria-labelledby="g-h-dirs"><h2 id="g-h-dirs">Directions with</h2>
        <p class="small-note before">Roads change. Road notes and maps can be out of date. A road can still turn to gravel where the maps are wrong. Check for closures, gravel and conditions yourself.</p>
        <div class="g-dirs"><a class="g-button neutral" href="${esc(links.apple)}" target="_blank" rel="noopener">Apple Maps</a>
          <a class="g-button neutral" href="${esc(links.google)}" target="_blank" rel="noopener">Google Maps</a></div></section>
      <section class="g-card g-ride" aria-labelledby="g-h-ride"><h2 id="g-h-ride">Ride it with Palomares</h2>
        <p>Record the ride on your iPhone. Afterward, replay every corner of ${esc(r.name)} and see your lean along it.</p>
        <a class="g-button" href="../beta/">About the beta</a></section>
      <p class="g-credit">Something wrong with this road? <a href="${esc(reportLink(r))}">Tell us</a>.</p>
      <p class="g-credit">Road data © OpenStreetMap contributors, via Overture Maps. Elevation: ${r.country === 'CA' ? 'Natural Resources Canada' : 'USGS'}. <a href="../data/">Open data</a></p>`;
    mapView.draw({ roads: [{ road: r, selected: true }], center: S.at, label: shortPlace(), fit: 'roads', fitCenter: false });
    if (focus) $('#g-road-name').focus({ preventScroll: false });
  }

  async function toggleLoop(button) {
    const r = roads.get(S.road), i = Number(button.dataset.loop);
    const on = !(loopShown && loopShown.index === i);
    $$('.g-loop').forEach(b => b.setAttribute('aria-pressed', 'false'));
    if (!on) { loopShown = null; mapView.draw({ roads: [{ road: r, selected: true }], center: S.at, label: shortPlace(), fit: 'roads', fitCenter: false }); return; }
    loopShown = { ref: r.ref, index: i };
    button.setAttribute('aria-pressed', 'true');
    const lp = r.loops[i];
    try {
      await Promise.all(lp.stops.map(s => loadTile(homeTile(s[0]))));
      const jt = homeTile(r.ref);
      if (!joinCache.has(jt)) joinCache.set(jt, getJSON(`data/joins/${jt}.json`).catch(() => ({})));
      const joins = ((await joinCache.get(jt))[r.ref] || [])[i] || [];
      if (!loopShown || loopShown.index !== i) return;
      const parts = lp.stops.map(([ref, fwd, lo, hi]) => { const p = cut(pts(roads.get(ref)), lo, hi); return fwd ? p : [...p].reverse(); });
      const joinLines = parts.map((p, k) => {
        const next = parts[(k + 1) % parts.length], route = joins.length === parts.length ? decode(joins[k]) : [];
        return [p[p.length - 1], ...route, next[0]];
      });
      mapView.draw({ roads: [], loop: { parts, joins: joinLines }, center: S.at, label: shortPlace(), fit: 'loop', fitCenter: false });
    } catch { button.setAttribute('aria-pressed', 'false'); loopShown = null; }
  }

  // The road picked on the map: a card over it with the way to its page
  function showPick(r) {
    const wrap = $('#g-pickwrap');
    $$('.g-row.is-picked').forEach(a => a.classList.remove('is-picked'));
    if (!r) { wrap.hidden = true; wrap.innerHTML = ''; return; }
    const n = r.loops ? r.loops.length : r.loopCount;
    // the whole card opens the road (Gabe: not just its name); only × closes it
    wrap.innerHTML = `<div class="g-pick"><a class="g-pick-open" href="${esc(href({ ...S, road: r.ref }))}" data-ref="${esc(r.ref)}">
        ${ringSmall(r.score)}<span class="text"><span class="name">${esc(r.name)} ›</span>
        <span class="sub">${r.miles.toFixed(1)} mi · ${r.corners} curves${n ? ` · ${n} ${n === 1 ? 'loop' : 'loops'}` : ''}</span></span></a>
      <button type="button" aria-label="Close">×</button></div>`;
    wrap.hidden = false;
    const row = $(`.g-row[data-ref="${CSS.escape(r.ref)}"]`);
    if (row) {
      row.classList.add('is-picked');
      if (row.parentElement.hidden) { $$('#g-list li').forEach(li => { li.hidden = false; }); moreEl.hidden = true; }
      row.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }
  function pick(ref) {
    if (S.road || !current) return;
    picked = ref;
    // zoomed out, the road is the overview's (not loaded in full): take it from the list on screen
    const hit = current.list.find(n => n.road.ref === ref);
    showPick(hit ? hit.road : roads.get(ref));
    mapView.draw({ roads: sorted(current.list, S.sort).map(n => ({ road: n.road, selected: n.road.ref === ref })), center: S.at, label: shortPlace(), fit: 'none' });
  }

  // MARK: The map

  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const isDark = () => matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'light'
    || document.documentElement.dataset.theme === 'dark';
  const shade = score => 0.35 + 0.63 * Math.max(0, Math.min(1, (score - 40) / 55));
  const wide = () => matchMedia('(min-width: 900px)').matches;
  const padding = () => (wide() ? { top: 48, right: 56, bottom: 96, left: 452 } : { top: 28, right: 28, bottom: S.road ? 28 : 72, left: 28 });

  /** The roads drawn on their own (no map underneath): when there's no MapKit token or Apple's map can't load. */
  const plainMap = {
    el: null, scene: null, view: null,
    mount(container) {
      this.el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.el.setAttribute('class', 'g-plain');
      this.el.setAttribute('role', 'img');
      container.replaceChildren(this.el);
      this.el.addEventListener('click', e => { const ref = e.target.dataset && e.target.dataset.ref; if (ref) pick(ref); });
      new ResizeObserver(() => this.scene && this.draw(this.scene, true)).observe(container);
    },
    draw(scene, keep = false) {
      this.scene = scene;
      const W = this.el.clientWidth || 1, H = this.el.clientHeight || 1, pad = padding();
      const merc = p => [p[1], Math.log(Math.tan(Math.PI / 4 + p[0] * Math.PI / 360)) * 180 / Math.PI];
      const lines = scene.loop ? [...scene.loop.parts, ...scene.loop.joins] : scene.roads.map(x => pts(x.road));
      const all = lines.flat().concat(scene.center && scene.fitCenter !== false ? [scene.center] : []);
      if (!keep && scene.fit !== 'none' || !this.view) {
        if (!all.length) this.view = null;
        else {
          const m = all.map(merc), xs = m.map(p => p[0]), ys = m.map(p => p[1]);
          const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
          const s = Math.min((W - pad.left - pad.right) / Math.max(x1 - x0, 1e-4), (H - pad.top - pad.bottom) / Math.max(y1 - y0, 1e-4));
          this.view = { s, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
        }
      }
      this.el.setAttribute('viewBox', `0 0 ${W} ${H}`);
      if (!this.view) { this.el.innerHTML = ''; this.el.setAttribute('aria-label', 'Map'); return; }
      const { s, cx, cy } = this.view, ox = pad.left + (W - pad.left - pad.right) / 2, oy = pad.top + (H - pad.top - pad.bottom) / 2;
      const xy = p => { const m = merc(p); return [ox + (m[0] - cx) * s, oy - (m[1] - cy) * s]; };
      const d = l => l.map((p, i) => { const q = xy(p); return `${i ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`; }).join('');
      const accent = css('--link'), casing = isDark() ? '#000000' : '#FFFFFF';
      let out = '';
      if (scene.loop) {
        for (const j of scene.loop.joins) out += `<path d="${d(j)}" fill="none" stroke="${css('--quiet')}" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round"/>`;
        for (const p of scene.loop.parts) out += `<path d="${d(p)}" fill="none" stroke="${casing}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`
          + `<path d="${d(p)}" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
      } else {
        const order = [...scene.roads].sort((a, b) => (a.selected - b.selected) || a.road.score - b.road.score);
        for (const x of order) {
          const path = d(pts(x.road)), on = x.selected, g = shade(x.road.score), dk = isDark();
          const line = (color, w, o, extra = '') => `<path d="${path}" fill="none" stroke="${color}" stroke-width="${w}" stroke-opacity="${o.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
          out += dk
            ? line('#70C3CE', on ? 16 : 11, on ? .7 : .45 * g, ' filter="url(#g-blur)"') + line(on ? '#FFFFFF' : '#CFF4F7', on ? 4.5 : 2.6, on ? 1 : .45 + .55 * g)
            : line('#26A6AD', on ? 18 : 12, on ? .6 : .4 * g, ' filter="url(#g-blur)"') + line('#FFFFFF', on ? 8 : 5.5, .9) + line('#087F88', on ? 4.5 : 3, on ? 1 : .5 + .5 * g);
          if (!S.road) out += `<path class="hit" data-ref="${esc(x.road.ref)}" d="${path}"/>`;
        }
      }
      if (scene.center) {
        const c = xy(scene.center);
        out += `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="7" fill="#FFFFFF"/><circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="4.5" fill="#1C1C1E"/>`;
        if (scene.label) out += `<text x="${(c[0] + 11).toFixed(1)}" y="${(c[1] + 5).toFixed(1)}" fill="${css('--text')}" font-size="13" font-weight="600" paint-order="stroke" stroke="${css('--bg')}" stroke-width="3">${esc(scene.label)}</text>`;
      }
      this.el.innerHTML = '<defs><filter id="g-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.5"/></filter></defs>' + out;
      this.el.setAttribute('aria-label', scene.loop ? 'The loop on a map' : S.road ? 'The road’s shape' : 'Curvy roads shaded by rating');
    },
  };

  /** Apple's map (MapKit JS), with the roads as overlays. */
  const appleMap = {
    map: null, scene: null,
    mount(container) {
      const mk = window.mapkit;
      this.map = new mk.Map(container, {
        showsCompass: mk.FeatureVisibility.Hidden, showsMapTypeControl: true, isRotationEnabled: false,
        showsPointsOfInterest: false, colorScheme: isDark() ? mk.Map.ColorSchemes.Dark : mk.Map.ColorSchemes.Light,
      });
      // Apple's own map/satellite switcher (Gabe, 2026-10-29); the rider's choice is kept in this browser
      const types = Object.values(mk.Map.MapTypes), saved = store.get('guide.mapType');
      if (types.includes(saved)) this.map.mapType = saved;
      this.map.addEventListener('map-type-change', () => {
        store.set('guide.mapType', this.map.mapType);
        if (this.scene) this.draw({ ...this.scene, fit: 'none' });
      });
      this.map.addEventListener('select', e => { if (e.overlay && e.overlay.data && e.overlay.data.ref) pick(e.overlay.data.ref); });
      // the list follows the map: pan or zoom anywhere and the roads in view are listed (after a search's fit too)
      let settle = null;
      this.map.addEventListener('region-change-end', () => { clearTimeout(settle); settle = setTimeout(() => refreshInView(), 200); });
      // a fit asked for before MapKit finishes authorizing is dropped: fit again once it's ready
      // and keep the map out of sight until then: before it, MapKit shows 0°, 0° (off West Africa)
      container.classList.add('g-waiting');
      mk.addEventListener('configuration-change', e => {
        if (e.status !== 'Initialized') return;
        this.ready = true;
        if (this.scene) this.draw(this.scene);
        setTimeout(() => refreshInView(), 400);   // a region set from code may not report its change
        setTimeout(() => container.classList.remove('g-waiting'), 50);
      });
      setTimeout(() => container.classList.remove('g-waiting'), 4000);   // never hidden for long
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        this.map.colorScheme = isDark() ? mk.Map.ColorSchemes.Dark : mk.Map.ColorSchemes.Light;
        if (this.scene) this.draw({ ...this.scene, fit: 'none' });
      });
    },
    draw(scene) {
      const mk = window.mapkit, map = this.map;
      this.scene = scene;
      map.removeOverlays(map.overlays);
      map.removeAnnotations(map.annotations);
      const coords = l => l.map(p => new mk.Coordinate(p[0], p[1]));
      // imagery takes the night look whatever the appearance, as in the app (teal lines vanish on dark trees)
      const imagery = map.mapType === mk.Map.MapTypes.Satellite || map.mapType === mk.Map.MapTypes.Hybrid;
      const dark = isDark() || imagery, accent = dark ? '#70C3CE' : '#087F88';
      const style = (o) => new mk.Style({ lineCap: 'round', lineJoin: 'round', ...o });
      const items = [];
      if (scene.loop) {
        for (const j of scene.loop.joins) items.push(new mk.PolylineOverlay(coords(j), { style: style({ strokeColor: '#8E8E93', lineWidth: 3, lineDash: [2, 6] }), enabled: false }));
        for (const p of scene.loop.parts) items.push(new mk.PolylineOverlay(coords(p), { style: style({ strokeColor: accent, lineWidth: 5 }), enabled: false }));
      } else {
        const order = [...scene.roads].sort((a, b) => (a.selected - b.selected) || a.road.score - b.road.score);
        for (const x of order) {
          const g = shade(x.road.score), on = x.selected, c = coords(pts(x.road)), data = { ref: x.road.ref }, enabled = !S.road;
          const layers = dark
            ? [{ strokeColor: '#70C3CE', lineWidth: on ? 16 : 11, strokeOpacity: on ? .55 : .3 * g },
               { strokeColor: on ? '#FFFFFF' : '#CFF4F7', lineWidth: on ? 4.5 : 2.6, strokeOpacity: on ? 1 : .45 + .55 * g }]
            : [{ strokeColor: '#26A6AD', lineWidth: on ? 18 : 12, strokeOpacity: on ? .45 : .28 * g },
               { strokeColor: '#FFFFFF', lineWidth: on ? 8 : 5.5, strokeOpacity: .9 },
               { strokeColor: '#087F88', lineWidth: on ? 4.5 : 3, strokeOpacity: on ? 1 : .5 + .5 * g }];
          for (const l of layers) items.push(new mk.PolylineOverlay(c, { style: style(l), data, enabled }));
        }
      }
      map.addOverlays(items);
      if (scene.center) {
        const dot = () => { const el = document.createElement('div'); el.className = 'g-dot'; return el; };
        map.addAnnotation(new mk.Annotation(new mk.Coordinate(scene.center[0], scene.center[1]), dot,
          { title: scene.label || '', enabled: false, anchorOffset: new DOMPoint(0, 0) }));
      }
      const p = padding(), side = wide() ? 428 : 0;
      map.padding = new mk.Padding(0, 0, 0, side);
      const pad = new mk.Padding(p.top, p.right, p.bottom, p.left - side);
      if (scene.fit === 'us' || (!items.length && scene.fit !== 'none')) {
        map.region = new mk.CoordinateRegion(new mk.Coordinate(38.5, -96.5), new mk.CoordinateSpan(26, 62));
      } else if (scene.fit !== 'none') {
        if (!map.element.clientWidth) return;
        map.showItems(scene.fitCenter === false ? items : [...items, ...map.annotations], { animate: !matchMedia('(prefers-reduced-motion: reduce)').matches, padding: pad });
      }
    },
  };

  const mapView = {
    impl: null, scene: null,
    draw(scene) { this.scene = scene; if (this.impl) this.impl.draw(scene); },
    use(impl, note) {
      const container = $('#g-map');
      container.classList.remove('g-waiting');
      try { impl.mount(container); } catch (e) { if (impl !== plainMap) return this.use(plainMap, MAP_FAILED); throw e; }
      this.impl = impl;
      const n = $('#g-mapnote');
      n.hidden = !note; n.textContent = note || '';
      if (this.scene) impl.draw(this.scene);
    },
  };
  const MAP_FAILED = 'Apple’s map didn’t load, so the roads are drawn on their own.';

  function startMap() {
    const token = (window.PALOMARES_MAPKIT_TOKEN || '').trim();
    if (!token) return mapView.use(plainMap, 'Roads drawn without a map (no MapKit token).');
    // Apple's map, or the roads on their own if its code doesn't load in time or Apple refuses the token (it's
    // limited to palomares.app, so on any other origin MapKit reports Unauthorized after the map is up)
    let loaded = false, fellBack = false;
    const fail = () => { if (!fellBack) { fellBack = true; mapView.use(plainMap, MAP_FAILED); } };
    window.__palomaresMapKit = () => {
      loaded = true;
      try {
        window.mapkit.addEventListener('error', fail);
        window.mapkit.init({ authorizationCallback: done => done(token), language: 'en' });
        if (!fellBack) {
          mapView.use(appleMap);
          if (!S.at && !S.road) render();     // the opening line can now offer zooming the map
        }
      } catch { fail(); }
    };
    const s = document.createElement('script');
    s.src = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.core.js';
    s.crossOrigin = 'anonymous';
    s.async = true;
    s.dataset.callback = '__palomaresMapKit';
    s.dataset.libraries = 'map,overlays,annotations';
    s.onerror = fail;
    document.head.append(s);
    setTimeout(() => { if (!loaded) fail(); }, 10000);
  }

  // MARK: Search and location

  const input = $('#g-q'), box = $('#g-suggest');
  let options = [], active = -1, seq = 0;
  function showOptions(list) {
    options = list; active = list.length ? 0 : -1;
    box.innerHTML = list.map((o, i) => `<li id="g-opt-${i}" role="option" aria-selected="${i === active}" data-i="${i}">${esc(o.label)}${o.detail ? ` <span class="muted">${esc(o.detail)}</span>` : ''}</li>`).join('');
    box.hidden = !list.length;
    input.setAttribute('aria-expanded', String(!!list.length));
    if (active >= 0) input.setAttribute('aria-activedescendant', `g-opt-${active}`); else input.removeAttribute('aria-activedescendant');
  }
  function move(k) {
    if (!options.length) return;
    active = (active + k + options.length) % options.length;
    $$('li', box).forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
    input.setAttribute('aria-activedescendant', `g-opt-${active}`);
    $(`#g-opt-${active}`).scrollIntoView({ block: 'nearest' });
  }
  function choose(o) {
    showOptions([]);
    fitNext = true;                     // a search moves the map: fit its roads, then the list follows the map
    if (o.road) {                       // a road: its page, with the town it's near as the place to go back to
      input.value = o.place;
      if (o.at) store.set('guide.last', { at: o.at, place: o.place });
      return go({ at: o.at, place: o.place, road: o.road });
    }
    input.value = o.label;
    store.set('guide.last', { at: o.at, place: o.label });
    go({ at: o.at, place: o.label, road: null }, { focus: false });
  }
  input.addEventListener('input', async () => {
    const mine = ++seq;
    try {
      const list = await suggest(input.value);
      if (mine === seq) showOptions(list);
    } catch { if (mine === seq) setStatus('The town list didn’t load. Check your connection and try again.', true); }
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Escape') { showOptions([]); }
  });
  input.addEventListener('blur', () => setTimeout(() => showOptions([]), 150));
  box.addEventListener('mousedown', e => e.preventDefault());
  box.addEventListener('click', e => { const li = e.target.closest('li'); if (li) choose(options[Number(li.dataset.i)]); });
  $('.g-search').addEventListener('submit', async e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    if (active >= 0 && options[active]) return choose(options[active]);
    const list = await suggest(text).catch(() => []);
    if (list.length) choose(list[0]);
    else { showOptions([]); setStatus(`No town, ZIP, postcode or road in the lower 48 or southern Canada matches “${text}”.`, true); }
  });

  /** The rider's location (the browser asks first), then roads around it. Always ends in roads or a message: a watchdog
      covers a browser that never answers (an unanswered prompt left the iPad's button doing nothing, 2026-10-29). */
  function locate() {
    const b = $('#g-locate');
    if (!navigator.geolocation) return setStatus('This browser can’t share a location. Search for a town, ZIP, postcode or road instead.', true);
    if (b.getAttribute('aria-busy') === 'true') return;
    b.setAttribute('aria-busy', 'true');
    setStatus('Finding your location…');
    let done = false;
    const fail = denied => {
      if (done) return;
      done = true;
      b.removeAttribute('aria-busy');
      setStatus(denied ? 'Location is off for this site. Allow it in your browser’s settings, or search for a town, ZIP, postcode or road.'
        : 'Your location couldn’t be found. Search for a town, ZIP, postcode or road instead.', true);
    };
    const watchdog = setTimeout(() => fail(false), 20000);
    navigator.geolocation.getCurrentPosition(pos => {
      if (done) return;
      done = true;
      clearTimeout(watchdog);
      b.removeAttribute('aria-busy');
      input.value = '';
      // a place, not a fix: kept to about 100 m in the address (and never sent anywhere)
      const at = [pos.coords.latitude, pos.coords.longitude];
      fitNext = true;
      go({ at, place: 'your location', road: null }, { focus: false });
    }, err => { clearTimeout(watchdog); fail(err && err.code === 1); },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  }
  $('#g-locate').addEventListener('click', () => locate());

  // MARK: Clicks

  $$('.g-chip').forEach(b => b.addEventListener('click', () => go({ sort: b.dataset.sort }, { replace: true, focus: false })));
  moreEl.addEventListener('click', () => {
    $$('#g-list li').forEach(li => { li.hidden = false; });
    moreEl.hidden = true;
    const first = $$('#g-list li')[FIRST_ROWS];
    if (first) $('a', first).focus();
  });
  const plain = e => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-ref]');
    if (a && plain(e)) { e.preventDefault(); go({ road: a.dataset.ref }); return; }
    if (e.target.closest('#g-back') && plain(e)) {
      e.preventDefault();
      const target = S.road;
      const u = new URL($('#g-back').href);
      S = { ...readState(u.search), sort: S.sort };
      history.pushState(null, '', href(S));
      render({ focus: false }).then(() => {
        const row = target && $(`.g-row[data-ref="${CSS.escape(target)}"]`);
        if (row) { if (row.parentElement.hidden) row.parentElement.hidden = false; row.focus(); } else $('h1', $('.g-head')).focus();
      });
      return;
    }
    const loop = e.target.closest('.g-loop');
    if (loop) { toggleLoop(loop); return; }
    if (e.target.closest('.g-pick button')) { picked = null; showPick(null); if (current) drawList(false); }
  });
  // a row under the pointer or keyboard shows its road on the map
  const hoverRow = e => {
    const a = e.target.closest && e.target.closest('.g-row');
    if (!a || S.road || !current || picked) return;
    mapView.draw({ roads: sorted(current.list, S.sort).map(n => ({ road: n.road, selected: n.road.ref === a.dataset.ref })), center: S.at, label: shortPlace(), fit: 'none' });
  };
  listEl.addEventListener('mouseover', hoverRow);
  listEl.addEventListener('focusin', hoverRow);
  listEl.addEventListener('mouseleave', () => { if (!S.road && current && !picked) mapView.draw({ ...mapView.scene, roads: mapView.scene.roads.map(x => ({ road: x.road })), fit: 'none' }); });

  // MARK: Start

  startMap();
  // Opening with no place: the last town chosen here, else the country's best roads (Gabe preferred the country to a
  // location prompt on opening, 2026-10-29); the location only when asked for
  if (!S.at && !S.road) {
    const last = store.get('guide.last');
    if (last && Array.isArray(last.at)) { S = { ...S, at: last.at, place: last.place || '' }; history.replaceState(null, '', href(S)); }
  }
  render();
})();

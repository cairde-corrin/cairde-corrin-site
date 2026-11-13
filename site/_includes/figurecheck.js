// The figure consistency check. Figures on the pages are ordinary words that editors can
// change, so nothing stops one page saying "about 370 hectares" while another still says
// 360. After every build this reads the text of every page, finds the measured
// quantities it gives (in digits or in words, in hectares or km², and so on), and warns
// when two pages give the same quantity differently, naming both. It also warns when the
// pages agree with each other but not with the measured value in site/_data/figures.json.
// It only ever warns: a build is never stopped or held back by it. It is a signal for
// whoever maintains the site, not a gate for editors.
//
// A number is matched to a quantity by its unit and by the nearest label in front of it
// ("Catchment area", "action area", "outlet"), or by a few words straight after it
// ("upstream of here", "of climbing"). A number with no label nearby is not checked.
// Sentences that report other people's figures ("Other delineations of the same
// catchment give c. 3.7 km²") are skipped.

const WINDOW = 16;  // how many words back a label may be

// What is watched. unit: the family the number must be written in. form: 'one' for a
// single figure, 'low'/'high' for one end of a range such as 21-213 m. before: label
// words that may come in front of it; after: words that must follow it closely.
// ref: where the measured value is in figures.json.
const WATCH = [
  { id: 'catchment.area', label: 'Catchment area', unit: 'area', form: 'one', before: /\bcatchment\b/i, ref: 'catchment.area_ha' },
  { id: 'catchment.area', label: 'Catchment area', unit: 'area', form: 'one', after: /^drains?\b/i, ref: 'catchment.area_ha' },
  { id: 'action.area', label: 'Proposed action area', unit: 'area', form: 'one', before: /\baction area\b|\barea for action\b|\bdrawn proposal\b/i, ref: 'action_area.ha' },
  { id: 'stop1.upstream', label: 'Area upstream of Stop 01', unit: 'area', form: 'one', after: /^upstream\b/i, ref: 'stops.s1.upstream_ha' },
  { id: 'catchment.top', label: 'Highest point of the catchment', unit: 'm', form: 'high', before: /\brelief\b|\belevation range\b/i, ref: 'catchment.elev_max_m' },
  { id: 'catchment.top', label: 'Highest point of the catchment', unit: 'm', form: 'one', before: /\bfalls from\b/i, ref: 'catchment.elev_max_m' },
  { id: 'catchment.outlet', label: 'Elevation of the outlet', unit: 'm', form: 'low', before: /\brelief\b|\belevation range\b/i, ref: 'catchment.outlet_m' },
  { id: 'catchment.outlet', label: 'Elevation of the outlet', unit: 'm', form: 'one', before: /\boutlet at\b/i, ref: 'catchment.outlet_m' },
  { id: 'catchment.outlet', label: 'Elevation of the outlet', unit: 'm', form: 'one', after: /^(?:OD )?- the outlet\b/i, ref: 'catchment.outlet_m' },
  { id: 'catchment.flow', label: 'Longest flow path', unit: 'km', form: 'one', before: /\bflow path\b/i, ref: 'catchment.flow_path_km' },
  { id: 'loop.length', label: 'Length of the walked loop', unit: 'km', form: 'one', before: /\bwalked loop\b/i, ref: 'loop.length_km' },
  { id: 'loop.length', label: 'Length of the walked loop', unit: 'km', form: 'one', after: /^round\b/i, ref: 'loop.length_km' },
  { id: 'loop.low', label: 'Lowest point of the walked loop', unit: 'm', form: 'low', before: /\bloop\b/i, ref: 'loop.min_m' },
  { id: 'loop.high', label: 'Highest point of the walked loop', unit: 'm', form: 'high', before: /\bloop\b/i, ref: 'loop.max_m' },
  { id: 'loop.climb', label: 'Climbing on the walked loop', unit: 'm', form: 'one', after: /^of climbing\b/i, ref: 'loop.ascent_m' },
  { id: 'route.length', label: 'Length of the proposed loop route', unit: 'km', form: 'one', before: /\broute\b/i, ref: 'proposal.loop_km' },
  { id: 'route.extension', label: 'New trail in the Glenabo extension', unit: 'm', form: 'one', after: /^of new trail\b/i, ref: 'proposal.extension_m' },
  { id: 'pair.apart', label: 'Distance between the two photographs', unit: 'm', form: 'one', after: /^apart\b/i, ref: 'photo_pair.apart_m' },
  { id: 'stops.recorded', label: 'Number of recorded stops', unit: 'stops', form: 'one', ref: 'stops.recorded' },
];

// Sentences that report someone else's figure, which may rightly differ from ours
const QUOTING = /\b(?:other|others|elsewhere|earlier|previous|delineations?|as a check)\b/i;

const UNITS = [
  { re: /^(?:km²|km2|square kilomet(?:re|er)s?)(?![a-z])/i, unit: 'area', scale: 100 },  // to hectares
  { re: /^(?:hectares?|ha)(?![a-z])/i, unit: 'area', scale: 1 },
  { re: /^(?:km|kilomet(?:re|er)s?)(?![a-z²])/i, unit: 'km', scale: 1 },
  { re: /^(?:m|metres?|meters?)(?![a-z²])/i, unit: 'm', scale: 1 },
  { re: /^(?:recorded stops?|stops? recorded|recorded)\b/i, unit: 'stops', scale: 1 },
];

// Numbers written as words, as the site does at the start of a sentence or in prose
const SMALL = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90 };
const WORD = `(?:${Object.keys(SMALL).join('|')}|hundred|thousand)`;
const WORDS = new RegExp(`\\b${WORD}(?:(?:[ -]|\\sand\\s)${WORD})*\\b`, 'gi');

function wordsToNumber(s) {
  let total = 0, cur = 0;
  for (const w of s.toLowerCase().split(/[\s-]+/)) {
    if (w === 'and') continue;
    if (w === 'hundred') cur = (cur || 1) * 100;
    else if (w === 'thousand') { total += (cur || 1) * 1000; cur = 0; }
    else if (w in SMALL) cur += SMALL[w];
    else return NaN;
  }
  return total + cur;
}

// Precision a figure is given to: 360 -> 10, 21 -> 1, 2.3 -> 0.1
function precision(text, value) {
  const dec = /\.(\d+)$/.exec(text);
  if (dec) return 10 ** -dec[1].length;
  if (!Number.isInteger(value) || value === 0) return 1;
  let p = 1;
  while (value % (p * 10) === 0) p *= 10;
  return p;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', sup2: '²', deg: '°' };
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

// A page's text as the blocks a reader sees: title, description, structured-data
// descriptions, then the body, split at every block-level element.
function textOf(html) {
  const parts = [];
  const title = /<title>([\s\S]*?)<\/title>/i.exec(html);
  if (title) parts.push(title[1]);
  const desc = /<meta name="description" content="([^"]*)"/i.exec(html);
  if (desc) parts.push(desc[1]);
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    for (const d of m[1].matchAll(/"description":\s*"((?:[^"\\]|\\.)*)"/g)) parts.push(JSON.parse(`"${d[1]}"`));
  }
  const body = (/<body[^>]*>([\s\S]*)<\/body>/i.exec(html) || [, ''])[1]
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, ' ')
    .replace(/<\/?(?:p|div|li|ul|ol|dl|dt|dd|h[1-6]|section|article|figure|figcaption|main|header|footer|nav|blockquote|table|tr|td|th|title|desc|label|span class="(?:st|sd|se|sn)")\b[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  parts.push(...body.split('\n'));
  return parts.map((p) => decode(p).replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function words(s) { return s.split(/\s+/).filter(Boolean); }

// Every watched figure on one page: [{ id, label, value, precision, quote }]
function mentions(blocks) {
  const found = [];
  blocks.forEach((block, bi) => {
    // the words of the blocks before this one, nearest last, for labels such as "Catchment area"
    const back = words(blocks.slice(Math.max(0, bi - 6), bi).join(' ')).slice(-WINDOW);
    const sentences = block.split(/(?<=[.!?])\s+(?=[A-Z"“‘(])/);
    for (const sentence of sentences) {
      if (QUOTING.test(sentence)) continue;
      const nums = [];
      for (const m of sentence.matchAll(/(\d+(?:\.\d+)?)\s*(?:-|\u2013|to)\s*(\d+(?:\.\d+)?)\s*/g)) {
        nums.push({ at: m.index, end: m.index + m[0].length, range: [m[1], m[2]] });
      }
      for (const m of sentence.matchAll(/(?<![\d.])(\d+(?:\.\d+)?)(?![\d.])\s*/g)) {
        if (nums.some((n) => m.index >= n.at && m.index < n.end)) continue;
        nums.push({ at: m.index, end: m.index + m[0].length, one: m[1] });
      }
      for (const m of sentence.matchAll(WORDS)) {
        const v = wordsToNumber(m[0]);
        if (Number.isNaN(v)) continue;
        nums.push({ at: m.index, end: m.index + m[0].length, one: String(v), worded: m[0] });
      }
      for (const n of nums) {
        const rest = sentence.slice(n.end).replace(/^\s+/, '');
        const u = UNITS.find((x) => x.re.test(rest));
        if (!u) continue;
        const afterUnit = rest.replace(u.re, '').replace(/^[\s,]+/, '');
        const before = [...back, ...words(sentence.slice(0, n.at))].slice(-WINDOW).join(' ');
        // the rest of the paragraph, for a label that comes after ("About 360 hectares. One outlet. A catchment ...")
        const ahead = words(block.slice(block.indexOf(sentence) + n.end)).slice(0, WINDOW).join(' ');
        const forms = n.range ? [['low', n.range[0]], ['high', n.range[1]]] : [['one', n.one]];
        for (const [form, text] of forms) {
          const q = classify(u.unit, form, before, afterUnit, ahead);
          if (!q) continue;
          const value = +text * u.scale;
          found.push({ id: q.id, label: q.label, ref: q.ref, unit: u.unit, value,
            precision: precision(text, +text) * u.scale, quote: sentence.length > 90 ? sentence.slice(0, 87) + '...' : sentence });
        }
      }
    }
  });
  return found;
}

// The watched quantity a number belongs to: a closely following phrase wins, then the
// nearest label in front of it, then the nearest label later in the same paragraph
function classify(unit, form, before, after, ahead = '') {
  const fits = WATCH.filter((q) => q.unit === unit && q.form === form);
  const close = fits.find((q) => q.after && q.after.test(after));
  if (close) return close;
  if (unit === 'stops') return fits[0];
  let best = null, bestAt = -1;
  for (const q of fits) {
    if (!q.before) continue;
    const re = new RegExp(q.before.source, 'gi');
    let m, at = -1;
    while ((m = re.exec(before))) at = m.index;
    if (at > bestAt) { best = q; bestAt = at; }
  }
  if (best) return best;
  let nearest = Infinity;
  for (const q of fits) {
    if (!q.before) continue;
    const m = new RegExp(q.before.source, 'i').exec(ahead);
    if (m && m.index < nearest) { best = q; nearest = m.index; }
  }
  return best;
}

function agree(a, b) {
  return Math.abs(a.value - b.value) < Math.max(a.precision, b.precision) / 2 + 1e-9;
}

const UNIT_TEXT = { area: 'ha', m: 'm', km: 'km', stops: '' };
const show = (v, unit) => `${+v.toFixed(2)}${UNIT_TEXT[unit] ? ' ' + UNIT_TEXT[unit] : ''}`;

// pages: [{ url, html }]. reference: figures.json. Returns the warnings, one per quantity.
function check(pages, reference = {}) {
  const byId = new Map();
  for (const p of pages) {
    for (const m of mentions(textOf(p.html))) {
      if (!byId.has(m.id)) byId.set(m.id, []);
      byId.get(m.id).push({ ...m, url: p.url });
    }
  }
  const warnings = [];
  for (const [id, list] of byId) {
    // group the mentions that agree with each other
    const groups = [];
    for (const m of list) {
      const g = groups.find((x) => agree(x[0], m));
      if (g) g.push(m); else groups.push([m]);
    }
    const where = (g) => [...new Set(g.map((m) => m.url))].join(', ');
    const label = list[0].label;
    if (groups.length > 1) {
      groups.sort((a, b) => b.length - a.length);
      const parts = groups.map((g) => `${show(g[0].value, g[0].unit)} on ${where(g)} ("${g[0].quote}")`);
      warnings.push(`${label} is given differently on different pages: ${parts.join('; but ')}.`);
      continue;
    }
    const measured = String(list[0].ref).split('.').reduce((o, k) => (o == null ? undefined : o[k]), reference);
    if (measured != null && measured !== '') {
      const ref = { value: +measured, precision: precision(String(measured), +measured) };
      if (!agree(ref, list[0])) {
        warnings.push(`${label}: every page that gives it says ${show(list[0].value, list[0].unit)} (${where(list)}), `
          + `but the measured value in site/_data/figures.json is ${show(ref.value, list[0].unit)}.`);
      }
    }
  }
  return warnings;
}

module.exports = { check, mentions, textOf, wordsToNumber, WATCH };

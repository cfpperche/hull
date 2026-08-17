// Shared helpers for every sensor. Concatenated ahead of the sensor body and
// evaluated as one function body, so a sensor file is *statements ending in
// `return`*, never a standalone program.
//
// Everything here runs in the page. It may not assume a framework, a build, a
// test id convention or a design system — a sensor that needs those is not a
// sensor, it is a project test.

const CAP = 4000; // elements walked; a 10k-node page is a finding of its own

function box(el) {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
}

function visible(el) {
  if (!el || el.nodeType !== 1) return false;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  if (el.closest('[aria-hidden="true"],[hidden]')) return false;
  return true;
}

// A selector someone else can paste. Test ids first because they survive a
// restyle; a long nth-child chain is the last resort and is marked as fragile
// by being long, not by a flag.
function sel(el) {
  if (!el || el.nodeType !== 1) return '';
  for (const attr of ['data-testid', 'data-test-id', 'data-test', 'data-qa']) {
    const v = el.getAttribute && el.getAttribute(attr);
    if (v) return `[${attr}="${CSS.escape(v)}"]`;
  }
  if (el.id && !/^[0-9]/.test(el.id)) return `#${CSS.escape(el.id)}`;
  const parts = [];
  let node = el, depth = 0;
  while (node && node.nodeType === 1 && depth < 4) {
    let part = node.tagName.toLowerCase();
    const cls = (node.getAttribute('class') || '').trim().split(/\s+/).filter(c => c && c.length < 24).slice(0, 2);
    if (cls.length) part += '.' + cls.map(c => CSS.escape(c)).join('.');
    const parent = node.parentElement;
    if (parent) {
      const sibs = Array.from(parent.children).filter(c => c.tagName === node.tagName);
      if (sibs.length > 1) part += `:nth-of-type(${sibs.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    if (node.id) { parts[0] = `#${CSS.escape(node.id)}`; break; }
    node = parent; depth++;
  }
  return parts.join(' > ');
}

function all() {
  const out = [];
  const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_ELEMENT);
  let n = walker.currentNode;
  while (n && out.length < CAP) {
    if (visible(n)) out.push(n);
    n = walker.nextNode();
  }
  return out;
}

// ── colour ──────────────────────────────────────────────────────────────────
// Let the browser parse. A regex for `rgb()` was the first version of this and
// it was measuring nothing on the first real app it met: Tailwind 4 and shadcn
// emit `oklch()`, Chrome preserves the authored colour space in the computed
// value, the regex returned null, and every contrast check quietly skipped the
// element. A sensor that reports zero failures because it could not read the
// colour is worse than one that is absent — so parsing goes through a 1×1
// canvas, which converts anything CSS understands (oklch, lab, color(), named,
// hex) into sRGB bytes. Memoised: this is called thousands of times per page.
// Handing the string to a canvas and reading the pixel back would be the
// obvious way to do this, and it is what the second version did. It hangs on
// any host where the renderer will not rasterise — the same defect that breaks
// screenshots here — so the conversion is done in arithmetic instead. Slower to
// write, works everywhere, and it can be checked by hand.
const __colorMemo = new Map();
const __colorUnparsed = new Set();

function __num(tok, scale) { // "50%" | "0.5" | "none"
  if (tok === undefined || tok === null) return null;
  tok = String(tok).trim();
  if (tok === 'none') return 0;
  if (tok.endsWith('%')) return (parseFloat(tok) / 100) * (scale === undefined ? 1 : scale);
  const v = parseFloat(tok);
  return Number.isNaN(v) ? null : v;
}

function __gamma(v) { // linear sRGB → sRGB, 0..255
  const s = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(s * 255)));
}

// OKLab → linear sRGB. Björn Ottosson's matrices, the ones the CSS Color 4
// spec carries; Tailwind 4 and shadcn emit oklch(), and Chrome keeps the
// authored colour space in the computed value, so on a modern app this path is
// not an edge case — it is the common one.
function __oklabToRgb(L, a, b, alpha) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return {
    r: __gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: __gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: __gamma(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
    a: alpha
  };
}

function parseColor(str) {
  if (!str) return null;
  if (__colorMemo.has(str)) return __colorMemo.get(str);
  const s = String(str).trim().toLowerCase();
  let out = null;

  if (s === 'transparent') out = { r: 0, g: 0, b: 0, a: 0 };
  else if (s === 'white') out = { r: 255, g: 255, b: 255, a: 1 };
  else if (s === 'black') out = { r: 0, g: 0, b: 0, a: 1 };
  else if (s[0] === '#') {
    const h = s.slice(1);
    const x = h.length <= 4
      ? h.split('').map(c => parseInt(c + c, 16))
      : (h.match(/../g) || []).map(c => parseInt(c, 16));
    if (x.length >= 3 && !x.some(Number.isNaN)) out = { r: x[0], g: x[1], b: x[2], a: x.length > 3 ? x[3] / 255 : 1 };
  } else {
    const fn = s.match(/^([a-z]+)\(([^)]*)\)$/);
    if (fn) {
      const name = fn[1];
      const parts = fn[2].split('/');
      const args = parts[0].split(/[,\s]+/).filter(Boolean);
      const alpha = parts.length > 1 ? (__num(parts[1], 1) === null ? 1 : __num(parts[1], 1)) : null;
      if (name === 'rgb' || name === 'rgba') {
        const p = args.map(v => __num(v, 255));
        const a = alpha !== null ? alpha : (args.length > 3 ? __num(args[3], 1) : 1);
        if (p.length >= 3 && !p.slice(0, 3).some(v => v === null)) out = { r: p[0], g: p[1], b: p[2], a: a === null ? 1 : a };
      } else if (name === 'oklch') {
        const L = __num(args[0], 1), C = __num(args[1], 0.4), H = __num(args[2], 360);
        if (L !== null && C !== null) {
          const h = ((H || 0) * Math.PI) / 180;
          out = __oklabToRgb(L, C * Math.cos(h), C * Math.sin(h), alpha === null ? 1 : alpha);
        }
      } else if (name === 'oklab') {
        const L = __num(args[0], 1), A = __num(args[1], 0.4), B = __num(args[2], 0.4);
        if (L !== null) out = __oklabToRgb(L, A || 0, B || 0, alpha === null ? 1 : alpha);
      } else if (name === 'color') {
        // color(srgb r g b / a) — and display-p3 read as sRGB, which is close
        // enough for a contrast ratio and wrong by less than the rounding.
        const space = args[0];
        const p = args.slice(1, 4).map(v => __num(v, 1));
        if (/^(srgb|srgb-linear|display-p3)$/.test(space) && p.length === 3 && !p.some(v => v === null)) {
          const lin = space === 'srgb-linear';
          out = {
            r: lin ? __gamma(p[0]) : Math.round(p[0] * 255),
            g: lin ? __gamma(p[1]) : Math.round(p[1] * 255),
            b: lin ? __gamma(p[2]) : Math.round(p[2] * 255),
            a: alpha === null ? 1 : alpha
          };
        }
      }
    }
  }

  // Silence is the failure mode that matters: a colour space nobody here
  // handles must show up as a number in the facts, not as "no contrast
  // problems found".
  if (!out) __colorUnparsed.add(s.slice(0, 40));
  __colorMemo.set(str, out);
  return out;
}

function over(fg, bg) { // composite fg (with alpha) over opaque bg
  const a = fg.a;
  return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
}

function relLum(c) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

function contrast(a, b) {
  const l1 = relLum(a), l2 = relLum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// The background a pixel actually lands on: collect every translucent layer up
// to the first opaque one, then composite them back down onto white. An image
// or a gradient makes the answer undecidable from CSS alone — say so and let a
// judge look at the pixels, rather than reporting a number that is fiction.
function effectiveBg(el) {
  const layers = [];
  let node = el;
  while (node && node.nodeType === 1) {
    const cs = getComputedStyle(node);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return { color: null, unknown: 'background-image' };
    const c = parseColor(cs.backgroundColor);
    if (c && c.a > 0) {
      layers.push(c);
      if (c.a >= 1) break;
    }
    node = node.parentElement;
  }
  let base = { r: 255, g: 255, b: 255, a: 1 };
  for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
  return { color: base, unknown: null };
}

function hex(c) {
  const h = v => Math.round(v).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

function hue(c) {
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return { h: 0, s: 0, l: (max + min) / 2 };
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60); if (h < 0) h += 360;
  const l = (max + min) / 2;
  return { h, s: d / (1 - Math.abs(2 * l - 1)), l };
}

function ownText(el) {
  let t = '';
  for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue;
  return t.trim();
}

function accName(el) {
  const aria = el.getAttribute('aria-label');
  if (aria && aria.trim()) return aria.trim();
  const by = el.getAttribute('aria-labelledby');
  if (by) {
    const t = by.split(/\s+/).map(id => (document.getElementById(id) || {}).textContent || '').join(' ').trim();
    if (t) return t;
  }
  if (el.id) {
    const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (lab && lab.textContent.trim()) return lab.textContent.trim();
  }
  const wrap = el.closest('label');
  if (wrap && wrap.textContent.trim()) return wrap.textContent.trim();
  const txt = (el.textContent || '').trim();
  if (txt) return txt;
  const title = el.getAttribute('title');
  if (title && title.trim()) return title.trim();
  const img = el.querySelector && el.querySelector('img[alt]');
  if (img && img.getAttribute('alt').trim()) return img.getAttribute('alt').trim();
  return '';
}

function finding(rule, severity, el, message, extra) {
  return Object.assign({
    rule,
    severity,
    selector: el ? sel(el) : '',
    box: el ? box(el) : null,
    text: el ? (el.textContent || '').trim().slice(0, 80) : '',
    message
  }, extra || {});
}

function tally(list) {
  const m = new Map();
  for (const v of list) m.set(v, (m.get(v) || 0) + 1);
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
}

function cap(arr, n) { return arr.slice(0, n); }

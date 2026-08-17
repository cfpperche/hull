// Distributional tells — the measurable half of "this looks generated".
//
// A model asked an open design question answers with the statistical centre of
// its training data, and by 2026 that centre is well documented: Inter, a violet
// accent, a violet→blue gradient, frosted cards, a 4px coloured left border, a
// badge above the headline, three feature cards in a row. Each of those is a
// *measurable* property of the rendered page, so measuring them is cheaper and
// steadier than asking a judge whether something "feels generic".
//
// These are priors, not verdicts. A violet brand is allowed to be violet — that
// is what the profile's brand contract is for, and the identity critic is the
// one that decides whether a tell is this project's voice or the model's.
// Rule of use: a tell alone never becomes a finding. It becomes evidence.

const tells = [];
const note = (tell, weight, count, evidence, why) => tells.push({ tell, weight, count, evidence: cap(evidence, 4), why });

const els = all();
const cssText = (() => {
  let s = '';
  for (const sheet of Array.from(document.styleSheets)) {
    try { for (const r of Array.from(sheet.cssRules || [])) s += r.cssText + '\n'; } catch (e) { /* cross-origin */ }
  }
  return s;
})();

// 1. the font. Inter/Geist as the whole voice of the page.
const bodyFont = (getComputedStyle(document.body).fontFamily || '').split(',')[0].replace(/["']/g, '').trim();
const defaultFonts = /^(Inter|Geist|Geist Sans|SF Pro|Roboto|system-ui|-apple-system)$/i;
const fontIsDefault = defaultFonts.test(bodyFont);

// 2. the accent hue. Violet/indigo (h 250–290) on primary controls or links.
const accents = [];
for (const el of els) {
  const cs = getComputedStyle(el);
  const isControl = /^(button|a)$/i.test(el.tagName) || el.getAttribute('role') === 'button';
  const c = parseColor(cs.backgroundColor);
  if (isControl && c && c.a > 0.5) {
    const h = hue(c);
    if (h.s > 0.35 && h.l > 0.2 && h.l < 0.75) accents.push({ el, hex: hex(c), hue: h.h });
  }
}
const violetAccents = accents.filter(a => a.hue >= 245 && a.hue <= 295);
if (violetAccents.length) {
  note('violet-accent', fontIsDefault ? 3 : 2, violetAccents.length,
    violetAccents.map(a => ({ selector: sel(a.el), color: a.hex, hue: a.hue })),
    fontIsDefault
      ? `${bodyFont} + a violet accent is the exact centre of the distribution`
      : 'violet/indigo accent on primary controls');
}

// 3. violet→blue gradients.
const gradients = [];
for (const el of els) {
  const bi = getComputedStyle(el).backgroundImage;
  if (!bi || !bi.includes('gradient(')) continue;
  const stops = (bi.match(/rgba?\([^)]+\)/g) || []).map(parseColor).filter(Boolean);
  const hues = stops.map(hue).filter(h => h.s > 0.3).map(h => h.h);
  const cool = hues.filter(h => h >= 200 && h <= 300);
  if (cool.length >= 2) gradients.push({ selector: sel(el), hues: cool, box: box(el) });
}
if (gradients.length) note('cool-gradient', 3, gradients.length, gradients, 'violet→blue gradient, the 2025 default that reads as a stock template in 2026');

// 4. glassmorphism.
const glass = [];
for (const el of els) {
  const cs = getComputedStyle(el);
  const bf = cs.backdropFilter || cs.webkitBackdropFilter || '';
  if (bf && bf !== 'none' && /blur/.test(bf)) glass.push({ selector: sel(el), filter: bf, box: box(el) });
}
if (glass.length) note('glassmorphism', 2, glass.length, glass, 'frosted panels; costly to read text on, and rarely what the brand asked for');

// 5. the coloured left-border card — the single most repeated tell.
const strips = [];
for (const el of els) {
  const cs = getComputedStyle(el);
  const l = parseFloat(cs.borderLeftWidth) || 0;
  const others = ['borderRightWidth', 'borderTopWidth', 'borderBottomWidth'].map(p => parseFloat(cs[p]) || 0);
  if (l >= 3 && l <= 8 && others.every(w => w < 1)) {
    const c = parseColor(cs.borderLeftColor);
    if (c && c.a > 0.5 && hue(c).s > 0.25) strips.push({ selector: sel(el), width: l, color: hex(c) });
  }
}
if (strips.length) note('left-border-strip', 3, strips.length, strips, 'the 3–4px coloured left strip on a card');

// 6. radius zoo / pill everything.
const bigRadius = [];
for (const el of els) {
  const b = box(el);
  if (b.w < 240 || b.h < 80) continue;
  const r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  if (r >= 20) bigRadius.push({ selector: sel(el), radius: Math.round(r), size: `${b.w}×${b.h}` });
}
if (bigRadius.length) note('giant-radius', 1, bigRadius.length, bigRadius, 'containers rounded ≥20px — soft-toy geometry on a work surface');

// 7. the three-card row.
const triplets = [];
for (const el of els) {
  const cs = getComputedStyle(el);
  if (!/flex|grid/.test(cs.display)) continue;
  const kids = Array.from(el.children).filter(visible);
  if (kids.length !== 3) continue;
  const ws = kids.map(k => box(k).w);
  const even = Math.max(...ws) - Math.min(...ws) < Math.max(...ws) * 0.15;
  const structured = kids.every(k => k.querySelector('h1,h2,h3,h4,h5,h6,strong,b') && (k.textContent || '').trim().length > 30);
  if (even && structured && ws[0] > 140) triplets.push({ selector: sel(el), childWidth: Math.round(ws[0]) });
}
if (triplets.length) note('feature-triplet', 2, triplets.length, triplets, 'three equal cards in a row — the default rhythm for "explain the product"');

// 8. badge above the headline.
const badges = [];
for (const h of document.querySelectorAll('h1,h2')) {
  if (!visible(h)) continue;
  const prev = h.previousElementSibling;
  if (!prev || !visible(prev)) continue;
  const cs = getComputedStyle(prev);
  const b = box(prev);
  const rounded = (parseFloat(cs.borderRadius) || 0) >= 12;
  const small = b.h <= 40 && b.w <= 320 && (prev.textContent || '').trim().length < 48;
  if (rounded && small) badges.push({ selector: sel(prev), text: (prev.textContent || '').trim().slice(0, 40) });
}
if (badges.length) note('badge-above-headline', 2, badges.length, badges, 'the pill announcing a feature above the hero headline');

// 9. emoji standing in for an icon set.
const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const emojiUse = [];
for (const el of document.querySelectorAll('button,a,h1,h2,h3,li,[role="button"]')) {
  if (!visible(el)) continue;
  const t = ownText(el);
  if (t && emoji.test(t)) emojiUse.push({ selector: sel(el), text: t.slice(0, 30) });
}
if (emojiUse.length >= 3) note('emoji-icons', 2, emojiUse.length, emojiUse, 'emoji used as the icon set');

// 10. gray-on-gray body copy — "muted" applied until nothing has weight.
const muted = [];
for (const el of els) {
  const t = ownText(el);
  if (!t || t.length < 20) continue;
  const c = parseColor(getComputedStyle(el).color);
  if (!c) continue;
  const h = hue(c);
  if (h.s < 0.12 && h.l > 0.4 && h.l < 0.72) muted.push({ selector: sel(el), color: hex(c) });
}
if (muted.length >= 6) note('everything-muted', 1, muted.length, cap(muted, 4), 'long copy set in mid-gray; hierarchy by fade rather than by size or space');

// 11. shadow on everything — depth as decoration.
const shadowed = els.filter(el => { const s = getComputedStyle(el).boxShadow; return s && s !== 'none'; });
if (shadowed.length > 12) note('shadow-everywhere', 1, shadowed.length, cap(shadowed.map(el => ({ selector: sel(el) })), 3), `${shadowed.length} elements carry a box-shadow`);

const score = tells.reduce((s, t) => s + t.weight, 0);

return {
  sensor: 'slop',
  version: 1,
  facts: {
    bodyFont,
    bodyFontIsDefault: fontIsDefault,
    accentColors: cap(tally(accents.map(a => a.hex)), 6),
    tells: tells.map(t => t.tell),
    slopWeight: score,
    cssRulesRead: cssText.length > 0
  },
  findings: [],
  tells
};

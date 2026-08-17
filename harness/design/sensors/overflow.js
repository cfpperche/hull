// Layout that broke at this viewport — the defect class a desktop-only capture
// never shows and a code review never catches, because both are the wrong
// instrument. Runs at every viewport the profile declares.

const out = [];
const vw = window.innerWidth, vh = window.innerHeight;
const doc = document.documentElement;

if (doc.scrollWidth > vw + 1) {
  const culprits = [];
  for (const el of all()) {
    const b = box(el);
    if (b.w === 0) continue;
    if (b.x + b.w > vw + 2 && b.w <= doc.scrollWidth) culprits.push({ el, over: Math.round(b.x + b.w - vw) });
  }
  culprits.sort((a, b) => b.over - a.over);
  const worst = culprits[0];
  out.push(finding('layout.horizontal-scroll', 'major', worst ? worst.el : document.body,
    `page scrolls sideways: content is ${doc.scrollWidth}px wide in a ${vw}px viewport`, {
      documentWidth: doc.scrollWidth, viewportWidth: vw,
      widest: cap(culprits, 5).map(c => ({ selector: sel(c.el), overflowPx: c.over }))
    }));
}

for (const el of all()) {
  const cs = getComputedStyle(el);
  const t = ownText(el);
  if (!t) continue;
  const clipped = el.scrollWidth > el.clientWidth + 2 && /hidden|clip/.test(cs.overflowX);
  const ellipsis = cs.textOverflow === 'ellipsis';
  if (clipped && !ellipsis) {
    out.push(finding('layout.text-clipped', 'major', el, 'text is cut off with no ellipsis and no title', {
      scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, sample: t.slice(0, 60)
    }));
  } else if (clipped && ellipsis && !el.getAttribute('title') && !el.getAttribute('aria-label')) {
    out.push(finding('layout.truncated-untitled', 'minor', el, 'text truncates with no title/aria-label, so the full value is unreachable', {
      sample: t.slice(0, 60)
    }));
  }
  if (el.scrollHeight > el.clientHeight + 2 && /hidden|clip/.test(cs.overflowY) && el.clientHeight > 0) {
    out.push(finding('layout.vertical-clip', 'minor', el, 'content is taller than its box and vertically clipped', {
      scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, sample: t.slice(0, 40)
    }));
  }
}

// Two visible boxes sitting on top of each other with text in both is either a
// deliberate overlay or a collision; report it and let the pixels decide.
const collisions = [];
const texty = all().filter(el => ownText(el) && box(el).w > 40 && box(el).h > 10).slice(0, 400);
for (let i = 0; i < texty.length; i++) {
  for (let j = i + 1; j < texty.length; j++) {
    const a = box(texty[i]), b = box(texty[j]);
    if (texty[i].contains(texty[j]) || texty[j].contains(texty[i])) continue;
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox > 8 && oy > 8) {
      const za = parseInt(getComputedStyle(texty[i]).zIndex, 10) || 0;
      const zb = parseInt(getComputedStyle(texty[j]).zIndex, 10) || 0;
      if (za === zb) collisions.push({ a: sel(texty[i]), b: sel(texty[j]), overlapPx: Math.round(ox * oy) });
    }
  }
}
if (collisions.length) {
  out.push(finding('layout.overlap', 'minor', null,
    `${collisions.length} pairs of text boxes overlap at the same stacking level`, { pairs: cap(collisions, 5) }));
}

return {
  sensor: 'overflow',
  version: 1,
  facts: {
    viewport: { w: vw, h: vh },
    documentWidth: doc.scrollWidth,
    documentHeight: doc.scrollHeight,
    horizontalScroll: doc.scrollWidth > vw + 1,
    foldHeight: vh
  },
  findings: cap(out, 25)
};

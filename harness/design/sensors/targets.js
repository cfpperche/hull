// WCAG 2.2 SC 2.5.8 — target size (minimum), 24×24 CSS px.
//
// The spec's exceptions matter more than the rule: an inline link inside a
// sentence is exempt, and so is a control whose *spacing* leaves a 24px circle
// free around it. A sensor that ignores both files a page of noise on any
// well-built body of text, so both are implemented here.

const MIN = 24;
const sels = 'a[href],button,input,select,textarea,summary,[role="button"],[role="link"],[role="checkbox"],[role="switch"],[role="tab"],[role="menuitem"],[tabindex]:not([tabindex="-1"])';
const out = [];
const boxes = [];

for (const el of document.querySelectorAll(sels)) {
  if (!visible(el)) continue;
  const b = box(el);
  boxes.push({ el, b });
}

function inlineInText(el) {
  if (el.tagName !== 'A') return false;
  const p = el.parentElement;
  if (!p) return false;
  const cs = getComputedStyle(el);
  if (cs.display !== 'inline' && cs.display !== 'inline-block') return false;
  const own = (p.textContent || '').length - (el.textContent || '').length;
  return own > (el.textContent || '').length * 0.4; // sits in a run of prose
}

for (const { el, b } of boxes) {
  if (b.w >= MIN && b.h >= MIN) continue;
  if (inlineInText(el)) continue;
  if (el.type === 'hidden') continue;

  // Spacing exception: no other target's 24px circle overlaps this one's.
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  let crowded = false;
  for (const other of boxes) {
    if (other.el === el) continue;
    const ox = other.b.x + other.b.w / 2, oy = other.b.y + other.b.h / 2;
    if (Math.hypot(cx - ox, cy - oy) < MIN) { crowded = true; break; }
  }
  if (!crowded) continue;

  out.push(finding('target.size', b.w < 16 || b.h < 16 ? 'major' : 'minor', el,
    `hit target ${b.w}×${b.h}px, minimum ${MIN}×${MIN} and neighbours are within ${MIN}px`, {
      width: b.w, height: b.h, minimum: MIN, wcag: '2.5.8',
      name: accName(el).slice(0, 60)
    }));
}

return {
  sensor: 'targets',
  version: 1,
  facts: { interactive: boxes.length, undersized: out.length },
  findings: cap(out, 25)
};

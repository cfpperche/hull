// WCAG 2.2 SC 1.4.3 / 1.4.11 — text and non-text contrast, measured.
//
// This is the one design defect a model should never be asked to eyeball: the
// answer is a ratio, the browser already knows every input to it, and a judge
// that guesses "looks a bit light" costs a round trip and is wrong at the edges.
// The panel gets the number; it spends its judgment on what the number means.

const out = [];
const seen = new Set();
let checked = 0;

for (const el of all()) {
  const t = ownText(el);
  if (!t) continue;
  checked++;
  const cs = getComputedStyle(el);
  const fg = parseColor(cs.color);
  if (!fg || fg.a === 0) continue;
  const bg = effectiveBg(el);
  if (!bg.color) continue; // painted over an image or gradient — not decidable here

  const size = parseFloat(cs.fontSize) || 16;
  const weight = parseInt(cs.fontWeight, 10) || 400;
  const large = size >= 24 || (size >= 18.66 && weight >= 700);
  const need = large ? 3.0 : 4.5;
  const ratio = contrast(over(fg, bg.color), bg.color);
  if (ratio >= need) continue;

  const key = `${hex(over(fg, bg.color))}|${hex(bg.color)}|${large}`;
  if (seen.has(key)) continue; // one row per colour pair, not per paragraph
  seen.add(key);

  out.push(finding('contrast.text', ratio < need - 1.5 ? 'blocker' : 'major', el,
    `text ${ratio.toFixed(2)}:1 against its background, needs ${need}:1`, {
      ratio: Math.round(ratio * 100) / 100,
      required: need,
      foreground: hex(over(fg, bg.color)),
      background: hex(bg.color),
      fontPx: size,
      fontWeight: weight,
      large,
      wcag: large ? '1.4.3 (large text)' : '1.4.3',
      sample: t.slice(0, 60)
    }));
}

// Non-text contrast: a control whose only boundary is a border that nobody can
// see is a control nobody can find. Inputs first — that is where it bites.
//
// One row per colour pair, like the text check above. A design system defines
// the input border once, so a settings page with seven fields produced seven
// identical rows on the first real app this met — seven times the noise for one
// token to change.
const controls = [];
const seenControls = new Map();
for (const el of all()) {
  if (!/^(input|select|textarea)$/i.test(el.tagName)) continue;
  const cs = getComputedStyle(el);
  const bw = parseFloat(cs.borderTopWidth) || 0;
  if (bw <= 0) continue;
  const bc = parseColor(cs.borderTopColor);
  const around = effectiveBg(el.parentElement || document.body);
  if (!bc || !around.color) continue;
  const ratio = contrast(over(bc, around.color), around.color);
  if (ratio >= 3.0) continue;
  const key = `${hex(over(bc, around.color))}|${hex(around.color)}`;
  if (seenControls.has(key)) { seenControls.get(key).instances++; continue; }
  const f = finding('contrast.nontext', 'major', el,
    `control boundary ${ratio.toFixed(2)}:1 against the surface, needs 3:1`, {
      ratio: Math.round(ratio * 100) / 100, required: 3.0, wcag: '1.4.11',
      border: hex(over(bc, around.color)), surface: hex(around.color), instances: 1
    });
  seenControls.set(key, f);
  controls.push(f);
}

return {
  sensor: 'contrast',
  version: 1,
  facts: {
    textPairsFailing: out.length,
    controlsFailing: controls.length,
    textElementsChecked: checked,
    // If this is not empty the sensor met a colour notation it cannot read, and
    // every element painted in it was skipped. Zero failures with a non-empty
    // list here means "not measured", not "fine".
    colorNotationsUnparsed: Array.from(__colorUnparsed)
  },
  findings: cap(out.sort((a, b) => a.ratio - b.ratio), 40).concat(cap(controls, 10))
};

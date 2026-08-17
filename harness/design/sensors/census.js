// Style census — what the page *actually* uses, counted.
//
// It emits facts, not verdicts. "Eleven type sizes" is a fact; whether eleven is
// too many is a budget, and budgets belong to the project profile, not to a
// sensor that will be copied into a project with different taste. Keeping that
// line clean is what lets this tree move between repos unchanged.

const els = all();
const families = [], sizes = [], weights = [], radii = [], shadows = [];
const spacing = [], textColors = [], bgColors = [], borderColors = [], zIndexes = [];
const gridStep = 4;

for (const el of els) {
  const cs = getComputedStyle(el);
  const t = ownText(el);

  if (t) {
    families.push((cs.fontFamily || '').split(',')[0].replace(/["']/g, '').trim());
    sizes.push(Math.round(parseFloat(cs.fontSize) || 0));
    weights.push(cs.fontWeight);
    const c = parseColor(cs.color);
    if (c && c.a > 0.05) textColors.push(hex(c));
  }

  const r = Math.max(
    parseFloat(cs.borderTopLeftRadius) || 0, parseFloat(cs.borderTopRightRadius) || 0,
    parseFloat(cs.borderBottomLeftRadius) || 0, parseFloat(cs.borderBottomRightRadius) || 0);
  if (r > 0) radii.push(Math.round(r));

  if (cs.boxShadow && cs.boxShadow !== 'none') shadows.push(cs.boxShadow.replace(/\s+/g, ' ').slice(0, 60));

  for (const p of ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
                   'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'gap', 'rowGap', 'columnGap']) {
    const v = parseFloat(cs[p]);
    if (v > 0 && Number.isFinite(v)) spacing.push(Math.round(v));
  }

  const bg = parseColor(cs.backgroundColor);
  if (bg && bg.a > 0.05) bgColors.push(hex(bg));
  const bw = parseFloat(cs.borderTopWidth) || 0;
  if (bw > 0) { const bc = parseColor(cs.borderTopColor); if (bc && bc.a > 0.05) borderColors.push(hex(bc)); }

  const z = parseInt(cs.zIndex, 10);
  if (Number.isFinite(z) && z !== 0) zIndexes.push(z);
}

const sizeTally = tally(sizes).filter(s => s.value > 0);
const spaceTally = tally(spacing);
const offGrid = spaceTally.filter(s => s.value % gridStep !== 0);
const palette = tally(textColors.concat(bgColors).concat(borderColors));

// The heading ladder as rendered, not as marked up: two headings at different
// levels rendering at the same px is a hierarchy that exists only in the HTML.
const ladder = [];
for (const h of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
  if (!visible(h)) continue;
  const cs = getComputedStyle(h);
  ladder.push({ tag: h.tagName.toLowerCase(), px: Math.round(parseFloat(cs.fontSize)), weight: cs.fontWeight, text: (h.textContent || '').trim().slice(0, 60) });
}
const collapsed = [];
for (let i = 0; i < ladder.length; i++) {
  for (let j = i + 1; j < ladder.length; j++) {
    if (ladder[i].tag !== ladder[j].tag && ladder[i].px === ladder[j].px && ladder[i].weight === ladder[j].weight) {
      collapsed.push(`${ladder[i].tag}/${ladder[j].tag} both ${ladder[i].px}px ${ladder[i].weight}`);
    }
  }
}

return {
  sensor: 'census',
  version: 1,
  facts: {
    elements: els.length,
    fontFamilies: tally(families.filter(Boolean)),
    typeScale: sizeTally,
    typeScaleCount: sizeTally.length,
    fontWeights: tally(weights),
    radii: tally(radii),
    radiiCount: tally(radii).length,
    shadows: cap(tally(shadows), 8),
    shadowCount: tally(shadows).length,
    spacing: cap(spaceTally, 20),
    spacingOffGrid: cap(offGrid, 10),
    spacingGrid: gridStep,
    palette: cap(palette, 24),
    paletteCount: palette.length,
    zIndexLayers: tally(zIndexes).length,
    headingLadder: ladder,
    headingCollapse: Array.from(new Set(collapsed))
  },
  findings: []
};

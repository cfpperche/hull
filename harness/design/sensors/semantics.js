// Structure a screenshot cannot show: names, labels, order, focus.
//
// Deliberately a *subset* of what axe-core rules cover. Where axe is available
// the harness runs it and this sensor's overlap is dropped; where it is not,
// these are the checks whose absence would make a visual review dishonest —
// a page can look immaculate and be unusable by keyboard, and the panel cannot
// see that in a PNG.

const out = [];

// images
for (const img of document.querySelectorAll('img')) {
  if (!visible(img)) continue;
  const alt = img.getAttribute('alt');
  const role = img.getAttribute('role');
  if (alt === null && role !== 'presentation' && role !== 'none' && img.getAttribute('aria-hidden') !== 'true') {
    out.push(finding('a11y.img-alt', 'major', img, 'image has no alt attribute', { wcag: '1.1.1', src: (img.currentSrc || img.src || '').slice(-80) }));
  }
}

// form controls
for (const el of document.querySelectorAll('input,select,textarea')) {
  if (!visible(el) || el.type === 'hidden') continue;
  const name = accName(el);
  const ph = el.getAttribute('placeholder');
  if (!name && !ph) {
    out.push(finding('a11y.control-name', 'blocker', el, `<${el.tagName.toLowerCase()}> has no accessible name`, { wcag: '4.1.2', type: el.type || '' }));
  } else if (!name && ph) {
    out.push(finding('a11y.placeholder-as-label', 'major', el, 'placeholder is the only label — it disappears on input', { wcag: '3.3.2', placeholder: ph.slice(0, 40) }));
  }
}

// buttons and links
for (const el of document.querySelectorAll('button,a[href],[role="button"],[role="link"]')) {
  if (!visible(el)) continue;
  if (!accName(el)) {
    out.push(finding('a11y.control-name', 'blocker', el, `<${el.tagName.toLowerCase()}> has no accessible name — a screen reader announces nothing`, { wcag: '4.1.2' }));
  }
}
for (const a of document.querySelectorAll('a[href]')) {
  if (!visible(a)) continue;
  const t = accName(a).toLowerCase();
  if (/^(click here|here|read more|more|link|learn more)$/.test(t)) {
    out.push(finding('a11y.link-text', 'minor', a, `link text "${t}" says nothing out of context`, { wcag: '2.4.4' }));
  }
}

// headings
const heads = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(visible);
const h1s = heads.filter(h => h.tagName === 'H1');
if (heads.length && h1s.length === 0) out.push(finding('a11y.heading-h1', 'major', heads[0], 'page has headings but no <h1>', { wcag: '1.3.1' }));
if (h1s.length > 1) out.push(finding('a11y.heading-h1', 'minor', h1s[1], `${h1s.length} <h1> elements on one page`, { wcag: '1.3.1' }));
let prev = 0;
for (const h of heads) {
  const lvl = parseInt(h.tagName[1], 10);
  if (prev && lvl > prev + 1) {
    out.push(finding('a11y.heading-order', 'minor', h, `heading jumps h${prev} → h${lvl}`, { wcag: '1.3.1' }));
  }
  prev = lvl;
}

// document
if (!document.documentElement.getAttribute('lang')) {
  out.push(finding('a11y.html-lang', 'major', document.documentElement, '<html> has no lang attribute', { wcag: '3.1.1' }));
}
if (!(document.title || '').trim()) {
  out.push(finding('a11y.title', 'major', document.documentElement, 'document has no <title>', { wcag: '2.4.2' }));
}
const vp = document.querySelector('meta[name="viewport"]');
if (vp && /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/.test(vp.getAttribute('content') || '')) {
  out.push(finding('a11y.zoom-blocked', 'major', document.documentElement, 'viewport meta blocks pinch zoom', { wcag: '1.4.4', content: vp.getAttribute('content') }));
}

// duplicate ids — breaks label[for], aria-labelledby and anchors alike.
// `__dq_` is this harness's own furniture; a sensor that reports the instrument
// it was measured with wastes the reader's first minute on a ghost.
const ids = new Map();
for (const el of document.querySelectorAll('[id]')) {
  if (el.id.startsWith('__dq_')) continue;
  ids.set(el.id, (ids.get(el.id) || 0) + 1);
}
for (const [id, n] of ids) if (n > 1) out.push(finding('a11y.duplicate-id', 'minor', document.getElementById(id), `id "${id}" appears ${n} times`, { wcag: '4.1.1' }));

// focus
let focusVisibleRule = false;
for (const sheet of Array.from(document.styleSheets)) {
  try {
    for (const rule of Array.from(sheet.cssRules || [])) {
      if (rule.selectorText && rule.selectorText.includes(':focus-visible')) { focusVisibleRule = true; break; }
    }
  } catch (e) { /* cross-origin sheet: unreadable, not absent */ }
  if (focusVisibleRule) break;
}
const suppressed = [];
for (const el of document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')) {
  if (!visible(el)) continue;
  const cs = getComputedStyle(el);
  const none = cs.outlineStyle === 'none' || parseFloat(cs.outlineWidth) === 0;
  if (none) suppressed.push(el);
}
if (suppressed.length && !focusVisibleRule) {
  out.push(finding('a11y.focus-invisible', 'blocker', suppressed[0],
    `${suppressed.length} focusable elements remove the outline and no :focus-visible rule was found — keyboard navigation is invisible`,
    { wcag: '2.4.7', count: suppressed.length }));
}
for (const el of document.querySelectorAll('[tabindex]')) {
  const t = parseInt(el.getAttribute('tabindex'), 10);
  if (t > 0) out.push(finding('a11y.tabindex-positive', 'minor', el, `tabindex="${t}" reorders the tab sequence away from the visual order`, { wcag: '2.4.3' }));
}

// landmarks
const landmarks = {
  main: document.querySelectorAll('main,[role="main"]').length,
  nav: document.querySelectorAll('nav,[role="navigation"]').length,
  header: document.querySelectorAll('header,[role="banner"]').length
};
if (!landmarks.main) out.push(finding('a11y.landmark-main', 'minor', document.body, 'no <main> landmark — skip-to-content has nowhere to go', { wcag: '1.3.1' }));

// live regions — the DOM side of "every write must confirm"
const live = document.querySelectorAll('[aria-live],[role="status"],[role="alert"],[data-sonner-toaster],.toaster,#toast,[data-toaster]').length;

return {
  sensor: 'semantics',
  version: 1,
  facts: {
    headings: heads.length,
    landmarks,
    liveRegions: live,
    focusVisibleRule,
    focusSuppressed: suppressed.length,
    forms: document.querySelectorAll('form').length,
    buttons: document.querySelectorAll('button,[role="button"]').length
  },
  findings: cap(out, 40)
};

// What the browser measured while this page loaded.
//
// Lab numbers, and labelled as such: CLS and LCP here are one cold load on one
// machine, not the 75th percentile of real users, and INP cannot be measured
// without a real interaction at all. They are in the harness because layout
// shift and a 4MB hero are *design* defects that a still screenshot hides — the
// PNG shows the page after everything settled, which is the one moment the user
// never sees.
//
// Requires the observers to have been armed before load (`design capture` does
// that) or falls back to buffered entries, which Chrome keeps for both types.

function buffered(type) {
  try {
    const list = performance.getEntriesByType(type);
    if (list && list.length) return list;
  } catch (e) { /* unsupported type */ }
  return (window.__dqPerf && window.__dqPerf[type]) || [];
}

const shifts = buffered('layout-shift').filter(e => !e.hadRecentInput);
const cls = shifts.reduce((s, e) => s + e.value, 0);
const lcpEntries = buffered('largest-contentful-paint');
const lcp = lcpEntries.length ? lcpEntries[lcpEntries.length - 1] : null;
const longTasks = buffered('longtask');
const nav = performance.getEntriesByType('navigation')[0] || null;

// 401 and 403 are not failures here. A signed-out app asking "is anyone signed
// in?" answers 401 by design, and reporting that as "something on this page is
// drawn from a hole" is a false positive on every auth-aware frontend — the
// first real app this ran against produced four of them. 404 and 5xx stay:
// those are a request nobody meant to make, or one that broke.
const resources = performance.getEntriesByType('resource');
const statuses = resources.filter(r => typeof r.responseStatus === 'number' && r.responseStatus >= 400);
const expected = statuses.filter(r => r.responseStatus === 401 || r.responseStatus === 403);
const failed = statuses.filter(r => r.responseStatus !== 401 && r.responseStatus !== 403)
  .map(r => ({ url: r.name.slice(-100), status: r.responseStatus, type: r.initiatorType }));

const byType = {};
let total = 0;
for (const r of resources) {
  const t = r.initiatorType || 'other';
  const size = r.transferSize || 0;
  byType[t] = (byType[t] || 0) + size;
  total += size;
}

const out = [];
if (cls > 0.1) {
  out.push({
    rule: 'perf.layout-shift', severity: cls > 0.25 ? 'major' : 'minor', selector: '', box: null, text: '',
    message: `cumulative layout shift ${cls.toFixed(3)} on a cold load (good is ≤0.1) — the page moves under the pointer`,
    cls: Math.round(cls * 1000) / 1000,
    worst: shifts.sort((a, b) => b.value - a.value).slice(0, 3).map(e => ({
      value: Math.round(e.value * 1000) / 1000,
      sources: (e.sources || []).slice(0, 2).map(s => s.node ? sel(s.node) : '')
    }))
  });
}
if (failed.length) {
  out.push({
    rule: 'perf.failed-request', severity: 'major', selector: '', box: null, text: '',
    message: `${failed.length} sub-resource requests returned 4xx/5xx — something on this page is drawn from a hole`,
    failed: cap(failed, 8)
  });
}
const imgWeight = byType.img || 0;
if (imgWeight > 1_500_000) {
  out.push({
    rule: 'perf.image-weight', severity: 'minor', selector: '', box: null, text: '',
    message: `${(imgWeight / 1e6).toFixed(1)}MB of images on one view`,
    bytes: imgWeight
  });
}

return {
  sensor: 'runtime',
  version: 1,
  facts: {
    cls: Math.round(cls * 1000) / 1000,
    lcpMs: lcp ? Math.round(lcp.startTime) : null,
    lcpElement: lcp && lcp.element ? sel(lcp.element) : null,
    longTasks: longTasks.length,
    domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
    loadMs: nav ? Math.round(nav.loadEventEnd) : null,
    transferBytes: total,
    transferByType: byType,
    requests: resources.length,
    authProbes: expected.length,
    domNodes: document.getElementsByTagName('*').length,
    note: 'lab numbers from one cold load; INP is a field metric and is not measured here'
  },
  findings: out
};

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = Array(b.length + 1);
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] = b[i - 1] === a[j - 1]
        ? m[i - 1][j - 1]
        : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    }
  }
  return m[b.length][a.length];
}

function scoreMatch(query, candidate) {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q || !c) return { score: 0, level: 'none' };
  if (q === c) return { score: 1, level: 'high' };
  if (c.includes(q) || q.includes(c)) {
    const ratio = Math.min(q.length, c.length) / Math.max(q.length, c.length);
    return ratio >= 0.6
      ? { score: 0.9, level: 'high' }
      : { score: 0.7, level: 'medium' };
  }
  const dist = levenshtein(q, c);
  const sim = 1 - dist / Math.max(q.length, c.length);
  if (sim >= 0.85) return { score: sim, level: 'high' };
  if (sim >= 0.65) return { score: sim, level: 'medium' };
  if (sim >= 0.45) return { score: sim, level: 'low' };
  return { score: sim, level: 'none' };
}

function parseDate(input) {
  if (input == null || input === '') return null;
  const s = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d)) return d;
  }
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const d = new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`);
    if (!isNaN(d)) return d;
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

module.exports = { normalize, levenshtein, scoreMatch, parseDate };

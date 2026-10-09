// Beyond skill keywords: the explicit asks recruiters make in a posting.

export function yearsRequired(text) {
  const nums = [];
  for (const m of text.matchAll(/(\d{1,2})\s*\+?\s*(?:-|to|–)?\s*(\d{1,2})?\s*\+?\s*years?(?:'|’)?\s*(?:of\s+)?(?:\w+\s+){0,4}?experience/gi)) {
    const n = Number(m[1]);
    if (n > 0 && n <= 20) nums.push(n);
  }
  return nums.length ? Math.min(...nums) : null;
}

export function degreeSignal(text) {
  if (/(?:bachelor|b\.?s\.?|master|m\.?s\.?|ph\.?d)[^.\n]{0,60}(?:or equivalent|equivalent (?:practical )?experience)/i.test(text)) return 'or-equivalent';
  if (/no (?:formal )?degree (?:required|necessary)|degree (?:is )?not required/i.test(text)) return 'not-required';
  if (/\bph\.?d\b[^.\n]{0,40}(?:required|preferred|degree)|(?:required|preferred)[^.\n]{0,40}\bph\.?d\b/i.test(text)) return 'phd';
  if (/(?:bachelor|master)['’]?s? (?:degree )?(?:in|of)|\bB\.?S\.?\/M\.?S\.?|computer science (?:degree|or)/i.test(text)) return 'degree';
  return 'unspecified';
}

export function sponsorship(text) {
  if (/(?:will not|unable to|cannot|can't|do(?:es)? not) (?:provide |offer )?(?:visa )?sponsor/i.test(text)) return 'no';
  if (/visa sponsorship (?:is )?(?:available|provided|offered)|(?:we|will) sponsor (?:visas?|work)|sponsorship (?:is )?available|relocation/i.test(text)) return 'yes';
  return 'unspecified';
}

const CURRENCY_TO_USD = { USD: 1, $: 1, CAD: 0.73, GBP: 1.27, '£': 1.27, EUR: 1.08, '€': 1.08 };

export function salaryRange(text) {
  const re = /(?:(USD|CAD|GBP|EUR)\s*)?([$£€])?\s?(\d{2,3}(?:,\d{3})+|\d{2,3}\s?[kK])\s*(?:-|–|—|to)\s*(?:(USD|CAD|GBP|EUR)\s*)?([$£€])?\s?(\d{2,3}(?:,\d{3})+|\d{2,3}\s?[kK])/g;
  for (const m of text.matchAll(re)) {
    const toNum = (s) => (/k$/i.test(s) ? parseInt(s, 10) * 1000 : parseInt(s.replace(/,/g, ''), 10));
    const cur = m[1] || m[4] || m[2] || m[5] || '$';
    const rate = CURRENCY_TO_USD[cur] ?? 1;
    const lo = toNum(m[3]) * rate, hi = toNum(m[6]) * rate;
    if (lo >= 40000 && hi <= 1000000 && hi >= lo) return { min: Math.round(lo), max: Math.round(hi), currency: 'USD' };
  }
  return null;
}

// Pull the sentences where an employer states a want, so the dashboard can quote real language.
const ASK = /^(?:-\s*)?(?:you (?:have|are|will|bring|'ve)|experience (?:with|in|building|designing|shipping)|proficien(?:t|cy)|strong (?:\w+ ){0,3}(?:skills|background|experience|understanding)|familiar(?:ity)? with|hands-on|ability to|track record|demonstrated|comfortable|deep (?:\w+ )?(?:knowledge|understanding|expertise))/i;

export function askSentences(text, max = 4) {
  return text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 30 && l.length < 220 && ASK.test(l))
    .slice(0, max);
}

// Decide whether a posting is a target role and which track it belongs to.
// Tracks mirror the three audiences this dashboard serves.
export const TRACKS = ['ai', 'ml', 'software'];

const EXCLUDE = /\b(sales|account (executive|manager)|recruit|talent|marketing|counsel|legal|finance|accountant|payroll|customer success|support specialist|solutions? (consultant|architect)|technical writer|designer|product manager|program manager|people partner|operations manager|enablement|office|facilities|intern(ship)?\b.*(marketing|sales))\b/i;

const AI_TITLE = /\b(ai|a\.i\.|llm|genai|generative|prompt|agent(s|ic)?|applied ai|foundation model|nlp|conversational)\b/i;
const ML_TITLE = /\b(machine learning|ml|deep learning|data scien(ce|tist)|research (engineer|scientist)|computer vision|mlops|recommendation|ranking|perception|reinforcement)\b/i;
const SWE_TITLE = /\b(software|engineer|developer|sde|swe|backend|back-end|frontend|front-end|full[- ]?stack|platform|infrastructure|devops|sre|site reliability|security engineer|mobile|ios|android|firmware|embedded|systems|data engineer|staff|principal)\b/i;

export function classifyTitle(title = '') {
  if (!title || EXCLUDE.test(title)) return null;
  const isEng = SWE_TITLE.test(title) || ML_TITLE.test(title) || AI_TITLE.test(title);
  if (!isEng) return null;
  if (AI_TITLE.test(title)) return 'ai';
  if (ML_TITLE.test(title)) return 'ml';
  // "engineer" alone is too vague unless the title is clearly technical.
  if (/\bengineer\b/i.test(title) && /\b(mechanical|electrical|civil|manufacturing|hardware|test equipment|field|sales engineer|support engineer|solutions engineer|customer engineer|forward deployed)\b/i.test(title)) {
    return /forward deployed/i.test(title) ? 'ai' : null;
  }
  return 'software';
}

export function seniorityOf(title = '') {
  const t = title.toLowerCase();
  if (/\b(intern|internship|co-?op)\b/.test(t)) return 'intern';
  if (/\b(new grad|graduate|entry|junior|jr\.?|associate|early career)\b/.test(t)) return 'junior';
  if (/\b(principal|distinguished|fellow)\b/.test(t)) return 'principal';
  if (/\b(staff)\b/.test(t)) return 'staff';
  if (/\b(senior|sr\.?|lead)\b/.test(t)) return 'senior';
  if (/\b(manager|director|head of|vp)\b/.test(t)) return 'management';
  return 'mid';
}

export function workModeOf(location = '', text = '') {
  const l = `${location}`.toLowerCase();
  if (/\bhybrid\b/.test(l) || /\bhybrid\b/i.test(text.slice(0, 1500))) return /\bremote\b/.test(l) ? 'remote' : 'hybrid';
  if (/\bremote\b|\banywhere\b|distributed/.test(l)) return 'remote';
  if (/remote[- ]first|fully remote|100% remote|work from anywhere/i.test(text)) return 'remote';
  return 'onsite';
}

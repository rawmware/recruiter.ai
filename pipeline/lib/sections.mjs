// Split a posting into "required" vs "preferred" text so we can tell a hard ask from a nice-to-have.
const PREFERRED = /^(?:[-*•]\s*)?(?:nice[- ]to[- ]haves?|preferred(?: qualifications| skills| experience)?|bonus(?: points)?|great to have|extra credit|it(?:'|’)s a plus|pluses|ideal(?:ly)?|strong candidates may also)\b/i;
const REQUIRED = /^(?:[-*•]\s*)?(?:requirements?|qualifications|minimum qualifications|basic qualifications|required (?:skills|qualifications|experience)|must[- ]haves?|what you(?:'|’)?ll need|what we(?:'|’)?re looking for|what you bring|you have|you(?:'|’)?ll have|who you are|about you|skills (?:and|&) experience|key qualifications)\b/i;
const OTHER = /^(?:[-*•]\s*)?(?:responsibilities|what you(?:'|’)?ll do|the role|about (?:the|this) (?:role|team|job)|about us|benefits|perks|compensation|how we work|why join|our (?:mission|values|culture)|equal opportunity|what we offer)\b/i;

function isHeading(line) {
  return line.length > 2 && line.length < 90 && !/[.;]$/.test(line.trim());
}

export function splitSections(text) {
  const out = { required: [], preferred: [], other: [] };
  let mode = 'other';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (isHeading(line) && !line.startsWith('-')) {
      if (PREFERRED.test(line)) { mode = 'preferred'; continue; }
      if (REQUIRED.test(line)) { mode = 'required'; continue; }
      if (OTHER.test(line)) { mode = 'other'; continue; }
    }
    // Inline qualifiers like "Bonus: experience with Rust" flip just that line.
    if (PREFERRED.test(line) && line.length > 40) { out.preferred.push(line); continue; }
    out[mode].push(line);
  }
  return { required: out.required.join('\n'), preferred: out.preferred.join('\n'), other: out.other.join('\n') };
}

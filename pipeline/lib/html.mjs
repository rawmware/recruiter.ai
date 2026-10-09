// Dependency-free HTML -> text for job descriptions.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', ndash: '-', mdash: '-', hellip: '...' };

export function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

export function htmlToText(html = '') {
  // Greenhouse double-encodes its content; decode once before stripping tags.
  const decoded = /&lt;\/?[a-z]/i.test(html) ? decodeEntities(html) : html;
  return decodeEntities(
    decoded
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t\f\v\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

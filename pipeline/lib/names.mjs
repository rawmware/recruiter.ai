// Board slugs are not display names; map the known ones and title-case the rest.
const KNOWN = {
  shieldai: 'Shield AI', palantir: 'Palantir', ro: 'Ro', weride: 'WeRide', outreach: 'Outreach', zoox: 'Zoox', binance: 'Binance',
  spotify: 'Spotify', xai: 'xAI', togetherai: 'Together AI', c3iot: 'C3 AI', scaleai: 'Scale AI', lucidmotors: 'Lucid Motors',
};

export function prettyCompany(slug = '') {
  if (KNOWN[slug]) return KNOWN[slug];
  return slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

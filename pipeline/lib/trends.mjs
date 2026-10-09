// Compare today's skill demand with an earlier snapshot to find what is rising or fading.
export function movers(todayAgg, pastAgg, { minCount = 5, limit = 8 } = {}) {
  if (!pastAgg) return { rising: [], falling: [], baseline: null };
  const out = {};
  for (const track of Object.keys(todayAgg.tracks)) {
    const past = new Map((pastAgg.tracks?.[track]?.skills ?? []).map((s) => [s.name, s.share]));
    const rows = todayAgg.tracks[track].skills
      .filter((s) => s.count >= minCount)
      .map((s) => ({ name: s.name, share: s.share, delta: +(s.share - (past.get(s.name) ?? 0)).toFixed(4) }));
    out[track] = {
      rising: rows.filter((r) => r.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, limit),
      falling: rows.filter((r) => r.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, limit),
    };
  }
  return out;
}

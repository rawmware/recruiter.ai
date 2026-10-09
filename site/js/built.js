import { $, h, clear, timeAgo } from './util.js';

const FLOW = ['Public job boards', 'fetch + normalize', 'classify track', 'extract skills & asks', 'aggregate + trends', 'dated JSON snapshot', 'git commit', 'this page'];

export function renderBuilt({ latest, buildlog }) {
  const box = clear($('#built-body'));
  box.append(
    h('p', {}, 'recruiter.ai is a small pipeline plus a static page. Nothing here is hand-written or hand-updated: a scheduled GitHub Action runs the pipeline every day, commits the new snapshot, redeploys the page and rebuilds the log below from the real git history.'),
    h('div', { class: 'flow' }, FLOW.flatMap((t, i) => [h('span', { class: 'node' }, t), i < FLOW.length - 1 ? h('span', { class: 'arrow' }, '→') : null])),
    h('h3', {}, 'Method'),
    h('ul', {}, [
      'Sources are public APIs only: Greenhouse and Lever company boards, Remotive, and the monthly Hacker News “Who is hiring” thread. No logins, no scraping behind walls.',
      'A title classifier keeps software, AI and ML engineering roles and drops sales, recruiting, design and similar. Titles with LLM/agent language go to the AI track, ML/data-science titles to ML.',
      'Skills come from a regex taxonomy (see pipeline/taxonomy). It is transparent and testable, but it counts mentions, not importance: “nice to have” and “required” look the same.',
      'Ask lines are real sentences from postings that begin like a requirement (“Experience with…”, “Strong background in…”). Nothing is paraphrased or generated.',
      'Movers compare today’s skill share against a snapshot up to a week old. Early days have little or no baseline.',
    ].map((t) => h('li', {}, t))),
    h('h3', {}, 'Known limits'),
    h('ul', {}, [
      'It sees companies that use the listed boards, so it skews toward tech-forward employers. It is a sample of the market, not the market.',
      'A posting is a snapshot of what a company published, not proof it is actively hiring or that the role is open to you.',
      'Pay ranges are only parsed when written as a range in the posting text.',
    ].map((t) => h('li', {}, t))),
  );

  if (latest.sources) {
    const failed = latest.sources.filter((s) => !s.ok);
    const empty = latest.sources.filter((s) => s.ok && !s.fetched);
    box.append(h('h3', {}, 'Latest run health'), h('p', { class: 'muted' },
      `${latest.sources.length} sources · ${latest.sources.filter((s) => s.ok).length} responded · ${failed.length} failed${failed.length ? ` (${failed.map((f) => f.source).join(', ')})` : ''}${empty.length ? ` · ${empty.length} returned no postings` : ''}.`));
  }

  if (buildlog) {
    box.append(
      h('h3', {}, `Build log — ${buildlog.commitCount} commits`),
      h('p', { class: 'muted' }, `Generated ${timeAgo(buildlog.generatedAt)} from git history. ${buildlog.daily ?? 0} of these are automatic daily data commits.`),
      h('div', { class: 'log' }, buildlog.commits.map((c) => h('div', {}, h('span', { class: 'h' }, c.hash), h('span', { class: 't' }, c.date), h('span', {}, c.subject)))),
    );
    if (buildlog.reviews?.length) {
      box.append(h('h3', {}, 'Code reviews'), h('ul', {}, buildlog.reviews.map((r) => h('li', {}, h('a', { href: `https://github.com/rawmware/recruiter.ai/blob/main/${r.file}` }, r.title)))));
    }
  } else {
    box.append(h('p', { class: 'muted' }, 'Build log not generated yet.'));
  }
}

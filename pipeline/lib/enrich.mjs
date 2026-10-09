import { classifyTitle, seniorityOf, workModeOf } from './classify.mjs';
import { extractSkills } from './taxonomy.mjs';
import { yearsRequired, degreeSignal, sponsorship, salaryRange, askSentences } from './signals.mjs';

// Turn a raw normalized posting into the compact record the dashboard uses.
// Returns null when the posting is not one of our target roles.
export function enrich(job, { today, previous = new Map() } = {}) {
  const track = classifyTitle(job.title);
  if (!track) return null;
  const text = `${job.title}\n${job.text}`;
  const prev = previous.get(job.id);
  return {
    id: job.id,
    source: job.source,
    company: job.company,
    title: job.title,
    track,
    location: job.location,
    url: job.url,
    seniority: seniorityOf(job.title),
    workMode: workModeOf(job.location, job.text),
    skills: extractSkills(text),
    years: yearsRequired(job.text),
    degree: degreeSignal(job.text),
    sponsorship: sponsorship(job.text),
    salary: salaryRange(job.text),
    asks: askSentences(job.text),
    postedAt: job.postedAt,
    firstSeen: prev?.firstSeen ?? today,
  };
}

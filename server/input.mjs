import { z } from 'zod';
import { validateJobUrl } from './research.mjs';
export const RunInput = z.object({
  goal: z.string().trim().min(12).max(1200),
  projectCount: z.number().int().min(1).max(3).default(2),
  sources: z.array(z.enum(['greenhouse', 'remotive', 'lever'])).max(3).default(['greenhouse', 'lever']),
  jobUrls: z.array(z.string().max(2000)).max(5).default([]),
}).superRefine((v, ctx) => {
  if (!v.sources.length && !v.jobUrls.length) ctx.addIssue({ code: 'custom', message: 'Choose a job source or add a job URL.' });
  for (const url of v.jobUrls) { try { validateJobUrl(url); } catch (e) { ctx.addIssue({ code: 'custom', message: e.message }); } }
});

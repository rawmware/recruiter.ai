// Small fetch wrapper: timeout, retry with backoff, JSON parsing, polite UA.
const UA = 'recruiter.ai-bot (+https://github.com/rawmware/recruiter.ai)';

export async function getJson(url, { retries = 2, timeoutMs = 45000, fetchImpl = fetch } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchImpl(url, {
        headers: { 'user-agent': UA, accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 404) return null; // board does not exist (anymore)
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 750 * 2 ** attempt));
    }
  }
  throw lastError;
}

import { load } from 'cheerio';
import vm from 'node:vm';
import { chromium } from 'playwright';

export const APP_FILES = ['index.html', 'styles.css', 'app.js'];
export const PREVIEW_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts allow-downloads";
export function validateFiles(files) {
  if (files.length !== 3 || new Set(files.map(f => f.path)).size !== 3 || files.some(f => !APP_FILES.includes(f.path))) throw new Error('Return exactly index.html, styles.css, and app.js.');
  if (files.some(f => !f.content.trim() || f.content.length > 180000)) throw new Error('Missing or oversized application file.');
  const html = files.find(f => f.path === 'index.html').content;
  if (!/<html[\s>]/i.test(html) || !/<body[\s>]/i.test(html)) throw new Error('A complete HTML document is required.');
  const $ = load(html);
  if ($('script').toArray().some(el => $(el).attr('src') && $(el).attr('src') !== 'app.js')) throw new Error('External scripts are not supported.');
  new vm.Script(files.find(f => f.path === 'app.js').content, { filename: 'app.js' });
  return true;
}
export function bundle(files) {
  const get = name => files.find(f => f.path === name)?.content || '';
  const $ = load(get('index.html'));
  $('script, link[rel="stylesheet"], base, meta[http-equiv]').remove();
  $('head').append(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; base-uri 'none'; form-action 'none'">`);
  $('head').append(`<style>${get('styles.css').replace(/<\/style/gi, '<\\/style')}</style>`);
  $('body').append(`<script>${get('app.js').replace(/<\/script/gi, '<\\/script')}</script>`);
  return $.html();
}
export async function testApplication(files, checks, signal) {
  validateFiles(files);
  if (!checks.length) throw new Error('An application needs at least one acceptance test.');
  const browser = await chromium.launch({ headless: true });
  const results = []; const errors = [];
  const abort = () => { void browser.close().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => route.abort());
    await page.setContent('<iframe title="Application under test" sandbox="allow-scripts allow-downloads" style="width:100%;height:760px;border:0"></iframe>');
    const html = bundle(files);
    await page.locator('iframe').evaluate((el, content) => { el.srcdoc = content; }, html);
    const frame = page.frameLocator('iframe');
    await frame.locator('body').waitFor();
    await frame.locator('body').innerText();
    for (const check of checks) {
      signal?.throwIfAborted();
      try {
        for (const step of check.steps) {
          const target = frame.locator(step.selector).first();
          if (step.action === 'click') await target.click({ timeout: 3000 });
          else if (step.action === 'fill') await target.fill(step.value, { timeout: 3000 });
          else if (step.action === 'select') await target.selectOption(step.value, { timeout: 3000 });
          else if (step.action === 'visible') await target.waitFor({ state: 'visible', timeout: 3000 });
          else if (step.action === 'text') {
            const actual = await target.innerText({ timeout: 3000 });
            if (!actual.toLowerCase().includes(step.value.toLowerCase())) throw new Error(`Expected ${step.selector} to contain ${JSON.stringify(step.value)}; got ${actual.slice(0, 160)}`);
          }
        }
        results.push({ name: check.name, passed: true });
      } catch (e) { results.push({ name: check.name, passed: false, detail: e.message.split('\n')[0] }); }
    }
    await page.locator('iframe').evaluate(el => { el.style.width = '390px'; });
    const fits = await frame.locator('body').evaluate(el => el.scrollWidth <= 410);
    results.push({ name: 'Usable at mobile width', passed: fits, ...(!fits ? { detail: 'Horizontal overflow at 390px' } : {}) });
    results.push({ name: 'No browser runtime errors', passed: errors.length === 0, ...(errors.length ? { detail: errors.join('; ').slice(0, 700) } : {}) });
    return { passed: results.every(r => r.passed), results };
  } finally { signal?.removeEventListener('abort', abort); await browser.close(); }
}

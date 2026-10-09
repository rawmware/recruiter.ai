# recruiter.ai

Day 4 of **365 Days of Showing Up**, by Roman Cottonham.

Five real agents turn public job postings into working browser applications. The dashboard shows task handoffs, source evidence, Markdown briefs, generated code, browser tests, and supervisor reports.

## The team

1. **Boss:** assigns the mission, reviews research and project briefs, accepts builds or orders revisions.
2. **Researcher:** reads public Greenhouse, Lever, and Remotive postings and supported job links. Extracts employer preferences and desired outcomes, rather than degrees or experience thresholds. Every evidence quote comes directly from a retrieved excerpt; inferred outcomes are labeled.
3. **Architect:** writes one Markdown brief per project, including concrete acceptance tests and evidence links.
4. **Builder:** implements every brief as HTML, CSS, and JavaScript; runs the acceptance tests in Chromium; repairs failures up to twice.
5. **Supervisor:** checks workers approximately every 30 seconds during a mission and reports to the boss. Escalations are reviewed at handoff boundaries. It also produces a final report.

All five agents use `gpt-5-nano`, the lightweight model requested for this project. The runtime uses the OpenAI Agents SDK with structured outputs; the application owns orchestration and narrow tools.

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npx playwright install chromium
```

Copy `.env.example` to `.env.local`, set `OPENAI_API_KEY` on the server, and run:

```sh
npm run dev
```

Open http://127.0.0.1:4310. Launch a mission, choose 1–3 apps, and watch the team. Run state and generated files persist under ignored `data/runs/`. Restarted work is labeled interrupted rather than silently resumed or falsely completed. Local runs stream events over SSE.

```sh
npm test
npm run verify
npm run build
npm start
```

`verify` tests desktop/mobile dashboard controls and a generated preview when available. Each agent-built app is separately tested using the architect's browser acceptance checks. Model-written tests are useful evidence, not exhaustive quality assurance.

## Hosted on RawmWare

Live dashboard: https://rawmware.com/365-days/projects/day-004

The static dashboard and dependency-free `api/recruiter.js` handler deploy to the existing RawmWare website. The agents run in this repository's **Run recruiter.ai mission** GitHub Actions workflow, so they continue when the browser closes. Configure `OPENAI_API_KEY` as an encrypted repository Actions secret. No OpenAI key goes into the website bundle or public run state.

The workflow publishes the actual run snapshot and artifacts to the `live` branch roughly every 15 seconds. The public dashboard polls every five seconds; completed outputs remain accessible after the runner stops. Local delivery is streamed; hosted delivery is periodic live snapshots, not token-level streaming. The workflow preserves full local evidence as an Actions artifact for 14 days.

### Start a hosted mission

- Use **Launch a mission** → **Run on GitHub**. GitHub authenticates the owner. Paste the mission JSON into the workflow's `mission` input, or leave it blank for the default two-app mission.
- Alternatively, owner controls accept a GitHub token with access to this repository and Actions write permission. It stays in this tab's session storage, is sent only to the same-origin handler and GitHub, and is never stored on the server. The handler verifies repository write access before dispatching or cancelling. Lock controls to remove it.
- Public visitors can inspect progress and use apps without credentials. They cannot initiate paid runs anonymously.

The workflow permits one mission at a time and has a 25-minute timeout. Each mission is limited to three projects, three build attempts per project, and 38 agent invocations. Model calls and worker time may incur provider costs. Generated applications are intentionally self-contained browser tools; the builder does not provision databases, authentication, or external services.

### Site build

Set `VITE_HOSTED=true` when running `npm run build`. Copy `dist/index.html` to the site's `dist/365-days/projects/day-004.html`, the assets into `dist/365-days/projects/day-004/assets/`, and `api/recruiter.js` into its `api/` directory. Do not copy any `.env` file, private hosting source, or local history into this public repository.

## Boundaries

- Indeed and other supplied links require readable JobPosting JSON-LD. Access restrictions and missing data are reported; no CAPTCHA bypass or fabricated postings.
- Evidence is a snapshot of what a job board returned at retrieval time; it cannot guarantee the employer is still hiring later.
- Preference classification is model judgment. Inferences are shown separately from explicit preferences, with original excerpts for inspection.
- Generated files are restricted to `index.html`, `styles.css`, and `app.js`. They never execute on the server. Preview CSP and iframe sandbox block network requests, same-origin privileges, forms, and top-level navigation. JavaScript state is held in memory; reload resets it.
- Playwright tests run in an isolated opaque-origin iframe with network blocked, not in the dashboard's origin.
- Structured output, source excerpt validation, file validation, runtime checks, and bounded repair loops prevent the system from marking arbitrary incomplete work as ready.
- The `live` branch contains public-safe research excerpts and generated artifacts. Do not place private information in a mission.

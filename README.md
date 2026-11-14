# Job Finder and Resume Builder

A Chrome extension with a small scheduled backend.

**Module 1: Jobs.** Three tabs in the side panel:

| Tab | What it shows | Filters |
|---|---|---|
| Universities | University and research-institute roles | US, Singapore, EMEA |
| India industry | Company roles in India | Agritech, Biotech, Pharma |
| Saved | Shortlisted and applied listings, plus jobs saved from any page she had open (LinkedIn, Indeed, company career pages) | Shortlisted, Applied |

**Module 2: Resume builder.** Pick a listing, choose "Tailor resume", and three Claude agents run in sequence:

1. **Analyst** reads the listing and extracts must-haves, keywords and what the application asks for.
2. **Tailor** rewrites the master resume for that job (academic CV style for universities, two-page resume style for industry), optionally with a cover letter. It may reword and reorder, never add facts.
3. **Reviewer** checks every claim in the tailored version against the master resume and flags anything it cannot find, along with gaps and a fit score.

A fourth agent, **Profile**, reads the master resume once and sets the search keywords.

Output: print or save as PDF, download a Word file, or copy as Markdown.

## Where listings come from

Only sources that permit automated access:

| Source | Covers | Needs |
|---|---|---|
| [Adzuna API](https://developer.adzuna.com) (licensed aggregator) | US, Singapore, UK, Germany, Netherlands, Switzerland, France, India | Free app ID and key |
| [HigherEdJobs RSS feeds](https://www.higheredjobs.com/rss/) | US universities | Nothing |
| Workday career sites (NUS, NTU by default) | Singapore universities | Nothing |
| Greenhouse and Lever job-board APIs | Any company that uses them; add board slugs in Settings | Nothing |
| Extra RSS feeds | Anything with a feed; add in Settings | Nothing |

LinkedIn and Indeed forbid automated scraping, so the extension never fetches them itself. When she has a job open on either site (or anywhere else), "Save job from this page" or right-click > "Save this job to Job Finder" reads that one page in her own browser and adds it to Saved, ready for tailoring.

## Install the extension

`extension/dist` is committed, so no build is needed.

1. Open `chrome://extensions`, turn on Developer mode.
2. "Load unpacked" and pick the `extension` folder.
3. Click the extension icon to open the side panel.
4. **Resume builder** tab: paste the resume, "Save resume".
5. **Settings** tab: add the Anthropic API key ([console.anthropic.com](https://console.anthropic.com)) and the Adzuna ID and key, then save.
6. Back in **Resume builder**: "Set search keywords from resume".
7. **Jobs** tab: "Refresh listings".

Keys and the resume are stored in the browser's local extension storage on her machine. The resume and a job listing are sent to the Claude API only when she builds a tailored resume or sets keywords from the resume.

## Run the backend (optional)

Without a backend the extension collects listings itself every 12 hours while Chrome is open. The backend does it on a schedule regardless, keeps history, and can email a digest of new listings.

```bash
npm install
```

```bash
cp .env.example .env
```

Fill in `.env` (Adzuna keys; SMTP settings for the digest), then:

```bash
npm start
```

In the extension's Settings set the backend URL (`http://localhost:8787` locally) and save. The extension then pushes its search settings to the backend and reads listings from it. For a hosted backend, set `API_TOKEN` and enter the same token in Settings. `npm run collect` runs one collection and exits, for use from cron.

| Endpoint | Purpose |
|---|---|
| `GET /api/jobs` | Stored listings and last-run report |
| `POST /api/collect` | Start a collection now |
| `GET/PUT /api/config` | Search profile and sources |
| `GET /api/health` | Liveness |

## Development

```bash
npm test
```

```bash
npm run e2e
```

`npm test` covers the collectors, classification, scoring, store merge and rendering against fixtures. `npm run e2e` rebuilds the extension, loads it in Chromium with Playwright and drives the whole flow against a local backend, a sample job page and a mocked Claude API.

```
core/       shared code: sources, collectors, classification, prompts, resume rendering
backend/    scheduled collector, JSON store, HTTP API, email digest
extension/  manifest, side panel, service worker (src/ is bundled into dist/)
```

After changing anything under `core/` or `extension/src/`, run `npm run build` and reload the extension.

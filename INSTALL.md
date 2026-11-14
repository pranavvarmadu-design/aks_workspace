# Job Finder: setup

Two parts. **Part A** is done once by the person paying for the Claude API. **Part B** is done on her computer, in Chrome.

## Part A: create her API key (account owner, 5 minutes)

1. Sign in at https://console.anthropic.com.
2. Billing: add a payment method or credits if the account has none.
3. Limits: set a monthly spend limit on the workspace, for example $20. The extension can never spend more than this.
4. API keys > Create key. Name it after her, so you can revoke it later without touching your own keys. Copy the key (it starts with `sk-ant-`).
5. Send her the key privately, for example by text message, not in a shared document.

Rough cost: one tailored resume uses three Claude calls and costs about $0.20 to $0.50 on the default model. The "Claude Sonnet 5.5" option in Settings costs about half.

Optional, for more listings: get a free Adzuna key at https://developer.adzuna.com (app ID and app key). Without it she still gets US university postdoc listings. Adzuna adds the India agritech, biotech and pharma listings.

## Part B: install the extension (her computer, 5 minutes)

1. Unzip `job-finder-extension.zip`. Keep the unzipped folder somewhere permanent, such as Documents. Chrome loads the extension from that folder, so don't delete it.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the `extension` folder inside the unzipped folder.
5. Click the puzzle-piece icon in the Chrome toolbar and pin **Job Finder and Resume Builder**.
6. Click its icon. A panel opens on the right side of the browser.

Chrome may show a banner about developer-mode extensions when it starts. That is expected for extensions installed this way; dismiss it.

## First use

1. **Settings** tab: paste the API key into "Anthropic API key". Add the Adzuna ID and key if you have them. Click **Save settings**.
2. **Resume builder** tab: paste her full resume or CV. Below it, paste `skills-and-constraints.txt` into **Skills and constraints**: what she operates herself, what she only prepares samples for, what she doesn't have, and her visa status. Click **Save resume**, then **Set search keywords from resume**.
3. **Jobs** tab: click **Refresh listings**. The first search takes a minute or two.

## Everyday use

- **Universities** tab: US postdoc listings, refreshed automatically every 12 hours while Chrome is open.
- **India industry** tab: agritech, biotech and pharma roles (needs the Adzuna key). Cards flag sales roles, required years of industry experience, and required degrees such as B.Pharm, M.Pharm or MBA; "PhD valued" and "Delhi NCR" show in green. For Naukri, LinkedIn or company career pages, open the job and use **Save job from this page**.
- **LinkedIn, Indeed or any careers page:** open the job, then click **Save job from this page** in the panel, or right-click the page and choose **Save this job to Job Finder**. It appears under **Saved**.
- **Job cards** flag "No visa sponsorship" and techniques the posting mentions that she lacks, once the posting text is available (always for jobs saved from a page).
- **Check fit and build resume** first screens the listing against her skills notes. If a required technique is one she lacks, or a US post rules out sponsorship, it stops and says why; **Build anyway** overrides. Otherwise it builds a version for that job, checks every claim against her master resume, and flags anything it couldn't confirm. Download it as a Word file, or use **Print / save PDF**.

Her resume and the API key stay in her Chrome on her computer. The resume and the job text are sent to Claude only when she builds a tailored resume.

## If something goes wrong

- **"The Anthropic API key was rejected"**: re-paste the key in Settings; check it hasn't been revoked.
- **"Rate limited"** or a billing error: check credits and the spend limit in the console.
- **A source failed**: open "Source details" under the Refresh button. One failing site doesn't affect the others.
- **Updating to a new version**: replace the folder with the new one, then click the reload arrow on the extension at `chrome://extensions`. Her resume and saved jobs are kept.

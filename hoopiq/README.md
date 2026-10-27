# HoopIQ — Fantasy Basketball Companion

Mobile-first fantasy basketball research, with an installable iPhone PWA.

**Live demo:** https://hoopiq-fantasy-bsb4.vercel.app/

## What's new in the light redesign
- A calm ivory-and-forest-green theme with larger type, clearer contrast, more space, and responsive iPhone controls.
- Five primary tabs: **Home, Team, Week, Waivers, AI Coach**; the top-right menu keeps secondary tools accessible.
- Streamlined roster and free-agent imports: upload a Yahoo screenshot, paste player names, or add them manually. Existing local roster and settings are retained.
- **Ask HoopIQ:** question-based chat for lineup, streaming, and waiver advice. In default **Built-in strategy mode**, answers are generated locally from saved players, schedule, and add/drop calculations; this is a deterministic tool, not a large language model.
- Optional natural-language AI backend: `api/coach.js` uses the OpenAI Responses API via the server (not the browser). To enable, set `OPENAI_API_KEY` as a secret in the **hoopiq-fantasy** Vercel project for Production, redeploy, and optionally set `OPENAI_MODEL` (default: `gpt-5.4-mini`). A paid API account and rate limits may apply. **Never paste or commit credentials to GitHub.** Chat questions plus a compact manually-entered roster/waiver context are sent to the AI provider only in this mode; the default built-in mode does not send them.
- All expected fantasy point gains are illustrative; they do not represent calibrated forecasts or verified Yahoo eligibility.

## Features
- Current NBA season averages and game schedules via an unofficial ESPN data source
- Custom fantasy basketball scoring and rankings
- Manual roster builder while Yahoo Fantasy API authorization is pending
- **Yahoo roster screenshot import:** open My League, choose a screenshot from iPhone Photos, review recognized players and save them to your local team. The first import replaces sample players; future imports can add or replace.
- **Yahoo available-player screenshot import:** choose an image from iPhone Photos; on-device Tesseract.js OCR proposes names, then you approve the matches before saving
- Text-paste and manual player search as fallback methods
- Waiver Fit Scout restricted to your manually marked available players
- **Weekly Matchup Planner:** real seven-day NBA schedule, color-coded lineup heatmap, per-player start/bench grid, editable daily starter capacity and open streaming windows
- **Automatic add/drop recommendations:** compare saved Yahoo available players against possible drops, rank weekly usable fantasy-point changes and show blocked games
- **Mobile-first dashboard:** top-line roster, usable-start and conflict metrics, weekly heatmap, top saved waiver move and five-tab iPhone navigation
- Pickup Fit Analyzer: games per week, usable starting slots, lineup conflicts, estimated fantasy points and illustrative matchup odds
- Trade analysis, draft board, and watchlist
- PWA manifest and service worker for iPhone Home Screen use

## Running locally
No framework build step is required. Run a local HTTP server from this `hoopiq` folder, for example:

```bash
python3 -m http.server 8080
```

Then visit http://localhost:8080. The HTML UI loads; **live serverless API routes do not work with the Python static server**. To run the full project with the `api/` functions, use Vercel CLI:

```bash
npm install -g vercel
vercel dev
```

For deployment on Vercel using this repository, configure **Root Directory = hoopiq** (if keeping the project inside `my-first-repository`), and deploy as an Other/no-framework project.

## Weekly lineup and waiver workflow
Import your team in **My Team**, save available players through **Waivers → Upload screenshot**, then use **Week** to inspect the real NBA slate. Green days have spare modeled starter slots, blue days are full, and red days have scheduled players on the bench. The daily capacity input controls the model on both the Week view and Pickup Fit Analyzer. The Dashboard and Waivers views can automatically recommend player-to-add / player-to-drop combinations. Tap **Inspect comparison** to open the detailed Pickup Fit Analyzer with the suggested pair already selected.

The model compares *recorded season average* fantasy points using your custom league scoring and a total daily starter limit. Results are hypothetical, are not validated forecasts, and cannot confirm actual Yahoo free agency or position eligibility. When the schedule feed is unavailable, the app does not invent a calendar.

## Yahoo screenshots
To import your real roster, open **My League → Upload screenshot**, select a screenshot of **Yahoo My Team**, and review the detected players. The initial save replaces the demo roster. Later screenshots can add players without removing existing ones, or replace your local roster when explicitly selected and confirmed. You can also choose **Paste names** or **Enter manually**.

To import available players, open **Waiver Wire Finder → Upload screenshot**. Choose a screenshot from Yahoo's available-player list. Image recognition runs locally in your browser with Tesseract.js (first use downloads a JavaScript library and English OCR model); the screenshot itself is not uploaded to the HoopIQ server. Check detected player names before saving. OCR may miss or misread names. Do not rely on the screenshot to establish up-to-the-minute waiver availability.

## Limits
- **Yahoo OAuth is not connected.** Yahoo Fantasy access must be approved and configured separately; no roster transactions are executed.
- Screenshot recognition matches text against players available in the app's current directory. Small text, imperfect OCR, unsupported names or missing live stats may cause incomplete matches; always review and correct the selection. Live season games played are not weekly projected games.
- Player names marked available and manual rosters are stored only in local browser storage, not synchronized between devices.
- Player fantasy-point estimates derive from *recorded season averages*, not validated future projections.
- Start-slot simulation uses a simplified total daily player limit; it does not implement exact Yahoo position slots, injuries, acquisition limits or true lineup locks.
- Automatic recommendations consider your manually saved available-player list and up to 40 strongest schedule/season-average candidates per analysis; results can change if Yahoo adds/removes free agents or season averages change.
- Win odds are an illustrative assumption, not calibrated probabilities.
- ESPN feed is unofficial and availability/licensing for broader production must be verified.
- Screenshot OCR requires downloading third-party code and models from jsDelivr/Tesseract and may not work fully offline.

## Structure
- `index.html` — UI, styling and client-side application logic
- `api/nba.js` — current season stats and NBA scoreboard proxy
- `api/week.js` — seven-day NBA schedule API
- `manifest.webmanifest`, `sw.js`, `icon.svg` — PWA assets

## Privacy
No Yahoo password or OAuth client secret is stored in this repository. Do not commit private keys to source control.

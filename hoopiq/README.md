# HoopIQ — Fantasy Basketball Companion

Mobile-first fantasy basketball research, with an installable iPhone PWA.

**Live demo:** https://hoopiq-fantasy-bsb4.vercel.app/

## Features
- Current NBA season averages and game schedules via an unofficial ESPN data source
- Custom fantasy basketball scoring and rankings
- Manual roster builder while Yahoo Fantasy API authorization is pending
- **Yahoo available-player screenshot import:** choose an image from iPhone Photos; on-device Tesseract.js OCR proposes names, then you approve the matches before saving
- Text-paste and manual player search as fallback methods
- Waiver Fit Scout restricted to your manually marked available players
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

## Yahoo screenshots
On your iPhone, open **Waiver Wire Finder → Upload screenshot**. Choose a screenshot from Yahoo's available-player list. Image recognition runs locally in your browser with Tesseract.js (first use downloads a JavaScript library and English OCR model); the screenshot itself is not uploaded to the HoopIQ server. Check detected player names before saving. OCR may miss or misread names. Do not rely on the screenshot to establish up-to-the-minute waiver availability.

## Limits
- **Yahoo OAuth is not connected.** Yahoo Fantasy access must be approved and configured separately; no roster transactions are executed.
- Player names marked available and manual rosters are stored only in local browser storage, not synchronized between devices.
- Player fantasy-point estimates derive from *recorded season averages*, not validated future projections.
- Start-slot simulation uses a simplified total daily player limit; it does not implement exact Yahoo position slots, injuries or acquisition limits.
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

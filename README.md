# World Cup 2026 Singapore TV Board

Static TV-board website for the FIFA World Cup 2026 Singapore-time schedule.

Views:
- Board: rotating overview with the next match and free-to-air highlights.
- Free 28: Mediacorp / Channel 5 / mewatch free-to-air schedule.
- Scoreboard: live Singapore-time clock, current score, all completed results returned by the live feed, and upcoming fixtures.
- Quiz: fixed participant list, saved per-person answers, leaderboard, and 10 World Cup trivia questions.
- All 104: full Singapore-time poster.

Notes:
- The main board is static HTML/CSS/JavaScript, with one Vercel Function for live scores.
- It works from `file://`, localhost, GitHub, and Vercel.
- The schedule data is embedded in `app.js` so the site still works even if Vercel cannot fetch the separate JSON files.
- The scoreboard updates the clock, countdown, live scores, final results, and match status in real time from the fixture schedule and live feed.
- Real match scores are supported on Vercel through `api/live-scores.js`.
- The live-score function uses ESPN's FIFA World Cup scoreboard first, so no API key is required for the main live result feed.
- If ESPN is unavailable, the function can optionally fall back to football-data.org when `FOOTBALL_DATA_API_KEY` is configured.

Run locally:

```sh
cd /Users/ahmadmadani.saaid/Documents/Playground/outputs/worldcup-2026-tv-board
python3 -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173
```

Useful TV URLs:

```text
/?slide=board
/?slide=free
/?slide=scoreboard
/?slide=quiz
/?slide=poster
/?slide=free&autorotate=0
/?slide=scoreboard&autorotate=0
```

GitHub upload:
1. Create a new empty GitHub repository.
2. Upload every file and folder inside `worldcup-2026-tv-board`.
3. Make sure these files are at the repository root: `index.html`, `app.js`, `styles.css`, `vercel.json`, and `package.json`.
4. Commit the upload.

Vercel setup:
1. In Vercel, choose "Add New Project".
2. Import the GitHub repository.
3. Framework Preset: `Other`.
4. Build Command: leave blank.
5. Output Directory: leave blank.
6. Install Command: leave blank.
7. Deploy.

Live score setup:
- Nothing extra is needed for the ESPN live-score feed. Deploy to Vercel and the Scoreboard tab will poll `/api/live-scores`.
- Optional fallback: create an API token at `football-data.org`, then add this in Vercel under `Settings` -> `Environment Variables`:

```text
FOOTBALL_DATA_API_KEY=your_token_here
```

Select `Production`, save, then redeploy the latest deployment from the Vercel `Deployments` tab.

The frontend polls `/api/live-scores` every 20 seconds. The serverless function returns normalized match scores to the scoreboard, including live and final results.

Troubleshooting:
- If Vercel shows `Unexpected token 'T', "The page c"... is not valid JSON`, it means an older version tried to fetch a JSON file but Vercel returned a "The page could not be found" response. Push the latest `app.js` and `index.html`; the current version embeds the schedule and does not rely on that fetch path.

Sources:
- FIFA official match schedule PDF, updated 10 Apr 2026.
- CNA article updated 8 Jun 2026 on Mediacorp's 28 free-to-air matches.
- Time Out Singapore guide published 9 Jun 2026.

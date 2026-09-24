# Slipstream

Slipstream is a 1v1 dash-fighter with a persistent pilot progression layer. Win best-of-three rounds by spacing, blocking, dashing, and landing attacks while the opponent is recovering.

## Systems

- Three loadouts change the combat model: Vanguard trades damage for health, Striker amplifies attacks, and Phase shortens dash recovery.
- A local pilot profile tracks level, XP, total matches, and wins across sessions.
- Daily contracts turn combat telemetry into objectives such as hit counts, powerup collection, specials, combos, and damage dealt.
- Match debriefs calculate a combat score, award XP, and report contract completion before the next rematch.
- The Arena Director periodically mutates the rules with Gravity Flux, Mirror Current, Overdrive Window, and Blackout Protocol events.
- Rival Adaptation watches repeated blocks and dashes, then changes the AI's spacing and punish behavior during the same match.
- The Flight Recorder keeps a live three-entry combat log for impacts, perfect guards, and director interventions.
- A server-driven daily challenge gives pilots a rotating objective and awards bonus XP when completed.
- Match telemetry is validated at the API boundary, making future balance dashboards possible without trusting browser state.
- The canvas loop, input layer, AI profiles, particles, audio feedback, touch controls, and cloud leaderboard remain available in every match.

## Stack

- Vercel serves the static HTML, CSS, JavaScript, and canvas game.
- C# .NET 8 isolated Azure Functions provide health checks and match results.
- Python provides a standard-library analytics report for operators and future dashboards.
- Azure Table Storage persists the leaderboard when `AzureWebJobsStorage` is configured.
- Without Azure Storage, the API uses an in-memory store for local development.

## Run The Game

Open `index.html` with Live Server, or serve the repository root with any static web server. The game also works directly in current Edge and Chrome browsers.

## Run The C# API

Install the .NET 8 SDK and Azure Functions Core Tools, then run:

```powershell
cd backend/Slipstream.Api
Copy-Item local.settings.json.example local.settings.json
func start
```

The API exposes:

- `GET /api/health`
- `GET /api/leaderboard`
- `GET /api/challenge`
- `POST /api/matches`

`POST /api/matches` accepts the match scores plus optional telemetry fields: `hits`, `damage`, `dashes`, `specials`, and `bestCombo`. The response includes the current daily challenge progress and any XP reward.

For local Azure Storage emulation, start Azurite and set `AzureWebJobsStorage` to `UseDevelopmentStorage=true`. For Azure, replace it with the Storage Account connection string.

## Run The Python Analytics Tool

Python is used for lightweight operator reporting without adding another runtime to the game server. It can read the live leaderboard endpoint or a saved JSON response:

```powershell
python tools/season_report.py --url http://localhost:7071/api/leaderboard
python tools/season_report.py --file leaderboard.json --format json
```

The report summarizes pilot count, aggregate matches, win rate, and the top five pilots. It uses only Python's standard library.

## Deploy

### Vercel frontend

Import this repository into Vercel with the project root set to the repository root. There is no build command and no output directory. The included `vercel.json` rewrites `/api/*` to Azure Functions using the `AZURE_FUNCTIONS_HOST` environment variable.

Set this Vercel environment variable to the Azure Functions host only, without `/api`:

```text
AZURE_FUNCTIONS_HOST=your-function-app.azurewebsites.net
```

### Azure backend

Create an Azure Function App using the .NET 8 isolated worker, configure `AzureWebJobsStorage`, and deploy the `backend/Slipstream.Api` project using Visual Studio, VS Code, or `func azure functionapp publish <app-name>`.

The browser game remains available on Vercel even when the optional API is not configured; it will show `CLOUD SCORES: LOCAL MODE` and continue to play normally.

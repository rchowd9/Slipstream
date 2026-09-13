# Slipstream

Slipstream is a 1v1 dash-fighter. Win best-of-three rounds by spacing, blocking, dashing, and landing attacks while the opponent is recovering.

## Stack

- Vercel serves the static HTML, CSS, JavaScript, and canvas game.
- C# .NET 8 isolated Azure Functions provide health checks and match results.
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
- `POST /api/matches`

For local Azure Storage emulation, start Azurite and set `AzureWebJobsStorage` to `UseDevelopmentStorage=true`. For Azure, replace it with the Storage Account connection string.

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

using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

public sealed class LeaderboardFunctions(LeaderboardStore store)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [Function("Health")]
    public async Task<HttpResponseData> Health([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "health")] HttpRequestData request)
    {
        var response = request.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new { status = "ok", service = "slipstream-api", version = "2.0" });
        return response;
    }

    [Function("GetLeaderboard")]
    public async Task<HttpResponseData> GetLeaderboard([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "leaderboard")] HttpRequestData request)
    {
        var response = request.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(store.GetTopPlayers());
        return response;
    }

    [Function("GetDailyChallenge")]
    public async Task<HttpResponseData> GetDailyChallenge(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "challenge")] HttpRequestData request)
    {
        var response = request.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(DailyChallengeCatalog.ForDate(DateOnly.FromDateTime(DateTime.UtcNow)));
        return response;
    }

    [Function("RecordMatch")]
    public async Task<HttpResponseData> RecordMatch(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "matches")] HttpRequestData request)
    {
        var result = await JsonSerializer.DeserializeAsync<MatchResult>(request.Body, JsonOptions);
        if (result is null || result.PlayerScore is < 0 or > 3 || result.OpponentScore is < 0 or > 3 ||
            result.Hits is < 0 or > 500 || result.Damage is < 0 or > 10000 ||
            result.Dashes is < 0 or > 500 || result.Specials is < 0 or > 50 || result.BestCombo is < 0 or > 100)
        {
            var badRequest = request.CreateResponse(HttpStatusCode.BadRequest);
            await badRequest.WriteAsJsonAsync(new { error = "A valid match result is required." });
            return badRequest;
        }

        store.Record(result);
    var challenge = DailyChallengeCatalog.Evaluate(result, DateOnly.FromDateTime(DateTime.UtcNow));
        var response = request.CreateResponse(HttpStatusCode.Created);
    await response.WriteAsJsonAsync(new { recorded = true, xpAwarded = challenge.XpAwarded, challenge });
        return response;
    }
}

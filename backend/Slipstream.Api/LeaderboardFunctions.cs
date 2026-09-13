using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

public sealed class LeaderboardFunctions(LeaderboardStore store)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [Function("Health")]
    public HttpResponseData Health([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "health")] HttpRequestData request)
    {
        var response = request.CreateResponse(HttpStatusCode.OK);
        response.WriteAsJsonAsync(new { status = "ok", service = "slipstream-api" });
        return response;
    }

    [Function("GetLeaderboard")]
    public HttpResponseData GetLeaderboard([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "leaderboard")] HttpRequestData request)
    {
        var response = request.CreateResponse(HttpStatusCode.OK);
        response.WriteAsJsonAsync(store.GetTopPlayers());
        return response;
    }

    [Function("RecordMatch")]
    public async Task<HttpResponseData> RecordMatch(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "matches")] HttpRequestData request)
    {
        var result = await JsonSerializer.DeserializeAsync<MatchResult>(request.Body, JsonOptions);
        if (result is null || result.PlayerScore is < 0 or > 3 || result.OpponentScore is < 0 or > 3)
        {
            var badRequest = request.CreateResponse(HttpStatusCode.BadRequest);
            await badRequest.WriteAsJsonAsync(new { error = "A valid match result is required." });
            return badRequest;
        }

        store.Record(result);
        var response = request.CreateResponse(HttpStatusCode.Created);
        await response.WriteAsJsonAsync(new { recorded = true });
        return response;
    }
}

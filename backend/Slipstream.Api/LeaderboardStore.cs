using Azure;
using Azure.Data.Tables;
using Microsoft.Extensions.Configuration;

public sealed record MatchResult(string Player, int PlayerScore, int OpponentScore);

public sealed record LeaderboardEntry(string Player, int Wins, int Losses, DateTimeOffset PlayedAt);

public sealed class LeaderboardStore
{
    private const string TableName = "slipstreamleaderboard";
    private readonly TableClient? tableClient;
    private readonly List<LeaderboardEntry> localEntries = [];
    private readonly object localLock = new();

    public LeaderboardStore(IConfiguration configuration)
    {
        var connectionString = configuration["AzureWebJobsStorage"];
        if (!string.IsNullOrWhiteSpace(connectionString) && connectionString != "UseDevelopmentStorage=true")
        {
            tableClient = new TableClient(connectionString, TableName);
            tableClient.CreateIfNotExists();
        }
    }

    public IReadOnlyList<LeaderboardEntry> GetTopPlayers()
    {
        if (tableClient is null)
        {
            lock (localLock)
            {
                return localEntries
                    .GroupBy(entry => entry.Player, StringComparer.OrdinalIgnoreCase)
                    .Select(group => new LeaderboardEntry(
                        group.Key,
                        group.Sum(entry => entry.Wins),
                        group.Sum(entry => entry.Losses),
                        group.Max(entry => entry.PlayedAt)))
                    .OrderByDescending(entry => entry.Wins)
                    .ThenBy(entry => entry.Losses)
                    .Take(10)
                    .ToArray();
            }
        }

        return tableClient.Query<LeaderboardTableEntity>(entry => entry.PartitionKey == "players")
            .GroupBy(entry => entry.Player, StringComparer.OrdinalIgnoreCase)
            .Select(group => new LeaderboardEntry(
                group.Key,
                group.Sum(entry => entry.Wins),
                group.Sum(entry => entry.Losses),
                group.Max(entry => entry.PlayedAt)))
            .OrderByDescending(entry => entry.Wins)
            .ThenBy(entry => entry.Losses)
            .Take(10)
            .ToArray();
    }

    public void Record(MatchResult result)
    {
        var entry = new LeaderboardEntry(
            string.IsNullOrWhiteSpace(result.Player) ? "PLAYER 1" : result.Player.Trim()[..Math.Min(24, result.Player.Trim().Length)],
            result.PlayerScore > result.OpponentScore ? 1 : 0,
            result.PlayerScore > result.OpponentScore ? 0 : 1,
            DateTimeOffset.UtcNow);

        if (tableClient is null)
        {
            lock (localLock)
            {
                localEntries.Add(entry);
            }
            return;
        }

        tableClient.AddEntity(new LeaderboardTableEntity
        {
            RowKey = Guid.NewGuid().ToString("N"),
            Player = entry.Player,
            Wins = entry.Wins,
            Losses = entry.Losses,
            PlayedAt = entry.PlayedAt
        });
    }

    private sealed class LeaderboardTableEntity : ITableEntity
    {
        public string PartitionKey { get; set; } = "players";
        public string RowKey { get; set; } = string.Empty;
        public DateTimeOffset? Timestamp { get; set; }
        public ETag ETag { get; set; }
        public string Player { get; set; } = string.Empty;
        public int Wins { get; set; }
        public int Losses { get; set; }
        public DateTimeOffset PlayedAt { get; set; }
    }
}

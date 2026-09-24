public sealed record DailyChallenge(
    string Date,
    string Name,
    string Metric,
    int Target,
    string Description);

public sealed record ChallengeProgress(
    DailyChallenge Challenge,
    int Progress,
    bool Completed,
    int XpAwarded);

public static class DailyChallengeCatalog
{
    private static readonly (string Name, string Metric, int Target, string Description)[] Challenges =
    [
        ("FIRST STRIKE", "hits", 5, "Land five hits in a single match."),
        ("HEAT SEEKER", "damage", 120, "Deal 120 combat damage in a single match."),
        ("SPECIALIST", "specials", 1, "Trigger a special attack."),
        ("UNTOUCHABLE", "bestCombo", 4, "Build a four-hit combo."),
        ("MOBILITY CHECK", "dashes", 8, "Dash eight times in a single match.")
    ];

    public static DailyChallenge ForDate(DateOnly date)
    {
        var index = Math.Abs(date.DayNumber) % Challenges.Length;
        var challenge = Challenges[index];
        return new DailyChallenge(
            date.ToString("yyyy-MM-dd"),
            challenge.Name,
            challenge.Metric,
            challenge.Target,
            challenge.Description);
    }

    public static ChallengeProgress Evaluate(MatchResult result, DateOnly date)
    {
        var challenge = ForDate(date);
        var value = challenge.Metric switch
        {
            "hits" => result.Hits,
            "damage" => result.Damage,
            "specials" => result.Specials,
            "bestCombo" => result.BestCombo,
            "dashes" => result.Dashes,
            _ => 0
        };
        var progress = Math.Clamp(value, 0, challenge.Target);
        var completed = progress >= challenge.Target;
        return new ChallengeProgress(challenge, progress, completed, completed ? 100 : 0);
    }
}

"""Create a compact operator report from the Slipstream leaderboard API.

Examples:
    python tools/season_report.py --url http://localhost:7071/api/leaderboard
    python tools/season_report.py --file leaderboard.json --format json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.request import urlopen


def load_entries(url: str | None, file_path: Path | None) -> list[dict]:
    if file_path:
        return json.loads(file_path.read_text(encoding="utf-8"))
    if not url:
        raise ValueError("Provide --url or --file.")
    with urlopen(url, timeout=5) as response:
        return json.load(response)


def build_report(entries: list[dict]) -> dict:
    normalized = [
        {
            "player": str(entry.get("player", "UNKNOWN")),
            "wins": int(entry.get("wins", 0)),
            "losses": int(entry.get("losses", 0)),
        }
        for entry in entries
    ]
    ranked = sorted(
        normalized,
        key=lambda entry: (
            entry["wins"],
            -(entry["losses"]),
            entry["player"].lower(),
        ),
        reverse=True,
    )
    total_wins = sum(entry["wins"] for entry in ranked)
    total_losses = sum(entry["losses"] for entry in ranked)
    return {
        "pilots": len(ranked),
        "matches": total_wins + total_losses,
        "win_rate": round(total_wins / max(total_wins + total_losses, 1), 3),
        "top_pilots": ranked[:5],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--url", help="Leaderboard endpoint URL")
    source.add_argument("--file", type=Path, help="Saved leaderboard JSON file")
    parser.add_argument("--format", choices=("text", "json"), default="text")
    args = parser.parse_args()

    report = build_report(load_entries(args.url, args.file))
    if args.format == "json":
        print(json.dumps(report, indent=2))
        return

    print(f"Pilots: {report['pilots']}  Matches: {report['matches']}")
    print(f"Aggregate win rate: {report['win_rate']:.1%}")
    print("Top pilots:")
    for index, pilot in enumerate(report["top_pilots"], start=1):
        print(f"  {index}. {pilot['player']} - {pilot['wins']}W / {pilot['losses']}L")


if __name__ == "__main__":
    main()

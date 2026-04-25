import soccerdata as sd
import pandas as pd
from google.cloud import bigquery
from datetime import datetime
import os, math
from pathlib import Path

from dotenv import load_dotenv

os.environ["SOCCERDATA_HEADLESS"] = "true"
os.environ["UC_DRIVER_PATH"] = "/usr/bin/chromedriver"

# Tell seleniumbase to use system chrome
import seleniumbase

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

PROJECT = os.environ["GCP_PROJECT"]
DATASET = "liverpool_analytics"

client = bigquery.Client(project=PROJECT)  # no keyfile, uses ADC


def bq_table(name):
    return f"{PROJECT}.{DATASET}.{name}"

def ensure_tables():
    client.query(f"""
        CREATE TABLE IF NOT EXISTS `{bq_table('raw_matches')}` (
            game_id       STRING,
            season        STRING,
            date          DATE,
            gameweek      INT64,
            home_team     STRING,
            away_team     STRING,
            home_goals    INT64,
            away_goals    INT64,
            venue         STRING,
            scraped_at    TIMESTAMP
        )
        PARTITION BY date
        OPTIONS (require_partition_filter = false)
    """).result()

    client.query(f"""
        CREATE TABLE IF NOT EXISTS `{bq_table('raw_player_stats')}` (
            season        STRING,
            player        STRING,
            team          STRING,
            stat_type     STRING,
            minutes       FLOAT64,
            goals         FLOAT64,
            assists       FLOAT64,
            xg            FLOAT64,
            xag           FLOAT64,
            shots         FLOAT64,
            shots_on_tgt  FLOAT64,
            passes_cmp    FLOAT64,
            passes_att    FLOAT64,
            key_passes    FLOAT64,
            prog_passes   FLOAT64,
            tackles       FLOAT64,
            interceptions FLOAT64,
            pressures     FLOAT64,
            touches       FLOAT64,
            prog_carries  FLOAT64,
            scraped_at    TIMESTAMP
        )
    """).result()

    client.query(f"""
        CREATE TABLE IF NOT EXISTS `{bq_table('raw_team_stats')}` (
            season        STRING,
            team          STRING,
            stat_type     STRING,
            data_json     STRING,
            scraped_at    TIMESTAMP
        )
    """).result()

    print("Tables ready.")

def clean_float(val):
    try:
        f = float(val)
        return None if math.isnan(f) else f
    except Exception:
        return None


def scrape_and_load(season):
    print(f"[{datetime.now()}] Scraping season {season}...")
    now = datetime.utcnow()

    fbref = sd.FBref(
        leagues=["ENG-Premier League"],
        seasons=[season],
        no_cache=True,
        headless=True,
    )

    # --- Matches ---
    schedule = fbref.read_schedule().reset_index()
    lfc_matches = schedule[
        (schedule["home_team"] == "Liverpool") | (schedule["away_team"] == "Liverpool")
    ].copy()

    match_rows = []
    for _, r in lfc_matches.iterrows():
        gid = str(r.get("game_id", f"{r['home_team']}-{r.get('date','')}"))
        d = r.get("date")
        match_rows.append(
            {
                "game_id": gid,
                "season": season,
                "date": str(d) if d else None,
                "gameweek": int(r["round"]) if pd.notna(r.get("round")) else None,
                "home_team": r.get("home_team"),
                "away_team": r.get("away_team"),
                "home_goals": int(r["home_goals"])
                if pd.notna(r.get("home_goals"))
                else None,
                "away_goals": int(r["away_goals"])
                if pd.notna(r.get("away_goals"))
                else None,
                "venue": r.get("venue"),
                "scraped_at": now.isoformat(),
            }
        )

    if match_rows:
        # Delete this season's rows first (idempotent)
        client.query(
            f"""
            DELETE FROM `{bq_table('raw_matches')}`
            WHERE season = '{season}'
        """
        ).result()
        errors = client.insert_rows_json(bq_table("raw_matches"), match_rows)
        if errors:
            print(f"Match insert errors: {errors}")
        else:
            print(f"Loaded {len(match_rows)} matches")

    # --- Player stats ---
    stat_map = {
        "standard": ["minutes", "goals", "assists", "xg", "xag"],
        "shooting": ["shots", "shots_on_tgt", "xg"],
        "passing": ["passes_cmp", "passes_att", "key_passes", "prog_passes"],
        "defense": ["tackles", "interceptions", "pressures"],
        "possession": ["touches", "prog_carries"],
    }

    player_rows = []
    for stat_type, _ in stat_map.items():
        try:
            df = fbref.read_player_season_stats(stat_type=stat_type).reset_index()
            lfc = df[df["team"] == "Liverpool"].copy()
            col = df.columns.tolist()

            def gc(names):
                for n in names:
                    if n in col:
                        return n
                return None

            for _, r in lfc.iterrows():
                player_rows.append(
                    {
                        "season": season,
                        "player": str(r.get("player", "")),
                        "team": "Liverpool",
                        "stat_type": stat_type,
                        "minutes": clean_float(r.get(gc(["minutes", "Min"]))),
                        "goals": clean_float(r.get(gc(["goals", "Gls"]))),
                        "assists": clean_float(r.get(gc(["assists", "Ast"]))),
                        "xg": clean_float(r.get(gc(["xg", "xG"]))),
                        "xag": clean_float(r.get(gc(["xag", "xAG"]))),
                        "shots": clean_float(r.get(gc(["shots", "Sh"]))),
                        "shots_on_tgt": clean_float(
                            r.get(gc(["shots_on_target", "SoT"]))
                        ),
                        "passes_cmp": clean_float(r.get(gc(["passes_completed", "Cmp"]))),
                        "passes_att": clean_float(r.get(gc(["passes", "Att"]))),
                        "key_passes": clean_float(r.get(gc(["passes_key", "KP"]))),
                        "prog_passes": clean_float(
                            r.get(gc(["passes_progressive", "PrgP"]))
                        ),
                        "tackles": clean_float(r.get(gc(["tackles", "Tkl"]))),
                        "interceptions": clean_float(
                            r.get(gc(["interceptions", "Int"]))
                        ),
                        "pressures": clean_float(r.get(gc(["pressures", "Press"]))),
                        "touches": clean_float(r.get(gc(["touches", "Touches"]))),
                        "prog_carries": clean_float(
                            r.get(gc(["carries_progressive", "PrgC"]))
                        ),
                        "scraped_at": now.isoformat(),
                    }
                )
        except Exception as e:
            print(f"  [{stat_type}] error: {e}")

    if player_rows:
        client.query(
            f"""
            DELETE FROM `{bq_table('raw_player_stats')}`
            WHERE season = '{season}'
        """
        ).result()
        errors = client.insert_rows_json(bq_table("raw_player_stats"), player_rows)
        if errors:
            print(f"Player insert errors: {errors}")
        else:
            print(f"Loaded {len(player_rows)} player stat rows")

    print(f"[{datetime.now()}] Done.")


if __name__ == "__main__":
    import sys

    ensure_tables()
    default = os.environ.get("CURRENT_SEASON", "2425")
    season = sys.argv[1] if len(sys.argv) > 1 else default
    scrape_and_load(season)

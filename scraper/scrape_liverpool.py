import soccerdata as sd
import pandas as pd
from google.cloud import bigquery
from google.cloud.bigquery import LoadJobConfig, WriteDisposition
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

    # DEBUG - print columns and first row
    print("COLUMNS:", lfc_matches.columns.tolist())
    if len(lfc_matches) > 0:
        print("SAMPLE ROW:", lfc_matches.iloc[0].to_dict())
    else:
        print("SAMPLE ROW: <no Liverpool matches found>")

    match_rows = []
    for _, r in lfc_matches.iterrows():
        # Parse score string like '0–2' or '2–1' (en dash)
        score = r.get("score")
        home_goals = None
        away_goals = None
        if score and isinstance(score, str) and "–" in score:
            parts = score.split("–")
            try:
                home_goals = int(parts[0].strip())
                away_goals = int(parts[1].strip())
            except Exception:
                pass

        match_rows.append(
            {
                "game_id": str(r.get("game_id", "")),
                "season": season,
                "date": str(r.get("date"))[:10] if r.get("date") else None,
                "gameweek": int(r["week"]) if pd.notna(r.get("week")) else None,
                "home_team": r.get("home_team"),
                "away_team": r.get("away_team"),
                "home_goals": home_goals,
                "away_goals": away_goals,
                "venue": r.get("venue"),
                "scraped_at": now.isoformat(),
            }
        )

    if match_rows:
        df = pd.DataFrame(match_rows)
        df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.date
        job_config = LoadJobConfig(write_disposition=WriteDisposition.WRITE_TRUNCATE)
        job = client.load_table_from_dataframe(
            df, bq_table("raw_matches"), job_config=job_config
        )
        job.result()
        print(f"Loaded {len(match_rows)} matches")

    # --- Player stats ---
    stat_types = ["standard", "shooting", "playing_time", "misc"]
    player_rows = []

    for stat_type in stat_types:
        try:
            df = fbref.read_player_season_stats(stat_type=stat_type)
            df = df.reset_index()

            # Filter Liverpool only using MultiIndex tuple key
            lfc = df[df[("team", "")] == "Liverpool"].copy()

            for _, r in lfc.iterrows():
                player = r.get(("player", ""), "")
                if not isinstance(player, str) or not player.strip():
                    continue

                def g(*keys):
                    for k in keys:
                        val = r.get(k)
                        if val is not None and str(val) not in ("nan", "None", ""):
                            return str(val)
                    return ""

                player_rows.append(
                    {
                        "season": season,
                        "player": str(player).strip(),
                        "team": "Liverpool",
                        "stat_type": stat_type,
                        "minutes": g(("Playing Time", "Min"), ("Min", "")),
                        "goals": g(("Performance", "Gls"), ("Gls", "")),
                        "assists": g(("Performance", "Ast"), ("Ast", "")),
                        "xg": g(("Expected", "xG"), ("xG", "")),
                        "xag": g(("Expected", "xAG"), ("xAG", "")),
                        "shots": g(("Standard", "Sh"), ("Sh", "")),
                        "shots_on_tgt": g(("Standard", "SoT"), ("SoT", "")),
                        "passes_cmp": g(("Total", "Cmp"), ("Cmp", "")),
                        "passes_att": g(("Total", "Att"), ("Att", "")),
                        "key_passes": g(("KP", ""), ("KP",)),
                        "prog_passes": g(("PrgP", ""), ("PrgP",)),
                        "tackles": g(("Tackles", "Tkl"), ("Tkl", "")),
                        "interceptions": g(("Int", ""), ("Int",)),
                        "pressures": g(("Pressures", "Press"), ("Press", "")),
                        "touches": g(("Touches", "Touches"), ("Touches", "")),
                        "prog_carries": g(("Carries", "PrgC"), ("PrgC", "")),
                        "scraped_at": now.isoformat(),
                    }
                )
        except Exception as e:
            print(f"  [{stat_type}] error: {e}")

    print(f"Total player rows: {len(player_rows)}")
    if player_rows:
        sample = {
            k: v
            for k, v in player_rows[0].items()
            if k in ["player", "goals", "assists", "minutes", "xg"]
        }
        print(f"Sample: {sample}")

    if player_rows:
        df = pd.DataFrame(player_rows)
        for c in [
            "minutes",
            "goals",
            "assists",
            "xg",
            "xag",
            "shots",
            "shots_on_tgt",
            "passes_cmp",
            "passes_att",
            "key_passes",
            "prog_passes",
            "tackles",
            "interceptions",
            "pressures",
            "touches",
            "prog_carries",
        ]:
            if c in df.columns:
                df[c] = pd.to_numeric(df[c], errors="coerce")
        job_config = LoadJobConfig(write_disposition=WriteDisposition.WRITE_TRUNCATE)
        job = client.load_table_from_dataframe(
            df, bq_table("raw_player_stats"), job_config=job_config
        )
        job.result()
        print(f"Loaded {len(player_rows)} player stat rows")

    print(f"[{datetime.now()}] Done.")


if __name__ == "__main__":
    import sys

    ensure_tables()
    default = os.environ.get("CURRENT_SEASON", "2425")
    season = sys.argv[1] if len(sys.argv) > 1 else default
    scrape_and_load(season)

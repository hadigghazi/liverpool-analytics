# scraper/scrape_liverpool.py
import soccerdata as sd
import pandas as pd
from bs4 import BeautifulSoup, Comment
from google.cloud import bigquery
from google.cloud.bigquery import LoadJobConfig, WriteDisposition
from datetime import datetime, date
import os, time, random, math
from pathlib import Path
from io import StringIO
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

PROJECT = os.environ["GCP_PROJECT"]
DATASET = "liverpool_analytics"
client = bigquery.Client(project=PROJECT)

LIVERPOOL_SQUAD_ID = "822bd0ba"
BASE = "https://fbref.com"

def bq_table(name):
    return f"{PROJECT}.{DATASET}.{name}"

def to_float(val):
    try:
        f = float(str(val).replace(",", "").strip())
        return None if math.isnan(f) else f
    except:
        return None

def get_current_season():
    today = date.today()
    year = today.year
    month = today.month
    if month >= 8:
        return f"{str(year)[2:]}{str(year+1)[2:]}"
    else:
        return f"{str(year-1)[2:]}{str(year)[2:]}"

def get_all_seasons(from_year=2000):
    seasons = []
    current = get_current_season()
    year = from_year
    while True:
        y1 = str(year)[2:].zfill(2)
        y2 = str(year + 1)[2:].zfill(2)
        code = f"{y1}{y2}"
        seasons.append(code)
        if code == current:
            break
        year += 1
    return seasons

def season_to_year(season):
    y1 = int("20" + season[:2]) if int(season[:2]) >= 0 else int("19" + season[:2])
    # Handle 00, 01 etc
    prefix1 = "20" if int(season[:2]) <= 30 else "19"
    prefix2 = "20" if int(season[2:]) <= 30 else "19"
    return f"{prefix1}{season[:2]}-{prefix2}{season[2:]}"

def ensure_tables():
    client.query(f"""
        CREATE TABLE IF NOT EXISTS `{bq_table('raw_matches')}` (
            game_id STRING, season STRING, date DATE, gameweek INT64,
            home_team STRING, away_team STRING, home_goals INT64,
            away_goals INT64, venue STRING, scraped_at TIMESTAMP
        )
    """).result()

    client.query(f"""
        CREATE TABLE IF NOT EXISTS `{bq_table('raw_player_stats')}` (
            season STRING, player STRING, team STRING, stat_type STRING,
            minutes FLOAT64, goals FLOAT64, assists FLOAT64,
            xg FLOAT64, xag FLOAT64, npxg FLOAT64,
            shots FLOAT64, shots_on_tgt FLOAT64, shot_on_tgt_pct FLOAT64,
            passes_cmp FLOAT64, passes_att FLOAT64, passes_cmp_pct FLOAT64,
            key_passes FLOAT64, passes_into_final_third FLOAT64,
            passes_into_pen_area FLOAT64, prog_passes FLOAT64,
            tackles FLOAT64, tackles_won FLOAT64,
            interceptions FLOAT64, blocks FLOAT64, clearances FLOAT64,
            pressures FLOAT64, pressure_successes FLOAT64,
            touches FLOAT64, touches_att_pen FLOAT64,
            prog_carries FLOAT64, carries_into_final_third FLOAT64,
            carries_into_pen_area FLOAT64,
            take_ons_att FLOAT64, take_ons_won FLOAT64,
            prog_passes_received FLOAT64,
            yellow_cards FLOAT64, red_cards FLOAT64,
            fouls FLOAT64, fouled FLOAT64, offsides FLOAT64,
            scraped_at TIMESTAMP
        )
    """).result()

    client.query(f"""
        CREATE TABLE IF NOT EXISTS `{bq_table('scraped_seasons')}` (
            season STRING,
            scraped_at TIMESTAMP,
            matches_count INT64,
            players_count INT64,
            is_complete BOOL
        )
    """).result()

    print("Tables ready.")

def get_scraped_seasons():
    try:
        rows = client.query(f"""
            SELECT season FROM `{bq_table('scraped_seasons')}`
            WHERE is_complete = TRUE
        """).result()
        return {row.season for row in rows}
    except:
        return set()

def mark_season_scraped(season, matches_count, players_count, is_complete):
    client.query(f"""
        DELETE FROM `{bq_table('scraped_seasons')}` WHERE season = '{season}'
    """).result()
    client.insert_rows_json(bq_table('scraped_seasons'), [{
        "season": season,
        "scraped_at": datetime.utcnow().isoformat(),
        "matches_count": matches_count,
        "players_count": players_count,
        "is_complete": is_complete,
    }])

def fetch_with_driver(driver, url, wait=15):
    print(f"    GET {url}")
    time.sleep(random.uniform(6, 12))
    try:
        driver.execute_script(f"window.location.href = '{url}';")
        time.sleep(wait)
    except Exception as e:
        try:
            driver.get(url)
            time.sleep(wait)
        except Exception as e2:
            print(f"    fetch failed: {e2}")
            return ""
    return driver.page_source

def parse_table(html, table_id):
    if not html:
        return pd.DataFrame()
    soup = BeautifulSoup(html, "lxml")

    # Check comments first (FBref hides some tables in HTML comments)
    comments = soup.find_all(string=lambda t: isinstance(t, Comment))
    for c in comments:
        if table_id in c:
            cs = BeautifulSoup(c, "lxml")
            table = cs.find("table", {"id": table_id})
            if table:
                return _parse_df(table, table_id)

    # Direct table
    table = soup.find("table", {"id": table_id})
    if table:
        return _parse_df(table, table_id)

    return pd.DataFrame()

def _parse_df(table, table_id):
    try:
        is_matches = table_id == "matchlogs_for"
        df = pd.read_html(StringIO(str(table)), header=0 if is_matches else [0, 1])[0]
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = [
                str(b) if str(a).startswith("Unnamed") else (f"{a}_{b}" if str(b) != "" else str(a))
                for a, b in df.columns
            ]
        if "Player" in df.columns:
            df = df[df["Player"] != "Player"]
            df = df[df["Player"].notna()]
        return df
    except Exception as e:
        print(f"    parse error: {e}")
        return pd.DataFrame()

def scrape_season(driver, season):
    year = season_to_year(season)
    BIG5 = f"{BASE}/en/comps/Big5/{year}"
    SQUAD = f"{BASE}/en/squads/{LIVERPOOL_SQUAD_ID}/{year}"

    pages = {
        "standard":   f"{BIG5}/stats/players/{year}-Big-5-European-Leagues-Stats",
        "shooting":   f"{BIG5}/shooting/players/{year}-Big-5-European-Leagues-Shooting",
        "passing":    f"{BIG5}/passing/players/{year}-Big-5-European-Leagues-Passing",
        "defense":    f"{BIG5}/defense/players/{year}-Big-5-European-Leagues-Defense",
        "possession": f"{BIG5}/possession/players/{year}-Big-5-European-Leagues-Possession",
        "misc":       f"{BIG5}/misc/players/{year}-Big-5-European-Leagues-Misc",
        "matches":    f"{SQUAD}/matchlogs/all_comps/schedule/Liverpool-Match-Logs",
    }

    table_ids = {
        "standard":   "stats_standard",
        "shooting":   "stats_shooting",
        "passing":    "stats_passing",
        "defense":    "stats_defense",
        "possession": "stats_possession",
        "misc":       "stats_misc",
        "matches":    "matchlogs_for",
    }

    data = {}
    for name, url in pages.items():
        html = fetch_with_driver(driver, url)
        tid = table_ids[name]
        df = parse_table(html, tid)

        if not df.empty:
            if name != "matches" and "Squad" in df.columns:
                df = df[df["Squad"] == "Liverpool"].copy()
            elif name != "matches" and "Squad" not in df.columns:
                # Old seasons may not have Squad column on Big5
                # Fall back to squad page
                pass
            print(f"    ✅ {name}: {len(df)} rows")
            data[name] = df
        else:
            print(f"    ❌ {name}: not found")

    return data

def build_match_rows(df, season):
    rows = []
    now = datetime.utcnow().isoformat()
    for _, r in df.iterrows():
        comp = str(r.get("Comp", ""))
        if "Premier League" not in comp:
            continue
        date_str = str(r.get("Date", ""))
        if not date_str or date_str == "nan":
            continue

        venue = str(r.get("Venue", ""))
        gf = to_float(r.get("GF"))
        ga = to_float(r.get("GA"))

        if venue.lower() == "home":
            home_goals = int(gf) if gf is not None else None
            away_goals = int(ga) if ga is not None else None
        else:
            home_goals = int(ga) if ga is not None else None
            away_goals = int(gf) if gf is not None else None

        opponent = str(r.get("Opponent", ""))
        round_val = str(r.get("Round", ""))
        gameweek = None
        if "Matchweek" in round_val:
            try:
                gameweek = int(round_val.replace("Matchweek", "").strip())
            except:
                pass

        rows.append({
            "game_id":    str(r.get("Match Report", date_str))[-8:],
            "season":     season,
            "date":       date_str[:10],
            "gameweek":   gameweek,
            "home_team":  "Liverpool" if venue.lower() == "home" else opponent,
            "away_team":  opponent if venue.lower() == "home" else "Liverpool",
            "home_goals": home_goals,
            "away_goals": away_goals,
            "venue":      venue,
            "scraped_at": now,
        })
    return rows

def build_player_rows(data, season):
    now = datetime.utcnow().isoformat()
    standard   = data.get("standard", pd.DataFrame())
    shooting   = data.get("shooting", pd.DataFrame())
    misc       = data.get("misc", pd.DataFrame())

    if standard.empty:
        return []

    def from_df(df, player, *cols):
        if df.empty or "Player" not in df.columns:
            return None
        rows = df[df["Player"] == player]
        if rows.empty:
            return None
        for col in cols:
            if col in rows.columns:
                v = to_float(rows.iloc[0][col])
                if v is not None:
                    return v
        return None

    rows = []
    for _, r in standard.iterrows():
        player = str(r.get("Player", "")).strip()
        if not player or player in ("nan", "Player", ""):
            continue

        def s(*cols):
            for c in cols:
                if c in r.index:
                    v = to_float(r[c])
                    if v is not None:
                        return v
            return None

        rows.append({
            "season":      season,
            "player":      player,
            "team":        "Liverpool",
            "stat_type":   "combined",
            "minutes":     s("Playing Time_Min"),
            "goals":       s("Performance_Gls"),
            "assists":     s("Performance_Ast"),
            "yellow_cards": s("Performance_CrdY"),
            "red_cards":   s("Performance_CrdR"),
            "xg":          None,
            "xag":         None,
            "npxg":        None,
            "shots":       from_df(shooting, player, "Standard_Sh"),
            "shots_on_tgt": from_df(shooting, player, "Standard_SoT"),
            "shot_on_tgt_pct": from_df(shooting, player, "Standard_SoT%"),
            "passes_cmp":  None,
            "passes_att":  None,
            "passes_cmp_pct": None,
            "key_passes":  None,
            "passes_into_final_third": None,
            "passes_into_pen_area": None,
            "prog_passes": None,
            "tackles":     from_df(misc, player, "Performance_TklW"),
            "tackles_won": from_df(misc, player, "Performance_TklW"),
            "interceptions": from_df(misc, player, "Performance_Int"),
            "blocks":      None,
            "clearances":  None,
            "pressures":   None,
            "pressure_successes": None,
            "touches":     None,
            "touches_att_pen": None,
            "prog_carries": None,
            "carries_into_final_third": None,
            "carries_into_pen_area": None,
            "take_ons_att": None,
            "take_ons_won": None,
            "prog_passes_received": None,
            "fouls":       from_df(misc, player, "Performance_Fls"),
            "fouled":      from_df(misc, player, "Performance_Fld"),
            "offsides":    from_df(misc, player, "Performance_Off"),
            "scraped_at":  now,
        })
    return rows

def load_to_bq(match_rows, player_rows, season):
    if match_rows:
        df = pd.DataFrame(match_rows)
        df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.date
        df["gameweek"] = pd.to_numeric(df["gameweek"], errors="coerce")
        df["home_goals"] = pd.to_numeric(df["home_goals"], errors="coerce")
        df["away_goals"] = pd.to_numeric(df["away_goals"], errors="coerce")

        # Delete existing season data first
        client.query(f"""
            DELETE FROM `{bq_table('raw_matches')}` WHERE season = '{season}'
        """).result()
        time.sleep(2)  # wait for streaming buffer

        client.load_table_from_dataframe(
            df, bq_table("raw_matches"),
            job_config=LoadJobConfig(write_disposition=WriteDisposition.WRITE_APPEND)
        ).result()
        print(f"    Loaded {len(match_rows)} matches")

    if player_rows:
        df = pd.DataFrame(player_rows)
        numeric_cols = [c for c in df.columns
                        if c not in ["season", "player", "team", "stat_type", "scraped_at"]]
        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        client.query(f"""
            DELETE FROM `{bq_table('raw_player_stats')}` WHERE season = '{season}'
        """).result()
        time.sleep(2)

        client.load_table_from_dataframe(
            df, bq_table("raw_player_stats"),
            job_config=LoadJobConfig(write_disposition=WriteDisposition.WRITE_APPEND)
        ).result()
        print(f"    Loaded {len(player_rows)} player rows")

def run(seasons=None, force=False):
    print(f"[{datetime.utcnow()}] Starting multi-season Liverpool scrape...")
    ensure_tables()

    if seasons is None:
        seasons = get_all_seasons(from_year=2000)

    current = get_current_season()
    already_scraped = get_scraped_seasons()

    print(f"Current season: {current}")
    print(f"Seasons to scrape: {seasons}")
    print(f"Already complete: {already_scraped}")

    # Initialize soccerdata driver once — reuse across all seasons
    print("\nInitializing browser...")
    fbref_sd = sd.FBref(leagues=["ENG-Premier League"], seasons=[current])
    driver = fbref_sd._driver
    print("Browser ready.\n")

    for season in seasons:
        is_current = season == current
        is_complete_season = not is_current

        # Skip completed historical seasons unless forced
        if is_complete_season and season in already_scraped and not force:
            print(f"[{season}] Already scraped, skipping.")
            continue

        print(f"\n{'='*50}")
        print(f"[{season}] Scraping {season_to_year(season)}...")
        print(f"{'='*50}")

        try:
            data = scrape_season(driver, season)

            match_rows = []
            if "matches" in data and not data["matches"].empty:
                match_rows = build_match_rows(data["matches"], season)
                print(f"  Built {len(match_rows)} PL match rows")

            player_rows = build_player_rows(data, season)
            print(f"  Built {len(player_rows)} player rows")

            if match_rows or player_rows:
                load_to_bq(match_rows, player_rows, season)
                mark_season_scraped(season, len(match_rows), len(player_rows), is_complete_season)
                print(f"  ✅ Season {season} done")
            else:
                print(f"  ⚠️  No data found for {season} — may not exist on FBref")

            # Longer pause between seasons to be respectful
            if season != seasons[-1]:
                delay = random.uniform(20, 35)
                print(f"  Waiting {delay:.0f}s before next season...")
                time.sleep(delay)

        except Exception as e:
            print(f"  ❌ Error scraping {season}: {e}")
            import traceback
            traceback.print_exc()
            # Continue to next season
            time.sleep(30)

    print(f"\n[{datetime.utcnow()}] All done.")

if __name__ == "__main__":
    import sys
    args = sys.argv[1:]

    if args and args[0] == "--current":
        # Only scrape current season (for weekly Task Scheduler)
        run(seasons=[get_current_season()], force=True)
    elif args and args[0] == "--force":
        # Rescrape everything
        run(force=True)
    elif args:
        # Specific seasons e.g. python scrape_liverpool.py 2425 2526
        run(seasons=args, force=True)
    else:
        # Default: scrape all missing seasons
        run()
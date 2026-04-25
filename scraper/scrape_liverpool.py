import soccerdata as sd
import pandas as pd
from bs4 import BeautifulSoup, Comment
from google.cloud import bigquery
from google.cloud.bigquery import LoadJobConfig, WriteDisposition
from datetime import datetime
import os, time, random, math
from pathlib import Path
import re
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
    print("Tables ready.")

def fetch_with_soccerdata_driver(driver, url, wait=20):
    print(f"  GET {url}")
    time.sleep(random.uniform(8, 15))  # longer delay between pages
    try:
        driver.get(url)
        time.sleep(wait)
    except Exception as e:
        print(f"  driver error: {e}")
        return ""

    try:
        print(f"     current_url: {driver.current_url}")
        print(f"     title: {driver.title}")
    except Exception:
        pass
    return driver.page_source


def parse_table_from_html(html, table_id):
    soup = BeautifulSoup(html, "lxml")

    def _read_table(table_html, matchlogs=False):
        if matchlogs:
            return pd.read_html(StringIO(table_html), header=0)[0]
        return pd.read_html(StringIO(table_html), header=[0, 1])[0]

    # FBref hides tables inside HTML comments — must parse comments
    comments = soup.find_all(string=lambda text: isinstance(text, Comment))
    for comment in comments:
        if table_id in comment:
            comment_soup = BeautifulSoup(comment, "lxml")
            table = comment_soup.find("table", {"id": table_id})
            if table:
                try:
                    df = _read_table(str(table), matchlogs=(table_id == "matchlogs_for"))
                    if isinstance(df.columns, pd.MultiIndex):
                        df.columns = [
                            str(b)
                            if str(a).startswith("Unnamed")
                            else (f"{a}_{b}" if str(b) != "" else str(a))
                            for a, b in df.columns
                        ]
                    if "Player" in df.columns:
                        df = df[df["Player"] != "Player"]
                        df = df[df["Player"].notna()]
                    return df
                except Exception as e:
                    print(f"    comment parse error: {e}")

    # Try direct table (not in comment)
    table = soup.find("table", {"id": table_id})
    if table:
        try:
            df = _read_table(str(table), matchlogs=(table_id == "matchlogs_for"))
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = [
                    str(b)
                    if str(a).startswith("Unnamed")
                    else (f"{a}_{b}" if str(b) != "" else str(a))
                    for a, b in df.columns
                ]
            if "Player" in df.columns:
                df = df[df["Player"] != "Player"]
                df = df[df["Player"].notna()]
            return df
        except Exception as e:
            print(f"    direct parse error: {e}")

    return pd.DataFrame()

def scrape_all(season):
    year = f"20{season[:2]}-20{season[2:]}"

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

    # Initialize soccerdata (this passes Cloudflare) and reuse its undetected driver
    fbref_sd = sd.FBref(leagues=["ENG-Premier League"], seasons=[season])
    driver = fbref_sd._driver  # undetected Chrome instance
    results = {}

    for name, url in pages.items():
        html = fetch_with_soccerdata_driver(driver, url, wait=20)
        if not html:
            print(f"  [SKIP] {name}: empty response")
            continue

        tid = table_ids[name]
        df = parse_table_from_html(html, tid)

        if not df.empty:
            # Filter Liverpool players from Big5 data
            if name != "matches":
                for squad_col in ["Squad", "squad", "team", "Team"]:
                    if squad_col in df.columns:
                        df = df[df[squad_col] == "Liverpool"].copy()
                        break
            print(f"  [OK] {name}: {len(df)} rows, cols: {df.columns.tolist()[:12]}")
            results[name] = df
        else:
            soup_dbg = BeautifulSoup(html, "lxml")
            direct_ids = [
                t.get("id", "") for t in soup_dbg.find_all("table") if t.get("id")
            ]
            comments = soup_dbg.find_all(string=lambda t: isinstance(t, Comment))
            comment_ids = []
            for c in comments:
                if "table" in c and "id=" in c:
                    cs = BeautifulSoup(c, "lxml")
                    comment_ids.extend(
                        [t.get("id", "") for t in cs.find_all("table") if t.get("id")]
                    )
            print(f"  [ERR] {name}: not found")
            print(f"     direct: {direct_ids[:10]}")
            print(f"     comments: {comment_ids[:10]}")

    return results

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

        # Matches df has GF/GA directly, and Venue, Result
        venue = str(r.get("Venue", ""))
        gf = to_float(r.get("GF"))
        ga = to_float(r.get("GA"))
        home_goals = (
            int(gf)
            if gf is not None and venue.lower() == "home"
            else (int(ga) if ga is not None else None)
        )
        away_goals = (
            int(ga)
            if ga is not None and venue.lower() == "home"
            else (int(gf) if gf is not None else None)
        )

        opponent = str(r.get("Opponent", ""))
        round_val = str(r.get("Round", ""))
        gameweek = None
        if "Matchweek" in round_val:
            try:
                gameweek = int(round_val.replace("Matchweek", "").strip())
            except Exception:
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
    standard = data.get("standard", pd.DataFrame())
    shooting = data.get("shooting", pd.DataFrame())
    misc = data.get("misc", pd.DataFrame())

    if standard.empty:
        print("No standard data")
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

        rows.append(
            {
                "season": season,
                "player": player,
                "team": "Liverpool",
                "stat_type": "combined",
                # Standard stats
                "minutes": s("Playing Time_Min"),
                "goals": s("Performance_Gls"),
                "assists": s("Performance_Ast"),
                "yellow_cards": s("Performance_CrdY"),
                "red_cards": s("Performance_CrdR"),
                # xG — not available free tier, leave null
                "xg": None,
                "xag": None,
                "npxg": None,
                # Shooting — shots available
                "shots": from_df(shooting, player, "Standard_Sh"),
                "shots_on_tgt": from_df(shooting, player, "Standard_SoT"),
                "shot_on_tgt_pct": from_df(shooting, player, "Standard_SoT%"),
                # Passing — NaN from Big5 free tier
                "passes_cmp": None,
                "passes_att": None,
                "passes_cmp_pct": None,
                "key_passes": None,
                "passes_into_final_third": None,
                "passes_into_pen_area": None,
                "prog_passes": None,
                # Defense — from misc (has real data)
                "tackles": from_df(misc, player, "Performance_TklW"),
                "tackles_won": from_df(misc, player, "Performance_TklW"),
                "interceptions": from_df(misc, player, "Performance_Int"),
                "blocks": None,
                "clearances": None,
                "pressures": None,
                "pressure_successes": None,
                # Possession — NaN from Big5 free tier
                "touches": None,
                "touches_att_pen": None,
                "prog_carries": None,
                "carries_into_final_third": None,
                "carries_into_pen_area": None,
                "take_ons_att": None,
                "take_ons_won": None,
                "prog_passes_received": None,
                # Misc — real data
                "fouls": from_df(misc, player, "Performance_Fls"),
                "fouled": from_df(misc, player, "Performance_Fld"),
                "offsides": from_df(misc, player, "Performance_Off"),
                "scraped_at": now,
            }
        )
    return rows

def run(season="2425"):
    print(f"[{datetime.utcnow()}] Starting Liverpool scrape for season {season}...")
    data = scrape_all(season)

    if "matches" in data:
        match_rows = build_match_rows(data["matches"], season)
        if match_rows:
            df = pd.DataFrame(match_rows)
            df["date"] = pd.to_datetime(df["date"]).dt.date
            df["gameweek"] = pd.to_numeric(df["gameweek"], errors="coerce")
            df["home_goals"] = pd.to_numeric(df["home_goals"], errors="coerce")
            df["away_goals"] = pd.to_numeric(df["away_goals"], errors="coerce")
            client.load_table_from_dataframe(
                df, bq_table("raw_matches"),
                job_config=LoadJobConfig(write_disposition=WriteDisposition.WRITE_TRUNCATE)
            ).result()
            print(f"Loaded {len(match_rows)} matches")

    player_rows = build_player_rows(data, season)
    if player_rows:
        df = pd.DataFrame(player_rows)
        numeric_cols = [c for c in df.columns
                        if c not in ["season", "player", "team", "stat_type", "scraped_at"]]
        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        client.load_table_from_dataframe(
            df, bq_table("raw_player_stats"),
            job_config=LoadJobConfig(write_disposition=WriteDisposition.WRITE_TRUNCATE)
        ).result()
        print(f"Loaded {len(player_rows)} player rows")

    print(f"[{datetime.utcnow()}] Done.")

if __name__ == "__main__":
    import sys
    ensure_tables()
    season = sys.argv[1] if len(sys.argv) > 1 else "2425"
    run(season)
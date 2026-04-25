import cloudscraper
from bs4 import BeautifulSoup
import pandas as pd
from google.cloud import bigquery
from google.cloud.bigquery import LoadJobConfig, WriteDisposition
from datetime import datetime, timezone
import os, time, random, re
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

PROJECT = os.environ["GCP_PROJECT"]
DATASET = "liverpool_analytics"
client = bigquery.Client(project=PROJECT)

BASE = "https://www.transfermarkt.com"
LIVERPOOL_ID = 31  # Transfermarkt's Liverpool club ID

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": "https://www.transfermarkt.com/",
}


def bq_table(name):
    return f"{PROJECT}.{DATASET}.{name}"


def ensure_tables():
    client.query(
        f"""
        CREATE TABLE IF NOT EXISTS `{bq_table('tm_squad_values')}` (
            season           STRING,
            player           STRING,
            player_id        STRING,
            position         STRING,
            nationality      STRING,
            age              INT64,
            market_value_eur INT64,
            scraped_at       TIMESTAMP
        )
    """
    ).result()

    client.query(
        f"""
        CREATE TABLE IF NOT EXISTS `{bq_table('tm_transfers')}` (
            season           STRING,
            player           STRING,
            player_id        STRING,
            direction        STRING,
            from_club        STRING,
            to_club          STRING,
            fee_eur          INT64,
            fee_text         STRING,
            transfer_date    DATE,
            position         STRING,
            age_at_transfer  INT64,
            scraped_at       TIMESTAMP
        )
    """
    ).result()
    print("Tables ready.")


def make_scraper():
    return cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "windows", "desktop": True}
    )


def fetch(scraper, url, retries=3):
    for attempt in range(retries):
        try:
            time.sleep(random.uniform(3, 7))
            resp = scraper.get(url, headers=HEADERS, timeout=30)
            if resp.status_code == 200:
                return resp.text
            print(f"  HTTP {resp.status_code} for {url}")
        except Exception as e:
            print(f"  Attempt {attempt + 1} failed: {e}")
            time.sleep(10)
    return None


def parse_market_value(text):
    if not text:
        return None
    text = text.strip().replace("\xa0", "").replace(",", ".")
    try:
        if "m" in text.lower():
            return int(float(re.sub(r"[^\d.]", "", text)) * 1_000_000)
        if "k" in text.lower():
            return int(float(re.sub(r"[^\d.]", "", text)) * 1_000)
        val = re.sub(r"[^\d]", "", text)
        return int(val) if val else None
    except Exception:
        return None


def parse_fee(text):
    if not text:
        return None, None
    text = text.strip()
    if any(x in text.lower() for x in ["free", "loan", "draft", "-"]):
        return 0, text
    return parse_market_value(text), text


def season_to_tm(season):
    # "2425" -> "2024"
    return f"20{season[:2]}"


def scrape_squad_values(scraper, season):
    tm_season = season_to_tm(season)
    url = f"{BASE}/fc-liverpool/startseite/verein/{LIVERPOOL_ID}/saison_id/{tm_season}"
    print(f"  Fetching squad values for {season} ({url})")

    html = fetch(scraper, url)
    if not html:
        return []

    soup = BeautifulSoup(html, "lxml")

    now = datetime.now(timezone.utc).isoformat()
    rows = []

    table = soup.find("table", {"class": "items"})
    if not table:
        print("  No squad table found")
        return []

    for row in table.find_all("tr", {"class": ["odd", "even"]}):
        cells = row.find_all("td")
        if len(cells) < 9:
            continue

        try:
            player_name = cells[3].text.strip()
            if not player_name:
                continue

            position = cells[4].text.strip()

            # Parse age from "02/10/1992 (32)"
            dob_text = cells[5].text.strip()
            age = None
            age_match = re.search(r"\((\d+)\)", dob_text)
            if age_match:
                age = int(age_match.group(1))

            # Market value from last cell
            mv_text = cells[8].text.strip()
            market_value = parse_market_value(mv_text)

            # Nationality from flag img
            nat_img = row.find("img", {"class": "flaggenrahmen"})
            nationality = nat_img.get("title", "") if nat_img else ""

            rows.append(
                {
                    "season": season,
                    "player": player_name,
                    "player_id": "",
                    "position": position,
                    "nationality": nationality,
                    "age": age,
                    "market_value_eur": market_value,
                    "scraped_at": now,
                }
            )
        except Exception:
            continue

    print(f"  Found {len(rows)} players")
    return rows


def scrape_transfers(scraper, season):
    tm_season = season_to_tm(season)
    url = f"{BASE}/fc-liverpool/transfers/verein/{LIVERPOOL_ID}/saison_id/{tm_season}"
    print(f"  Fetching transfers for {season}")

    html = fetch(scraper, url)
    if not html:
        return []

    soup = BeautifulSoup(html, "lxml")
    now = datetime.now(timezone.utc).isoformat()
    rows = []

    boxes = soup.find_all("div", {"class": "box"})

    for box in boxes:
        h2 = box.find("h2")
        if not h2:
            continue
        h2_text = h2.text.strip()
        if h2_text == "Arrivals":
            direction = "in"
        elif h2_text == "Departures":
            direction = "out"
        else:
            continue

        table = box.find("table")
        if not table:
            continue

        for row in table.find_all("tr", {"class": ["odd", "even"]}):
            cells = row.find_all("td")
            if len(cells) < 12:
                continue
            try:
                player_name = cells[3].text.strip()
                if not player_name:
                    continue

                position = cells[4].text.strip()
                age_text = cells[5].text.strip()
                age = int(age_text) if age_text.isdigit() else None
                other_club = cells[9].text.strip()
                fee_text = cells[11].text.strip()
                fee_eur, fee_display = parse_fee(fee_text)

                rows.append(
                    {
                        "season": season,
                        "player": player_name,
                        "player_id": "",
                        "direction": direction,
                        "from_club": other_club if direction == "in" else "Liverpool",
                        "to_club": "Liverpool" if direction == "in" else other_club,
                        "fee_eur": fee_eur,
                        "fee_text": fee_display,
                        "transfer_date": None,
                        "position": position,
                        "age_at_transfer": age,
                        "scraped_at": now,
                    }
                )
            except Exception:
                continue

    print(f"  Found {len(rows)} transfers")
    return rows


def load_to_bq(table_name, rows, season):
    if not rows:
        return

    client.query(
        f"""
        DELETE FROM `{bq_table(table_name)}` WHERE season = '{season}'
    """
    ).result()
    time.sleep(2)

    df = pd.DataFrame(rows)
    # Fix types
    if "market_value_eur" in df.columns:
        df["market_value_eur"] = pd.to_numeric(df["market_value_eur"], errors="coerce")
    if "fee_eur" in df.columns:
        df["fee_eur"] = pd.to_numeric(df["fee_eur"], errors="coerce")
    if "age" in df.columns:
        df["age"] = pd.to_numeric(df["age"], errors="coerce")
    if "age_at_transfer" in df.columns:
        df["age_at_transfer"] = pd.to_numeric(df["age_at_transfer"], errors="coerce")
    if "transfer_date" in df.columns:
        df["transfer_date"] = pd.to_datetime(df["transfer_date"], errors="coerce").dt.date
    # Fix scraped_at — convert string to proper datetime
    if "scraped_at" in df.columns:
        df["scraped_at"] = pd.to_datetime(df["scraped_at"], utc=True)

    client.load_table_from_dataframe(
        df,
        bq_table(table_name),
        job_config=LoadJobConfig(write_disposition=WriteDisposition.WRITE_APPEND),
    ).result()
    print(f"  Loaded {len(rows)} rows to {table_name}")


def run(seasons=None):
    print(f"[{datetime.now(timezone.utc)}] Starting Transfermarkt scrape...")
    ensure_tables()

    if seasons is None:
        from datetime import date

        current_year = date.today().year
        current_month = date.today().month
        end_year = current_year if current_month >= 8 else current_year - 1
        seasons = []
        for y in range(end_year - 9, end_year + 1):
            y1 = str(y)[2:].zfill(2)
            y2 = str(y + 1)[2:].zfill(2)
            seasons.append(f"{y1}{y2}")

    print(f"Seasons: {seasons}")
    scraper = make_scraper()

    for season in seasons:
        print(f"\n[{season}]")

        squad_rows = scrape_squad_values(scraper, season)
        load_to_bq("tm_squad_values", squad_rows, season)

        transfer_rows = scrape_transfers(scraper, season)
        load_to_bq("tm_transfers", transfer_rows, season)

        if season != seasons[-1]:
            delay = random.uniform(10, 20)
            print(f"  Waiting {delay:.0f}s...")
            time.sleep(delay)

    print(f"\n[{datetime.now(timezone.utc)}] Done.")


if __name__ == "__main__":
    import sys

    seasons = sys.argv[1:] if len(sys.argv) > 1 else None
    run(seasons)


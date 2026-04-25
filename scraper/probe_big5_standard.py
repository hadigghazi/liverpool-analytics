import time
from io import StringIO

import pandas as pd
import soccerdata as sd
from bs4 import BeautifulSoup, Comment


def main():
    fbref = sd.FBref(leagues=["ENG-Premier League"], seasons=["2425"])
    driver = fbref._driver

    time.sleep(3)
    driver.get(
        "https://fbref.com/en/comps/Big5/2024-2025/stats/players/2024-2025-Big-5-European-Leagues-Stats"
    )
    time.sleep(20)

    html = driver.page_source
    soup = BeautifulSoup(html, "lxml")
    direct_tables = [t.get("id", "no-id") for t in soup.find_all("table")]
    print("DIRECT TABLE IDS:", direct_tables[:50])
    comments = soup.find_all(string=lambda t: isinstance(t, Comment))

    target_html = None

    for c in comments:
        if "stats_standard" in c:
            cs = BeautifulSoup(c, "lxml")
            t = cs.find("table", {"id": "stats_standard"})
            if t:
                target_html = str(t)
                break

    if target_html is None:
        t = soup.find("table", {"id": "stats_standard"})
        if t:
            target_html = str(t)

    if target_html is None:
        print("stats_standard table not found (comment or direct).")
        return

    df = pd.read_html(StringIO(target_html), header=[0, 1])[0]
    df.columns = [
        str(b)
        if str(a).startswith("Unnamed")
        else (str(a) + "_" + str(b) if str(b) else str(a))
        for a, b in df.columns
    ]
    lfc = df[df["Squad"] == "Liverpool"]
    print("LFC COLS:", lfc.columns.tolist())
    print(
        lfc[
            [
                "Player",
                "Squad",
                "Performance_Gls",
                "Performance_Ast",
                "Expected_xG",
                "Expected_xAG",
            ]
        ].head(5)
    )


if __name__ == "__main__":
    main()


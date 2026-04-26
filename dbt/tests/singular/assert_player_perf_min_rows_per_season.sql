-- Fails if any season in the mart has fewer than 20 players (likely bad scrape).
-- Severity: warn so new/partial seasons do not block merges.
{{ config(severity="warn") }}

SELECT season, COUNT(*) AS player_count
FROM {{ ref('liverpool_player_performance') }}
GROUP BY season
HAVING COUNT(*) < 20

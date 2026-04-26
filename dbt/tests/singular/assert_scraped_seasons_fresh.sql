-- Fails when no FBref scrape row is newer than 10 days (operational signal).
-- Uses scraped_seasons max(scraped_at); tune interval as needed.
{{ config(severity="warn") }}

SELECT 1 AS stale_scrape
FROM (
  SELECT MAX(scraped_at) AS last_scrape
  FROM {{ source('liverpool_ops', 'scraped_seasons') }}
) x
WHERE x.last_scrape IS NULL
   OR x.last_scrape < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 10 DAY)

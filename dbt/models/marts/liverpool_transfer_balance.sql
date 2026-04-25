SELECT
    season,
    COALESCE(SUM(CASE WHEN direction = 'in' AND fee_eur > 0 THEN fee_eur END), 0)   AS spent_eur,
    COALESCE(SUM(CASE WHEN direction = 'out' AND fee_eur > 0 THEN fee_eur END), 0)  AS received_eur,
    COALESCE(SUM(CASE WHEN direction = 'in' AND fee_eur > 0 THEN fee_eur END), 0) -
    COALESCE(SUM(CASE WHEN direction = 'out' AND fee_eur > 0 THEN fee_eur END), 0) AS net_spend_eur,
    COUNT(CASE WHEN direction = 'in' THEN 1 END)   AS arrivals,
    COUNT(CASE WHEN direction = 'out' THEN 1 END)  AS departures,
    MAX(CASE WHEN direction = 'in' THEN fee_eur END)  AS biggest_buy_eur,
    MAX(CASE WHEN direction = 'out' THEN fee_eur END) AS biggest_sale_eur,
    MAX(CASE WHEN direction = 'in' AND fee_eur = (
        SELECT MAX(fee_eur) FROM `liverpool-analytics.liverpool_analytics.tm_transfers` t2
        WHERE t2.season = t.season AND t2.direction = 'in'
    ) THEN player END) AS biggest_signing
FROM `liverpool-analytics.liverpool_analytics.tm_transfers` t
GROUP BY season
ORDER BY season DESC


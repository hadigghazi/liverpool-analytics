{% snapshot tm_squad_values_snapshot %}
{{
  config(
    target_schema='liverpool_analytics',
    unique_key='sk',
    strategy='check',
    check_cols=['market_value_eur', 'position', 'age', 'nationality', 'nationality_full']
  )
}}

-- one row per sk: dbt_scd_id = hash(sk, run time); duplicate sk in this query => duplicate dbt_scd_id => MERGE error.
-- use explicit columns (no t.*) and normalized season; QUALIFY is the final guarantee of uniques for unique_key.
WITH src AS (
  SELECT
    TRIM(COALESCE(CAST(t.season AS STRING), '')) AS season,
    t.player,
    t.player_id,
    t.player_slug,
    t.position,
    t.nationality,
    t.nationality_full,
    t.age,
    t.market_value_eur,
    t.photo_url,
    t.dob,
    t.height,
    t.foot,
    t.contract_expires,
    t.scraped_at,
    CONCAT(
      COALESCE(
        NULLIF(TRIM(t.player_id), ''),
        LOWER(NULLIF(TRIM(t.player), ''))
      ),
      '|',
      TRIM(COALESCE(CAST(t.season AS STRING), ''))
    ) AS sk
  FROM {{ source('liverpool_ops', 'tm_squad_values') }} AS t
)
SELECT
  sk,
  season,
  player,
  player_id,
  player_slug,
  position,
  nationality,
  nationality_full,
  age,
  market_value_eur,
  photo_url,
  dob,
  height,
  foot,
  contract_expires,
  scraped_at
FROM src
QUALIFY ROW_NUMBER() OVER (PARTITION BY sk ORDER BY scraped_at DESC) = 1

{% endsnapshot %}

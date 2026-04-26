# Liverpool analytics property graph (BigQuery Graph)

This folder contains SQL to build **node tables**, **edge tables**, and a **`LiverpoolGraph`** property graph over existing marts (`liverpool_player_performance`, `liverpool_season_summary`, `tm_transfers`, `tm_squad_values`).

## Prerequisites

- BigQuery **EU** location (matches this repo’s queries).
- Roles: **BigQuery Data Editor** (or equivalent) on dataset `liverpool_analytics`.
- BigQuery Graph enabled for the project (see [Create and query a graph](https://cloud.google.com/bigquery/docs/graph-create)).

## Run

1. Replace every occurrence of **`YOUR_GCP_PROJECT`** in the SQL files with your project id (e.g. `liverpool-analytics`).

2. Run in order (from the **repo root** `liverpool-analytics/`, not inside `dbt/`).

   **Bash / Git Bash / WSL (stdin redirect works):**

```bash
bq query --use_legacy_sql=false --location=EU --project_id=YOUR_GCP_PROJECT < bigquery/graph/01_create_tables.sql
bq query --use_legacy_sql=false --location=EU --project_id=YOUR_GCP_PROJECT < bigquery/graph/02_populate_tables.sql
bq query --use_legacy_sql=false --location=EU --project_id=YOUR_GCP_PROJECT < bigquery/graph/03_create_property_graph.sql
```

   **Windows PowerShell (stdin `<` is not valid — pipe the file content instead):**

```powershell
cd C:\Users\User\liverpool-analytics
Get-Content -Raw bigquery\graph\01_create_tables.sql   | bq query --nouse_legacy_sql --location=EU --project_id=liverpool-analytics
Get-Content -Raw bigquery\graph\02_populate_tables.sql  | bq query --nouse_legacy_sql --location=EU --project_id=liverpool-analytics
Get-Content -Raw bigquery\graph\03_create_property_graph.sql | bq query --nouse_legacy_sql --location=EU --project_id=liverpool-analytics
```

   (Use `--nouse_legacy_sql` or `--use_legacy_sql=false`; both are accepted by the `bq` CLI.)

   **Windows CMD (classic redirect):**

```bat
cd C:\Users\User\liverpool-analytics
cmd /c "bq query --use_legacy_sql=false --location=EU --project_id=liverpool-analytics < bigquery\graph\01_create_tables.sql"
```

3. Re-run **`02_populate_tables.sql`** whenever underlying marts change and you want the graph tables refreshed.

4. Re-run **`03_create_property_graph.sql`** if you change node/edge table schemas (property graphs are recreated with `OR REPLACE`).

## Player IDs

`graph_players.player_id` prefers **Transfermarkt `player_id`** from the latest `tm_squad_values` row per name; otherwise **`CAST(ABS(FARM_FINGERPRINT(LOWER(TRIM(name)))) AS STRING)`** so joins stay stable without TM ids.

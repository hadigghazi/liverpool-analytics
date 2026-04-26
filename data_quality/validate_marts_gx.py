"""
Validate dbt marts in BigQuery with Great Expectations (Pandas in-memory, GX 1.17+).

Requires: great-expectations, google-cloud-bigquery, pandas, pyarrow
  pip install -r data_quality/requirements-gx.txt

Usage (from repo root):
  set GCP_PROJECT=liverpool-analytics
  set BQ_DATASET=liverpool_analytics
  python data_quality/validate_marts_gx.py

Falls back: run `dbt test` in CI; this is an optional post-load cross-check of raw DataFrames
aligned with the same marts the API reads.
"""
from __future__ import annotations

import os
import sys
import uuid
from collections.abc import Sequence

import great_expectations as gx
import pandas as pd
from google.cloud import bigquery


def _fqtn(name: str) -> str:
    p = os.environ.get("GCP_PROJECT", "liverpool-analytics")
    d = os.environ.get("BQ_DATASET", "liverpool_analytics")
    return f"`{p}.{d}.{name}`"


def _read_table(
    client: bigquery.Client, name: str, limit: int | None = 10_000
) -> pd.DataFrame:
    fq = _fqtn(name)
    lim = f" LIMIT {int(limit)}" if limit else ""
    return client.query(f"SELECT * FROM {fq}{lim}").to_dataframe()


def _table_checks() -> list[tuple[str, int, Sequence]]:
    e = gx.expectations
    return [
        (
            "liverpool_season_summary",
            5000,
            (
                e.ExpectColumnValuesToNotBeNull(column="season"),
                e.ExpectColumnValuesToNotBeNull(column="points"),
            ),
        ),
        (
            "liverpool_squad_value",
            5000,
            (e.ExpectColumnValuesToNotBeNull(column="season"),),
        ),
        (
            "liverpool_match_results",
            5000,
            (
                e.ExpectColumnValuesToNotBeNull(column="season"),
                e.ExpectColumnValuesToNotBeNull(column="date"),
            ),
        ),
    ]


def run() -> int:
    client = bigquery.Client()
    any_fail = False
    for table, limit, expectations in _table_checks():
        print(f"GX: {table} (limit {limit}) ...", flush=True)
        try:
            df = _read_table(client, table, limit=limit)
        except Exception as ex:  # noqa: BLE001 — surface BQ/perm errors
            print(f"  read failed: {ex}", file=sys.stderr)
            any_fail = True
            continue
        if df.empty and table in ("liverpool_season_summary", "liverpool_squad_value"):
            print(f"  warn: 0 rows in {table}", file=sys.stderr)
        ctx = gx.get_context()
        name = f"liverpool_pandas_{uuid.uuid4().hex[:10]}"
        ds = ctx.data_sources.add_or_update_pandas(name=name)
        asset = ds.add_dataframe_asset(name=table)
        bdef = asset.add_batch_definition_whole_dataframe("w")
        batch = bdef.get_batch({"dataframe": df})
        for ex in expectations:
            result = batch.validate(ex)
            if not result.success:
                print(f"  fail: {ex}", file=sys.stderr)
                any_fail = True
    return 1 if any_fail else 0


if __name__ == "__main__":
    raise SystemExit(run())

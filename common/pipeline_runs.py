"""
Append-only pipeline run log in BigQuery (fbref / transfermarkt / dbt).
Used for lineage and a simple health view (last success, rows written).
"""
from __future__ import annotations

import os
import uuid
from typing import Optional

from google.cloud import bigquery


def _dataset() -> str:
    return os.environ.get("BQ_DATASET", "liverpool_analytics")


def _table_id() -> str:
    return f"{os.environ['GCP_PROJECT']}.{_dataset()}.pipeline_runs"


def _table_sql() -> str:
    return f"`{_table_id()}`"


def ensure_pipeline_runs_table(client: bigquery.Client) -> None:
    project = os.environ["GCP_PROJECT"]
    dataset_id = _dataset()
    ds_ref = bigquery.Dataset(f"{project}.{dataset_id}")
    try:
        client.get_dataset(ds_ref)
    except Exception:
        client.create_dataset(ds_ref, exists_ok=True)
    ddl = f"""
    CREATE TABLE IF NOT EXISTS `{project}.{dataset_id}.pipeline_runs` (
      run_id STRING NOT NULL,
      pipeline STRING NOT NULL,
      season STRING,
      started_at TIMESTAMP NOT NULL,
      finished_at TIMESTAMP,
      rows_written INT64,
      status STRING NOT NULL,
      error_msg STRING
    )
    """
    client.query(ddl).result()


def start_run(client: bigquery.Client, pipeline: str, season: Optional[str] = None) -> str:
    ensure_pipeline_runs_table(client)
    run_id = str(uuid.uuid4())
    cfg = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("rid", "STRING", run_id),
            bigquery.ScalarQueryParameter("pip", "STRING", pipeline[:64]),
            bigquery.ScalarQueryParameter("sea", "STRING", (season or "")[:16]),
        ]
    )
    client.query(
        f"""
        INSERT INTO {_table_sql()} (run_id, pipeline, season, started_at, status)
        VALUES (@rid, @pip, @sea, CURRENT_TIMESTAMP(), 'running')
        """,
        job_config=cfg,
    ).result()
    return run_id


def finish_run(
    client: bigquery.Client,
    run_id: str,
    *,
    rows_written: Optional[int] = None,
    status: str = "success",
    error_msg: Optional[str] = None,
) -> None:
    base = f"""
    UPDATE {_table_sql()} T
    SET
      finished_at = CURRENT_TIMESTAMP(),
      status = @status,
      error_msg = @err
    WHERE run_id = @rid
    """
    params = [
        bigquery.ScalarQueryParameter("status", "STRING", status[:32]),
        bigquery.ScalarQueryParameter("err", "STRING", (error_msg or "")[:8192]),
        bigquery.ScalarQueryParameter("rid", "STRING", run_id),
    ]
    if rows_written is not None:
        q = base.replace(
            "error_msg = @err",
            "rows_written = @rows,\n      error_msg = @err",
        )
        params.insert(
            0,
            bigquery.ScalarQueryParameter("rows", "INT64", rows_written),
        )
    else:
        q = base.replace(
            "finished_at = CURRENT_TIMESTAMP(),",
            "finished_at = CURRENT_TIMESTAMP(),\n      rows_written = NULL,",
        )
    client.query(q, job_config=bigquery.QueryJobConfig(query_parameters=params)).result()

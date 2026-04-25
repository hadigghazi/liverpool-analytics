import os
from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.bash import BashOperator

default_args = {
    "owner": "hadi",
    "retries": 2,
    "retry_delay": timedelta(minutes=10),
    "email_on_failure": False,
}

GCP = os.environ["GCP_PROJECT"]
REG = os.environ.get("REGISTRY", f"europe-west1-docker.pkg.dev/{GCP}/liverpool")

TM_IMG = f"{REG}/transfermarkt:latest"
DBT_IMG = f"{REG}/dbt:latest"

with DAG(
    dag_id="transfermarkt_pipeline",
    default_args=default_args,
    description="Scrape Transfermarkt → BigQuery → dbt",
    schedule_interval="0 6 1 8 *",  # 1st August every year (start of window)
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["transfermarkt", "market_value"],
) as dag:
    scrape = BashOperator(
        task_id="scrape_transfermarkt",
        bash_command=f"""
            docker run --rm \\
              -e GCP_PROJECT={GCP} \\
              {TM_IMG} \\
              python scrape_tm.py
        """,
    )

    transform = BashOperator(
        task_id="run_dbt_transfermarkt_models",
        bash_command=f"""
            docker run --rm \\
              -e GCP_PROJECT={GCP} \\
              {DBT_IMG} \\
              dbt run --profiles-dir . --project-dir . \\
              --select liverpool_squad_value liverpool_transfer_balance liverpool_player_values
        """,
    )

    scrape >> transform


import os
from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.bash import BashOperator

default_args = {
    "owner": "hadi",
    "retries": 2,
    "retry_delay": timedelta(minutes=15),
    "email_on_failure": False,
}

# Airflow process env (set in docker-compose) — not hardcoded
GCP = os.environ["GCP_PROJECT"]
SEASON = os.environ.get("CURRENT_SEASON", "2425")
REG = os.environ.get("REGISTRY", f"europe-west1-docker.pkg.dev/{GCP}/liverpool")

SCRAPE_IMG = f"{REG}/scraper:latest"
DBT_IMG = f"{REG}/dbt:latest"

with DAG(
    dag_id="liverpool_analytics_pipeline",
    default_args=default_args,
    description="FBref → BigQuery → dbt for Liverpool FC",
    schedule_interval="0 9 * * 2,4,6,0",  # Tue/Thu/Sat/Sun post-matchday
    start_date=datetime(2024, 8, 1),
    catchup=False,
    tags=["liverpool", "football", "bigquery"],
) as dag:
    scrape = BashOperator(
        task_id="scrape_fbref",
        bash_command=f"""
            docker run --rm \\
              -e GCP_PROJECT={GCP} \\
              {SCRAPE_IMG} \\
              python scrape_liverpool.py {SEASON}
        """,
    )

    transform = BashOperator(
        task_id="run_dbt",
        bash_command=f"""
            docker run --rm \\
              -e GCP_PROJECT={GCP} \\
              {DBT_IMG} \\
              dbt run --profiles-dir . --project-dir .
        """,
    )

    test = BashOperator(
        task_id="test_dbt",
        bash_command=f"""
            docker run --rm \\
              -e GCP_PROJECT={GCP} \\
              {DBT_IMG} \\
              dbt test --profiles-dir . --project-dir .
        """,
    )

    scrape >> transform >> test

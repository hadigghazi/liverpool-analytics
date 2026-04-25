from airflow import DAG
from airflow.operators.bash import BashOperator
from datetime import datetime, timedelta

default_args = {
    "owner": "hadi",
    "retries": 2,
    "retry_delay": timedelta(minutes=15),
    "email_on_failure": False,
}

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
        bash_command="""
            docker run --rm \
              -e GCP_PROJECT={{ var.value.gcp_project }} \
              europe-west1-docker.pkg.dev/{{ var.value.gcp_project }}/liverpool/scraper:latest \
              python scrape_liverpool.py {{ var.value.current_season }}
        """,
    )

    transform = BashOperator(
        task_id="run_dbt",
        bash_command="""
            docker run --rm \
              -e GCP_PROJECT={{ var.value.gcp_project }} \
              europe-west1-docker.pkg.dev/{{ var.value.gcp_project }}/liverpool/dbt:latest \
              dbt run --profiles-dir . --project-dir .
        """,
    )

    test = BashOperator(
        task_id="test_dbt",
        bash_command="""
            docker run --rm \
              -e GCP_PROJECT={{ var.value.gcp_project }} \
              europe-west1-docker.pkg.dev/{{ var.value.gcp_project }}/liverpool/dbt:latest \
              dbt test --profiles-dir . --project-dir .
        """,
    )

    scrape >> transform >> test

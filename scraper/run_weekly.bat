@echo off
cd C:\Users\User\liverpool-analytics\scraper
set GCP_PROJECT=liverpool-analytics
set CURRENT_SEASON=2425
python scrape_liverpool.py 2425
cd ..\dbt
dbt run --profiles-dir . --project-dir .
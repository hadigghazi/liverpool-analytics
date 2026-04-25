@echo off
cd C:\Users\User\liverpool-analytics\scraper
set GCP_PROJECT=liverpool-analytics
python scrape_liverpool.py --current
cd ..\dbt
dbt run --profiles-dir . --project-dir .
echo Done at %date% %time%
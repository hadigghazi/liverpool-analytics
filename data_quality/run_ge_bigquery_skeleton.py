"""
Entry point for Great Expectations against BigQuery marts (optional).

Implemented runner: `validate_marts_gx.py` in this folder (GE 1.17+ fluent Pandas
data source, reads marts to DataFrame, runs expectations). Install with:

  pip install -r data_quality/requirements-gx.txt
  set GCP_PROJECT=... & set BQ_DATASET=liverpool_analytics
  python data_quality/validate_marts_gx.py

Full GX Cloud / YAML project layout is not required; use `dbt test` as the
primary contract in CI, and this script for extra Pandas-based checks if desired.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

_VALIDATOR = Path(__file__).resolve().parent / "validate_marts_gx.py"


def main() -> int:
    spec = importlib.util.spec_from_file_location("validate_marts_gx", _VALIDATOR)
    if spec is None or spec.loader is None:
        print("Cannot load validate_marts_gx.py", file=sys.stderr)
        return 1
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    if hasattr(mod, "run") and callable(mod.run):
        return int(mod.run())
    print("validate_marts_gx.run() missing", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

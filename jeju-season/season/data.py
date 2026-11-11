"""가공된 데이터(data/processed)와 가상 농가 일정(data/sample)을 읽는다."""
from __future__ import annotations

import functools
import json
import pathlib

import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
SAMPLE = ROOT / "data" / "sample"


@functools.lru_cache(maxsize=None)
def _csv(name: str) -> pd.DataFrame:
    return pd.read_csv(PROCESSED / f"{name}.csv")


def tangerine() -> pd.DataFrame:
    return _csv("tangerine_emd").copy()


def orchards() -> pd.DataFrame:
    return _csv("orchard_estimated").copy()


def farms_jdc() -> pd.DataFrame:
    return _csv("farms_jdc").copy()


def lodging() -> pd.DataFrame:
    return _csv("lodging").copy()


def bus_stops() -> pd.DataFrame:
    return _csv("bus_stops").copy()


def bus_routes() -> pd.DataFrame:
    return _csv("bus_routes").copy()


def card_monthly() -> pd.DataFrame:
    return _csv("card_monthly").copy()


def charter_bus() -> pd.DataFrame:
    return _csv("charter_bus").copy()


@functools.lru_cache(maxsize=None)
def emd_geojson() -> dict:
    return json.loads((PROCESSED / "emd.geojson").read_text(encoding="utf-8"))


def sample_requests() -> pd.DataFrame:
    df = pd.read_csv(SAMPLE / "farm_requests.csv", parse_dates=["시작일", "종료일"])
    return df

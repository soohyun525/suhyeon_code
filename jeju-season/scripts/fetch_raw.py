"""공공데이터포털 공개 파일과 행정경계를 data/raw/ 로 내려받는다.

로그인·인증키가 필요 없는 공개 파일만 받는다. 각 데이터의 이용조건은 데이터 상세 페이지를 따른다.

    python scripts/fetch_raw.py
"""
from __future__ import annotations

import http.cookiejar
import json
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

RAW = pathlib.Path(__file__).resolve().parents[1] / "data" / "raw"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) jeju-season/0.1"}

# 공공데이터포털 파일데이터 번호 → 용도
DATASETS = {
    "15048184": "서귀포시 감귤 생산 정보 (읍면동·품종별 농가수·면적·생산량)",
    "15097167": "JDC 농가 기본정보 (감귤 농가 위경도)",
    "15109351": "제주관광공사 마을숙박업소 (위경도·객실수)",
    "15056410": "서귀포시 안전인증지정민박 (위경도)",
    "15010850": "제주 버스정류소 현황 (위경도)",
    "15051473": "서귀포 시내버스 노선 현황",
    "15051472": "읍면지선버스 노선 현황",
    "15056324": "제주 전세버스 업체 현황 (차량 대수)",
    "15074691": "업종별 카드 매출과 매장수 (법정동·월별, 2017-01~2020-04)",
    "15157484": "감귤 선과장 등록업체",
    "15139914": "노지감귤 관측조사 (단위면적당 나무 수)",
}
BOUNDARY_URL = (
    "https://raw.githubusercontent.com/southkorea/southkorea-maps/master/"
    "kostat/2013/json/skorea_submunicipalities_geo_simple.json"
)


def _open(opener, url: str, data: dict | None = None, timeout: int = 300) -> bytes:
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    headers = dict(UA)
    if body:
        headers["X-Requested-With"] = "XMLHttpRequest"
    for attempt in range(4):
        try:
            return opener.open(urllib.request.Request(url, data=body, headers=headers), timeout=timeout).read()
        except urllib.error.HTTPError:
            raise
        except OSError:
            if attempt == 3:
                raise
            time.sleep(2 ** (attempt + 1))
    raise RuntimeError("unreachable")


def download_datago(pk: str) -> pathlib.Path:
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    page = _open(opener, f"https://www.data.go.kr/data/{pk}/fileData.do").decode("utf-8", "ignore")
    detail = re.search(r'id="publicDataDetailPk"[^>]*value="([^"]+)"', page).group(1)
    info = json.loads(_open(
        opener,
        "https://www.data.go.kr/tcs/dss/selectFileDataDownload.do",
        {"publicDataPk": pk, "publicDataDetailPk": detail, "fileDetailSn": "1"},
    ))
    meta = info.get("fileDataRegistVO") or info
    name = meta.get("orginlFileNm") or f"{pk}.csv"
    raw = _open(opener, "https://www.data.go.kr/cmm/cmm/fileDownload.do?" + urllib.parse.urlencode(
        {"atchFileId": meta["atchFileId"], "fileDetailSn": meta.get("fileDetailSn", 1), "dataNm": name}))
    out = RAW / f"{pk}{pathlib.Path(name).suffix or '.csv'}"
    out.write_bytes(raw)
    return out


def main() -> int:
    RAW.mkdir(parents=True, exist_ok=True)
    failed = 0
    for pk, label in DATASETS.items():
        try:
            path = download_datago(pk)
            print(f"ok   {pk} {label} -> {path.name} ({path.stat().st_size:,} bytes)")
        except Exception as e:  # noqa: BLE001 - report and continue with the rest
            failed += 1
            print(f"FAIL {pk} {label}: {e!r}")
    try:
        (RAW / "skorea_submunicipalities_geo_simple.json").write_bytes(
            _open(urllib.request.build_opener(), BOUNDARY_URL))
        print("ok   행정경계 (southkorea-maps, 통계청 2013)")
    except Exception as e:  # noqa: BLE001
        failed += 1
        print(f"FAIL 행정경계: {e!r}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

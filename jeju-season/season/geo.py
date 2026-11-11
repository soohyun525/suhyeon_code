"""거리 계산과 셔틀 노선 순서 정하기."""
from __future__ import annotations

import math
from collections.abc import Sequence

import numpy as np

ROAD_FACTOR = 1.35  # 직선거리 → 도로거리 보정 (제주 농로·마을길 기준 가정)


def haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 6371.0 * 2 * np.arcsin(np.sqrt(a))


def road_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    return float(haversine_km(a[0], a[1], b[0], b[1])) * ROAD_FACTOR


def tour_length(points: Sequence[tuple[float, float]], order: Sequence[int], start: tuple[float, float]) -> float:
    path = [start, *(points[i] for i in order)]
    return sum(road_km(path[i], path[i + 1]) for i in range(len(path) - 1))


def order_stops(start: tuple[float, float], points: Sequence[tuple[float, float]]) -> list[int]:
    """출발지에서 모든 농가를 한 번씩 들르는 순서 (최근접 이웃 후 2-opt 개선). 돌아오는 길은 역순."""
    n = len(points)
    if n <= 1:
        return list(range(n))
    left, order, cur = set(range(n)), [], start
    while left:
        nxt = min(left, key=lambda i: road_km(cur, points[i]))
        order.append(nxt)
        left.remove(nxt)
        cur = points[nxt]
    improved = True
    while improved:
        improved = False
        for i in range(n - 1):
            for j in range(i + 1, n):
                cand = order[:i] + order[i:j + 1][::-1] + order[j + 1:]
                if tour_length(points, cand, start) + 1e-9 < tour_length(points, order, start):
                    order, improved = cand, True
    return order


def split_by_angle(center: tuple[float, float], points: Sequence[tuple[float, float]],
                   loads: Sequence[int], capacity: int) -> list[list[int]]:
    """좌석 수를 넘으면 출발지 기준 방향(각도)으로 농가를 나눠 차량별 묶음을 만든다."""
    idx = sorted(range(len(points)), key=lambda i: math.atan2(points[i][0] - center[0], points[i][1] - center[1]))
    groups, cur, used = [], [], 0
    for i in idx:
        if cur and used + loads[i] > capacity:
            groups.append(cur)
            cur, used = [], 0
        cur.append(i)
        used += loads[i]
    if cur:
        groups.append(cur)
    return groups

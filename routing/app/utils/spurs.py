from concurrent.futures import ThreadPoolExecutor
from typing import Callable

import numpy as np

M_LAT = 110540.0
M_LON = 111320.0

def _to_m(xy: np.ndarray, lat0: float) -> np.ndarray:
    k = np.cos(np.radians(lat0))
    return np.column_stack((xy[:, 0] * M_LON * k, xy[:, 1] * M_LAT))

def nearest_on_polyline(p, track: np.ndarray, lo: int, hi: int) -> tuple[float, int]:
    seg = _to_m(np.asarray(track[lo:hi + 1, :2], float), p[1])
    P = _to_m(np.asarray([p[:2]], float), p[1])[0]
    A, B = seg[:-1], seg[1:]
    AB = B - A
    t = np.clip(((P - A) * AB).sum(1) / np.maximum((AB ** 2).sum(1), 1e-9), 0.0, 1.0)
    d = np.hypot(*(A + t[:, None] * AB - P).T)
    j = int(d.argmin())
    return float(d[j]), lo + j


def find_attach(spur: np.ndarray, track: np.ndarray, lo: int, hi: int,
                eps_m: float, from_end: bool):
    order = range(len(spur) - 1, -1, -1) if from_end else range(len(spur))
    for s in order:
        d, j = nearest_on_polyline(spur[s], track, lo, hi)
        if d <= eps_m:
            return s, j
    return None


def build_with_spurs(track: np.ndarray, lengths: np.ndarray,
                     stops: list[tuple[int, list[float]]],
                     route_fn: Callable[[list[float], list[float]], np.ndarray],
                     delta_m: float = 2000.0, eps_m: float = 500.0):
    n = len(track)
    windows, calls = [], []
    for i, lod in stops:
        hi = min(int(np.searchsorted(lengths, lengths[i] + delta_m)), n - 1)
        lo = max(0, min(int(np.searchsorted(lengths, lengths[i] - delta_m)), hi - 1))
        windows.append((lo, hi))
        calls.append((track[lo, :2].tolist(), lod))
        calls.append((lod, track[hi, :2].tolist()))

    with ThreadPoolExecutor(max_workers=8) as ex:
        spurs = list(ex.map(lambda ab: route_fn(*ab), calls))

    parts, splits, cursor = [], [], 0
    total = 0
    for k, (lo, hi) in enumerate(windows):
        out, back = spurs[2 * k], spurs[2 * k + 1]
        lo_e = max(lo, cursor)
        hi_e = max(hi, lo_e + 1)

        r = find_attach(out, track, lo_e, hi_e, eps_m, from_end=True)
        s_out, j_out = r if r else (0, lo_e)
        j_out = max(j_out, cursor)

        chunk = [track[cursor:j_out + 1], out[s_out:]]
        parts += chunk
        total += sum(len(c) for c in chunk)
        splits.append(total - 1)

        r = find_attach(back, track, j_out, hi_e, eps_m, from_end=False)
        s_in, j_in = r if r else (len(back) - 1, hi_e - 1)

        chunk = [back[1:s_in + 1]]
        parts += chunk
        total += sum(len(c) for c in chunk)
        cursor = j_in + 1

    parts.append(track[cursor:])
    return np.vstack(parts), splits
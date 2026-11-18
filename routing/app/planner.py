import numpy as np
import copy
from collections.abc import Sequence
from typing import Any, Literal

from app.routing import create_gpx, brouter_parallel
from app.utils.spurs import build_with_spurs
from app.utils.utils import calculate_route_profile, t_din33466

def _route_pair(a, b) -> np.ndarray:
    """One short brouter request."""
    fc = brouter_parallel([list(a), list(b)])
    coords = fc["features"][0]["geometry"]["coordinates"]
    return np.array([[c[0], c[1], c[2] if len(c) > 2 else np.nan] for c in coords], dtype=float)

def build_stage_matrix(lengths: np.ndarray, ups: np.ndarray, downs: np.ndarray, db_lodgings: list[dict], tmax: float,
                       beta: float, level: Literal["b", "i", "a"] = "i",):
    """
    Builds a matrix of possible hiking stages between route points
    and available lodgings.

    Args:
        lengths: Cumulative route distances in meters.
        ups: Cumulative elevation gains in meters.
        downs: Cumulative elevation losses in meters.
        db_lodgings: List of available lodging dictionaries.
        tmax: Maximum allowed stage duration in hours.
        beta: Relative safety margin applied to estimated stage times.
        level: Hiking speed profile: b - beginner, i - intermediate,
            a - advanced (default).

    Returns:
        tuple:
            - names: Array of candidate point names.
            - idx: Array of indices mapping candidates to route positions.
            - T: Matrix of estimated stage times in hours.
            - dL: Matrix of stage distances in meters.
            - lod_idx: Array mapping candidate points to their lodging indices.
    """
    route_m = np.array([l["route_km"] * 1000 for l in db_lodgings])
    detour_m = np.array([l["distance_m"] for l in db_lodgings])

    pos = np.clip(np.searchsorted(lengths, route_m), 1, len(lengths) - 1)
    left_closer = (route_m - lengths[pos - 1]) < (lengths[pos] - route_m)
    idx_lod = np.where(left_closer, pos - 1, pos)

    idx = np.concatenate([[0], idx_lod, [len(lengths) - 1]])
    detour = np.concatenate([[0.0], detour_m, [0.0]])
    names = np.array(["S"] + [f"D{i}" for i in range(len(db_lodgings))] + ["M"])

    order = np.argsort(lengths[idx], kind="stable")
    idx, detour, names = idx[order], detour[order], names[order]

    L, U, D = lengths[idx], ups[idx], downs[idx]

    dL = (L[None, :] - L[:, None] + detour[:, None] + detour[None, :])
    dH_up = U[None, :] - U[:, None]
    dH_down = D[None, :] - D[:, None]

    mask = L[None, :] > L[:, None]
    T = np.full(dL.shape, np.inf)
    tmin = 4
    T[mask] = t_din33466(dL[mask], dH_up[mask], dH_down[mask], level)
    T[T * (1.0 + beta) > tmax] = np.inf
    T[T < tmin] = np.inf
    lod_idx = np.array([-1] + list(range(len(db_lodgings))) + [-1])[order]

    return names, idx, T, dL, lod_idx, detour

def partition_dp(times: np.ndarray, t_target: float, n: int, node_pen=None):
    """
    Partitions a route into a specified number of stages using dynamic
    programming.
    Args:
        times: Square matrix of estimated transition times in hours.
            Infinite values represent unavailable transitions.
        t_target: Target duration of each stage in hours.
        n: Required number of stages.
    Returns:
        tuple:
            - path: Ordered list of indices defining the selected
                partition boundaries.
            - total_cost: Minimum cumulative partition cost.
    Raises:
        ValueError: If no valid partition exists for the specified number of stages.
    """
    m = times.shape[0]
    cost = (times / t_target - 1) ** 2      # cost function
    if node_pen is not None:
        cost = cost + node_pen[None, :]     # penalty (karaK!)
    #(disp?)
    best = np.full((n + 1, m), np.inf)
    best[0, 0] = 0.0
    prev = np.full((n + 1, m), -1, dtype=int)
    cols = np.arange(m)

    for k in range(1, n + 1):
        cand = best[k - 1][:, None] + cost
        i = cand.argmin(axis=0)
        v = cand[i, cols]
        best[k] = v
        prev[k] = np.where(np.isfinite(v), i, -1)

    if not np.isfinite(best[n, m - 1]):
        raise ValueError(f"No partition found for {n} days with given parameters.")

    path, j = [m - 1], m - 1
    for k in range(n, 0, -1):
        j = prev[k, j]
        path.append(j)
    return path[::-1], float(best[n, m - 1])

def lodgings(path: dict[str, Any], db_lodgings: list[dict], waypoints: Sequence[Sequence[float]],
             n: int, tmax: float, beta: float, level: Literal["b", "i", "a"] = "i") -> dict[str, Any]:
    """
    Splits route to days, adjusts accommodation and generates route segments.

    Args:
        path: Path in GeoJSON format with elevation values.
        db_lodgings: List of available lodgings from database.
        n: Number of trip days.
        tmax: Maximal allowed time of one leg of the route in hours.
        beta: Safety margin.
        level: Difficulty: b - beginner, i - intermediate (default), a - advanced.

    Returns:
        dict[str, Any]: Dictionary containing a total cost of the partition,
            target daily time, segments, segment routes and GPX data.

    Raises:
        ValueError: If the number of days is less than one or no valid
            route partition exists for the given parameters.
    """
    if n < 1:
        raise ValueError("Number of days must be greater at least one.")

    route = np.asarray(path["features"][0]["geometry"]["coordinates"], dtype=float)
    lengths, ups, downs, _ = calculate_route_profile(route)

    t_din = float(t_din33466(lengths[-1], ups[-1], downs[-1], level))
    t_target = t_din / n

    names, idx, T, dL_mat, lod_idx, detour = build_stage_matrix(lengths, ups, downs, db_lodgings, tmax, beta, level)
    DETOUR_W = 0.1
    node_pen = DETOUR_W * (detour / 1000.0) ** 2
    bounds, total_cost = partition_dp(T, t_target, n, node_pen)

    stops, chosen_lodgings = [], []
    for b in bounds[1:]:
        li = int(lod_idx[b])
        if li >= 0:
            lod = db_lodgings[li]
            chosen_lodgings.append(lod)
            stops.append((int(idx[b]), [lod["lon"], lod["lat"]]))

    final, splits = build_with_spurs(route, lengths, stops, _route_pair, delta_m=1000.0, eps_m=20.0)

    ele = final[:, 2]
    bad = np.isnan(ele)
    if bad.any():
        good = np.flatnonzero(~bad)
        final[:, 2] = 0.0 if good.size == 0 else np.interp(np.arange(len(ele)), good, ele[good])

    full_route = copy.deepcopy(path)
    full_route["features"][0]["geometry"]["coordinates"] = final.tolist()
    gpx = create_gpx(full_route, splits, chosen_lodgings)

    f_lengths, f_ups, f_downs, _ = calculate_route_profile(final)
    dL = float(f_lengths[-1])
    dH_up = float(f_ups[-1])
    dH_down = float(f_downs[-1])
    t_din = float(t_din33466(dL, dH_up, dH_down, level))

    stage_times = [float(T[a, b]) for a, b in zip(bounds[:-1], bounds[1:])]
    stage_lengths = [float(dL_mat[a, b]) for a, b in zip(bounds[:-1], bounds[1:])]

    return {
        "dL": dL,
        "lengths": stage_lengths,
        "times": stage_times,
        "approx_t": t_din,
        "target_time": t_target,
        "total_cost": total_cost,
        "asc": dH_up,
        "desc": dH_down,
        "path": full_route,
        "gpx": gpx,
        "lodgings": chosen_lodgings,
    }
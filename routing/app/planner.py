import numpy as np
from collections.abc import Sequence
from typing import Any, Literal

from app.routing import build_distance_matrix, create_gpx, brouter_parallel

speeds = {
    "b": {"h": 3.0, "asc": 225.0, "desc": 375.0},
    "i": {"h": 4.0, "asc": 300.0, "desc": 500.0},
    "a": {"h": 5.0, "asc": 375.0, "desc": 625.0}
}

def t_din33466(dL: float, dH_up: float, dH_down: float, level: Literal["b", "i", "a"] = "i") -> np.ndarray:
    """
    Estimates hiking time according to DIN 33466.

    Args:
        dL: Horizontal route distance in meters.
        dH_up: Total elevation gain in meters.
        dH_down: Total elevation loss in meters.
        level: Hiking speed profile: b - beginner, i - intermediate,
             a - advanced (default).

    Returns:
        np.ndarray: Estimated hiking time in hours.
    """
    dL  = dL / 1000
    t_h = dL / speeds[level]["h"]
    t_v = dH_up / speeds[level]["asc"] + dH_down / speeds[level]["desc"]

    return np.maximum(t_h, t_v) + 0.5 * np.minimum(t_h, t_v)

def smooth(elevation: np.ndarray, w: int = 9) -> np.ndarray:
    """
    Smooths BRouter height noise with moving average.

    Args:
        elevation: (np.ndarray) route elevation values in meters.
        w: (int) Moving average window size (default: 9).

    Returns:
        np.ndarray: Smoothed elevation values.
    """
    if w <= 1 or len(elevation) < w:
        return elevation

    e = np.pad(elevation, w // 2, mode="edge")
    return np.convolve(e, np.ones(w) / w, mode="valid")

def split_indices(coords: np.ndarray, lodgings: list[dict]) -> list[int]:
    """
    Finds the route indices corresponding to the nearest lodging locations.

    Args:
        coords: Array of route coordinates [lon, lat].
        lodgings: Ordered list of lodging dictionaries containing
            'lon' and 'lat' coordinates.

    Returns:
        list[int]: Route indices corresponding to the lodging locations.
    """
    out, start = [], 0
    for l in lodgings:
        k = np.cos(np.radians(l["lat"]))
        d = np.hypot((coords[start:, 0] - l["lon"]) * k, coords[start:, 1] - l["lat"])
        j = int(d.argmin())
        start += j
        out.append(start)
    return out

def calculate_route_profile(route: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Calculates cumulative route length and elevation profiles.

    Args:
        route: Array of coordinates [lon, lat, elevation].

    Returns:
        tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
            - lengths: Cumulative route distance in meters.
            - ups: Cumulative elevation gain in meters.
            - downs: Cumulative elevation loss in meters.
            - ele: Smoothed elevation profile in meters.
    """
    lon, lat = route[:, 0], route[:, 1]
    ele = smooth(route[:, 2])

    coords = np.column_stack([lon, lat])
    dz = np.diff(ele)

    distance_matrix = build_distance_matrix(coords)
    segments = np.diag(distance_matrix, k=1)

    lengths = np.concatenate([[0], np.cumsum(segments)])
    ups = np.concatenate([[0], np.cumsum(np.clip(dz, 0, None))])
    downs = np.concatenate([[0], np.cumsum(np.clip(-dz, 0, None))])

    return lengths, ups, downs, ele

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
    T[mask] = t_din33466(dL[mask], dH_up[mask], dH_down[mask], level)
    T[T * (1.0 + beta) > tmax] = np.inf
    lod_idx = np.array([-1] + list(range(len(db_lodgings))) + [-1])[order]

    return names, idx, T, dL, lod_idx

def partition_dp(times: np.ndarray, t_target: float, n: int):
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
    cost = (times / t_target - 1) ** 2

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

    route = np.asarray(path["features"][0]["geometry"]["coordinates"])
    lengths, ups, downs, ele = calculate_route_profile(route)

    dL = lengths[-1]
    dH_up = ups[-1]
    dH_down = downs[-1]

    t_din = float(t_din33466(dL, dH_up, dH_down, level))
    t_target = t_din / n

    names, idx, T, dL_mat, lod_idx = build_stage_matrix(lengths, ups, downs, db_lodgings, tmax, beta, level)
    path, total_cost = partition_dp(T, t_target, n)

    waypoints = np.asarray(waypoints, dtype=float)
    waypoint_indices = set()
    search_from = 0

    for wp in waypoints[1:-1]:
        k = np.cos(np.radians(wp[1]))
        d = np.hypot(
            (route[search_from:, 0] - wp[0]) * k,
            route[search_from:, 1] - wp[1]
        )

        wp_idx = search_from + int(d.argmin())
        waypoint_indices.add(wp_idx)
        search_from = wp_idx

    full_path = []
    chosen_lodgings = []
    sample_distance = 5000
    sampled_indices = np.searchsorted(lengths,np.arange(0, lengths[-1], sample_distance))
    sampled_indices = np.unique(np.append(sampled_indices, len(route) - 1))

    for a, b in zip(path[:-1], path[1:]):
        start_idx = idx[a]
        end_idx = idx[b]

        selected = set(sampled_indices[(sampled_indices > start_idx) & (sampled_indices < end_idx)].tolist())
        selected.update([start_idx, end_idx])

        selected.update(wp_idx for wp_idx in waypoint_indices if start_idx < wp_idx <= end_idx)

        segment_indices = sorted(selected)
        segment = route[segment_indices, :2].tolist()

        if full_path and segment:
            segment = segment[1:]

        full_path.extend(segment)

        li = int(lod_idx[b])
        if li >= 0:
            lod = db_lodgings[li]
            chosen_lodgings.append(lod)
            full_path.append([lod["lon"], lod["lat"]])

    full_route = brouter_parallel(full_path)

    coords = full_route["features"][0]["geometry"]["coordinates"]
    final = np.array([[c[0], c[1], c[2] if len(c) > 2 else np.nan] for c in coords], dtype=float)
    ele = final[:, 2]
    mask = np.isnan(ele)
    if mask.any():
        good = np.flatnonzero(~mask)
        if good.size == 0:
            final[:, 2] = 0.0
        else:
            final[:, 2] = np.interp(np.arange(len(ele)), good, ele[good])

    full_route["features"][0]["geometry"]["coordinates"] = final.tolist()
    splits = split_indices(final[:, :2], chosen_lodgings)
    gpx = create_gpx(full_route, splits, chosen_lodgings)

    f_lengths, f_ups, f_downs, _ = calculate_route_profile(final)

    dL = float(f_lengths[-1])
    dH_up = float(f_ups[-1])
    dH_down = float(f_downs[-1])
    t_din = float(t_din33466(dL, dH_up, dH_down, level))

    stage_times = [float(T[a, b]) for a, b in zip(path[:-1], path[1:])]
    stage_lengths = [float(dL_mat[a, b]) for a, b in zip(path[:-1], path[1:])]

    return {
        "dL": dL,
        "lengths": stage_lengths,
        "times": stage_times,
        "approx_t": t_din,
        "target_time": t_target,
        "total_cost": total_cost,
        "asc":  dH_up,
        "desc": dH_down,
        "path": full_route,
        "gpx":  gpx,
        "lodgings": chosen_lodgings,
    }
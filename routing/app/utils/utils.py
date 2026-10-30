import numpy as np
from collections.abc import Sequence
from typing import Literal

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

def build_distance_matrix(coordinates: Sequence[Sequence[float]]) -> np.ndarray :
    """
    Builds a pairwise distance matrix using the Haversine formula.

    Args:
        coordinates (list, array_like): list of [lon, lat] points in DD (Decimal Degrees) form.
    Returns:
        np.ndarray: distance matrix for combinations between given coordinates.
    """
    coords = np.asarray(coordinates)
    lon = np.radians(coords[:, 0])
    lat = np.radians(coords[:, 1])
    dlon = lon[:, None] - lon[None, :]
    dlat = lat[:, None] - lat[None, :]

    a = (np.sin(dlat / 2.0) ** 2+ np.cos(lat[:, None])* np.cos(lat[None, :])* np.sin(dlon / 2.0) ** 2)
    a = np.clip(a, 0.0, 1.0)

    earth_radius_m = 6371000.0
    return 2.0 * earth_radius_m * np.arcsin(np.sqrt(a))

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
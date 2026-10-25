import csv
import statistics
import time

import routing

COORDINATES = [  # 10 point route
    [19.5579453, 49.6602669],
    [20.3196611, 49.4225336],
    [19.5293392, 49.5730531],
    [20.1826772, 49.5306781],
    [19.9341067, 49.2510058],
    [20.4580686, 49.4191933],
    [19.9815406, 49.2317892],
    [20.0881081, 49.1795756],
    [20.4403103, 49.4176708],
    [19.9549125, 49.2934661],
]

PROFILES = [
    "fastbike",
    "hiking-mountain",
    "mtb",
    "shortest",
    "trekking",
]

MODES = ["m", "a"]
REPEATS = 10
WARMUP = 0

RAW_CSV = "benchmark_raw.csv"
SUMMARY_CSV = "benchmark_summary.csv"
SUMMARY_MD = "benchmark_summary.md"
BENCHMARK_MD = "benchmark.md"

class RoutingTimer:

    def __init__(self):
        self.profile = None

    def _timed_get(self, url, params=None, **kwargs):
        params = dict(params or {})
        params["profile"] = self.profile
        return self._original_get(url, params=params, **kwargs)

    def __enter__(self):
        self._saved_session = routing._session
        self._original_get = self._saved_session.get
        timer = self

        class _SessionProxy:
            def __getattr__(_, name):
                return getattr(timer._saved_session, name)

            def get(_, *args, **kwargs):
                return timer._timed_get(*args, **kwargs)

        routing._session = _SessionProxy()
        return self

    def __exit__(self, *exc):
        routing._session = self._saved_session


def md_table(header, rows):
    esc = lambda c: str(c).replace("|", "\\|").replace("\n", " ")
    lines = [
        "| " + " | ".join(header) + " |",
        "|" + "|".join(["---"] * len(header)) + "|",
    ]
    lines += [
        "| " + " | ".join(esc(c) for c in row) + " |"
        for row in rows
    ]
    return "\n".join(lines)

def stats(values):
    if not values:
        return {"mean": None, "std": None}

    return {
        "mean": statistics.mean(values),
        "std": statistics.stdev(values) if len(values) > 1 else 0.0,
    }


def fmt(value, digits=3):
    return f"{value:.{digits}f}" if value is not None else "-"

def main():
    raw_rows = []
    summary = {}

    with RoutingTimer() as timer:
        total = len(PROFILES) * len(MODES)
        done = 0

        for profile in PROFILES:
            timer.profile = profile

            for mode in MODES:
                done += 1
                print(f"[{done}/{total}] {profile} / {mode}", flush=True)

                for _ in range(WARMUP):
                    try:
                        routing.path(COORDINATES, mode)
                    except Exception:
                        pass

                totals = []
                errors = 0

                for run in range(1, REPEATS + 1):
                    status, error = "ok", ""
                    start = time.perf_counter()

                    try:
                        routing.path(COORDINATES, mode)
                    except Exception as exc:
                        status = "error"
                        error = f"{type(exc).__name__}: {exc}"
                        errors += 1

                    elapsed = time.perf_counter() - start

                    if status == "ok":
                        totals.append(elapsed)

                    raw_rows.append({
                        "profile": profile,
                        "mode": mode,
                        "run": run,
                        "total_time_s": f"{elapsed:.4f}",
                        "status": status,
                        "error": error[:200],
                    })

                summary[(profile, mode)] = {
                    "total": stats(totals),
                    "min": min(totals) if totals else None,
                    "max": max(totals) if totals else None,
                    "ok": len(totals),
                    "errors": errors,
                }

    raw_fields = [
        "profile",
        "mode",
        "run",
        "total_time_s",
        "status",
        "error",
    ]

    with open(RAW_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=raw_fields)
        writer.writeheader()
        writer.writerows(raw_rows)

    # Summary: only total-time statistics for each mode.
    header = [
        "profile",
        "manual total mean [s]",
        "manual std",
        "manual min",
        "manual max",
        "manual ok/err",
        "auto total mean [s]",
        "auto std",
        "auto min",
        "auto max",
        "auto ok/err",
    ]

    table = []

    for profile in PROFILES:
        manual = summary[(profile, "m")]
        auto = summary[(profile, "a")]

        table.append([
            profile,
            fmt(manual["total"]["mean"]),
            fmt(manual["total"]["std"]),
            fmt(manual["min"]),
            fmt(manual["max"]),
            f'{manual["ok"]}/{manual["errors"]}',
            fmt(auto["total"]["mean"]),
            fmt(auto["total"]["std"]),
            fmt(auto["min"]),
            fmt(auto["max"]),
            f'{auto["ok"]}/{auto["errors"]}',
        ])

    with open(SUMMARY_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(table)

    with open(SUMMARY_MD, "w", encoding="utf-8") as f:
        f.write(md_table(header, table) + "\n")

    # Benchmark Markdown: same reduced columns as the CSV files.
    raw_header = [
        "profile",
        "mode",
        "run",
        "total [s]",
        "status",
        "error",
    ]

    raw_table = [
        [
            row["profile"],
            row["mode"],
            row["run"],
            row["total_time_s"],
            row["status"],
            row["error"] or "-",
        ]
        for row in raw_rows
    ]

    with open(BENCHMARK_MD, "w", encoding="utf-8") as f:
        f.write(
            "# Routing benchmark for different profiles, "
            "automatic and manual modes.\n\n"
        )
        f.write(
            f"Route: {len(COORDINATES)} points, repeats: {REPEATS}, "
            f"warmup: {WARMUP}\n\n"
        )
        f.write("## Data\n\n")
        f.write(md_table(raw_header, raw_table) + "\n\n")
        f.write("## Summary\n\n")
        f.write(md_table(header, table) + "\n")

if __name__ == "__main__":
    main()
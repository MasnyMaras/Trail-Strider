import csv
import statistics
import time

import requests

import routing

COORDINATES = [ # 10 point route
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

class BrouterTimer:

    def __init__(self):
        self.profile = None
        self.last_time = None
        self._original_get = requests.get

    def _timed_get(self, url, params=None, **kwargs):
        params = dict(params or {})
        params["profile"] = self.profile
        start = time.perf_counter()
        try:
            return self._original_get(url, params=params, **kwargs)
        finally:
            self.last_time = time.perf_counter() - start

    def __enter__(self):
        class _RequestsProxy:
            def __getattr__(_, name):
                return getattr(requests, name)

            get = staticmethod(self._timed_get)

        self._saved = routing.requests
        routing.requests = _RequestsProxy()
        return self

    def __exit__(self, *exc):
        routing.requests = self._saved


def run_once(timer: BrouterTimer):
    timer.last_time = None
    return timer

def md_table(header, rows):
    esc = lambda c: str(c).replace("|", "\\|").replace("\n", " ")
    lines = ["| " + " | ".join(header) + " |",
             "|" + "|".join(["---"] * len(header)) + "|"]
    lines += ["| " + " | ".join(esc(c) for c in row) + " |" for row in rows]
    return "\n".join(lines)

def main():
    raw_rows = []
    summary = {}

    with BrouterTimer() as timer:
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

                times = []
                errors = 0
                for run in range(1, REPEATS + 1):
                    timer.last_time = None
                    status, error = "ok", ""
                    try:
                        routing.path(COORDINATES, mode)
                    except Exception as e:
                        status, error = "error", f"{type(e).__name__}: {e}"
                        errors += 1
                    elapsed = timer.last_time

                    if status == "ok" and elapsed is not None:
                        times.append(elapsed)

                    raw_rows.append({
                        "profile": profile,
                        "mode": mode,
                        "run": run,
                        "brouter_time_s": f"{elapsed:.4f}" if elapsed is not None else "",
                        "status": status,
                        "error": error[:200],
                    })

                summary[(profile, mode)] = {
                    "mean": statistics.mean(times) if times else None,
                    "std": statistics.stdev(times) if len(times) > 1 else 0.0 if times else None,
                    "min": min(times) if times else None,
                    "max": max(times) if times else None,
                    "ok": len(times),
                    "errors": errors,
                }

    with open(RAW_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f, fieldnames=["profile", "mode", "run", "brouter_time_s", "status", "error"]
        )
        writer.writeheader()
        writer.writerows(raw_rows)

    def fmt(v):
        return f"{v:.3f}" if v is not None else "-"

    header = [
        "profile",
        "manual mean [s]", "manual std", "manual ok/err",
        "auto mean [s]", "auto std", "auto ok/err",
    ]
    table = []
    for profile in PROFILES:
        m = summary[(profile, "m")]
        a = summary[(profile, "a")]
        table.append([
            profile,
            fmt(m["mean"]), fmt(m["std"]), f'{m["ok"]}/{m["errors"]}',
            fmt(a["mean"]), fmt(a["std"]), f'{a["ok"]}/{a["errors"]}',
        ])

    with open(SUMMARY_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(table)

    md = ["| " + " | ".join(header) + " |",
          "|" + "|".join(["---"] * len(header)) + "|"]
    md += ["| " + " | ".join(row) + " |" for row in table]
    with open(SUMMARY_MD, "w", encoding="utf-8") as f:
        f.write(md_table(header, table) + "\n")

    raw_header = ["profile", "mode", "run", "time [s]", "status", "error"]
    raw_table = [
        [r["profile"], r["mode"], r["run"], r["brouter_time_s"] or "-",
         r["status"], r["error"] or "-"]
        for r in raw_rows
    ]
    with open(BENCHMARK_MD, "w", encoding="utf-8") as f:
        f.write("# Routing benchmark for different profiles, automatic and manual modes.\n\n")
        f.write(f"Route: {len(COORDINATES)} points, repeats: {REPEATS}, "
                f"warmup: {WARMUP}\n\n")
        f.write("## Data\n\n")
        f.write(md_table(raw_header, raw_table) + "\n\n")
        f.write("## Summary\n\n")
        f.write(md_table(header, table) + "\n")

if __name__ == "__main__":
    main()
import argparse
import os
import statistics
import time

import requests

TRAILS = {
    1: [
        [19.941455150601712, 50.06545376198588],
        [19.941361666915128, 50.064851554816244],
        [19.936329128884182, 50.06200403575144],
        [19.939443089517994, 50.06164760602559],
        [19.937351022932205, 50.061694095480874],
        [19.933398115821433, 50.06164872135474],
        [19.936092208858724, 50.05921432425811],
        [19.935989256296864, 50.0543963661635],
        [19.94723509782756, 50.046891220205566],
        [19.944701423807714, 50.051739856377196],
    ],
    2: [
        [19.82733052790772, 50.20356151981676],
        [19.830389324122507, 50.211873124363024],
        [19.827438046225154, 50.20263018714567],
        [19.82887051575713, 50.19608611498714],
        [19.83195190236816, 50.196815105517544],
        [19.83685894621985, 50.19245070353833],
        [19.815368677796215, 50.2045809954609],
        [19.81888613584192, 50.20164289746543],
        [19.782992031054846, 50.24290214644739],
        [19.78009488058123, 50.24415931576763],
    ],
    3: [
        [20.42912977328149, 49.440874068001506],
        [20.440347992228368, 49.417655150238886],
        [20.4342508986868, 49.42256502790204],
        [20.420305134230375, 49.42010231768904],
        [20.41421829800231, 49.4138275438313],
        [20.40808573586054, 49.41058031531185],
        [20.409491138101288, 49.39513783593182],
        [20.45970166662599, 49.422966036036826],
        [20.416037938407783, 49.39923511702426],
        [20.487758568921038, 49.42890203125532],
    ],
    4: [
        [19.949981367466734, 49.61124236132102],
        [20.008157875151937, 49.58273557233065],
        [20.039696911436266, 49.560135051295674],
        [20.118444603614506, 49.54365393454961],
        [20.13156833606621, 49.545390180928905],
        [20.252945578892053, 49.56494774108148],
        [20.255586215956868, 49.563647645784556],
        [20.339038672263513, 49.489303235762435],
        [20.301492800593365, 49.450713208150376],
        [20.313117740320223, 49.43494024664844],
    ],
    5: [
        [19.88938396229247, 49.2908101724654],
        [19.858758257501307, 49.22915635662304],
        [19.86445128037863, 49.22243646984512],
        [19.919158593954933, 49.23591616005464],
        [19.932268409839992, 49.23646485392047],
        [19.9340638925502, 49.250975383476316],
        [19.981692282225907, 49.23235250229516],
        [20.028773945750004, 49.218367398708466],
        [20.048614882917548, 49.21361172992815],
        [20.08810138195261, 49.17957512138122],
    ],
    6: [
        [19.780092629173026, 50.244155400852264],
        [19.82887181885502, 50.19608625738681],
        [19.937350360881055, 50.061697380493484],
        [19.936046989300763, 50.054410934579835],
        [20.44031769336172, 49.41767684420316],
        [20.414199944599233, 49.413818518530576],
        [20.11843648673849, 49.543663370235606],
        [20.33902810651452, 49.4892954538567],
        [19.919158612989094, 49.23594281201386],
        [20.088107361661173, 49.17957540385191],
    ],
}

MODES = ["a", "m"]
MODE_NAMES = {"a": "auto", "m": "ręczny"}

def measure(url, points, mode, timeout):
    t0 = time.perf_counter()
    try:
        r = requests.post(
            f"{url}/route",
            json={"points": points, "mode": mode},
            timeout=timeout,
        )
        elapsed = time.perf_counter() - t0  # czas do otrzymania odpowiedzi
    except requests.RequestException as e:
        return {"ok": False, "time": time.perf_counter() - t0, "error": type(e).__name__}

    if r.status_code != 200:
        return {"ok": False, "time": elapsed, "error": f"HTTP {r.status_code}"}
    try:
        return {"ok": True, "time": elapsed, "data": r.json()}
    except ValueError:
        return {"ok": False, "time": elapsed, "error": "incorrect JSON format"}

def fmt_hms(seconds):
    s = int(round(seconds))
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}"

def fmt_km(meters):
    return f"{meters / 1000:.2f}"

def fmt_dev(t, mean):
    d = t - mean
    pct = d / mean * 100 if mean else 0.0
    return f"{d:+.3f} s ({pct:+.1f}%)"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=os.environ.get("ROUTING_URL"))
    ap.add_argument("--runs", type=int, default=10)
    ap.add_argument("--timeout", type=float, default=60)
    ap.add_argument("--out", default="benchmark_routing.md")
    args = ap.parse_args()

    results = {t: {m: [] for m in MODES} for t in TRAILS}
    info = {t: {m: None for m in MODES} for t in TRAILS}

    total = len(TRAILS) * len(MODES) * args.runs
    done = 0
    for trail, points in TRAILS.items():
        for run in range(args.runs):
            for mode in MODES:
                res = measure(url, points, mode, args.timeout)
                results[trail][mode].append(res)
                if res["ok"] and info[trail][mode] is None:
                    d = res["data"]
                    info[trail][mode] = {
                        "dist": d.get("total_distance_meters"),
                        "dur": d.get("estimated_duration_seconds"),
                    }
                done += 1
                status = f"{res['time']:.3f}s" if res["ok"] else f"ERROR ({res['error']})"
                print(f"[{done}/{total}] route {trail}, mode {mode}, run {run + 1}: {status}")

    means = {}
    for t in TRAILS:
        for m in MODES:
            ok = [r["time"] for r in results[t][m] if r["ok"]]
            means[(t, m)] = statistics.mean(ok) if ok else None

    lines = []
    w = lines.append
    w("# Routing time benchmarks")
    w("")

    w("## All Measurements")
    w("")
    w("| Route | Run | Automatic: Time [s] | Automatic: Deviation from Mean | Manual: Time [s] | Manual: Deviation from Mean |")
    w("|:-:|:-:|--:|--:|--:|--:|")
    for t in TRAILS:
        for i in range(args.runs):
            cells = []
            for m in MODES:
                r = results[t][m][i]
                if r["ok"] and means[(t, m)]:
                    cells += [f"{r['time']:.3f}", fmt_dev(r["time"], means[(t, m)])]
                else:
                    cells += [f"error ({r.get('error', '?')})", "–"]
            w(f"| {t} | {i + 1} | " + " | ".join(cells) + " |")
    w("")

    w("## Summary")
    w("")
    w("| Route |  Mode  | ok / total | Best time [s] | Worst time [s] | Mean [s] |  std [s] | Route length [km] | Estimated travel time [hh:mm:ss] |")
    w("|:-:|:-:|:-:|--:|--:|--:|--:|--:|:-:|")
    for t in TRAILS:
        for m in MODES:
            rs = results[t][m]
            ok = [r["time"] for r in rs if r["ok"]]
            cnt = f"{len(ok)} / {len(rs)}"
            if ok:
                std = statistics.pstdev(ok) if len(ok) > 1 else 0.0
                stats = [f"{min(ok):.3f}", f"{max(ok):.3f}", f"{statistics.mean(ok):.3f}", f"{std:.3f}"]
            else:
                stats = ["–"] * 4
            inf = info[t][m]
            if inf and inf["dist"] is not None and inf["dur"] is not None:
                params = [fmt_km(inf["dist"]), fmt_hms(inf["dur"])]
            else:
                params = ["–", "–"]
            w(f"| {t} | {MODE_NAMES[m]} | {cnt} | " + " | ".join(stats + params) + " |")
    w("")

    with open(args.out, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

if __name__ == "__main__":
    main()
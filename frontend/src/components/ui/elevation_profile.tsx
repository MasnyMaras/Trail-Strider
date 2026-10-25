import {
    AreaChart,
    XAxis,
    YAxis,
    Area,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
} from "recharts"
import type { ElevationPoint } from "@/types/route"

interface ElevationProfileProps {
    data?: ElevationPoint[]
}

const testData: ElevationPoint[] = [
    { distance_meters: 0, elevation_meters: 312 },
    { distance_meters: 400, elevation_meters: 326 },
    { distance_meters: 800, elevation_meters: 341 },
    { distance_meters: 1200, elevation_meters: 335 },
    { distance_meters: 1600, elevation_meters: 358 },
    { distance_meters: 2000, elevation_meters: 374 },
    { distance_meters: 2400, elevation_meters: 366 },
    { distance_meters: 2800, elevation_meters: 391 },
    { distance_meters: 3200, elevation_meters: 405 },
    { distance_meters: 3600, elevation_meters: 398 },
    { distance_meters: 4000, elevation_meters: 421 },
]

function formatDistance(value: number, useKilometers: boolean) {
    return useKilometers
        ? `${(value / 1000).toFixed(1)} km`
        : `${Math.round(value)} m`
}

export default function ElevationProfile({
    data = testData,
}: ElevationProfileProps) {
    const useKilometers = (data.at(-1)?.distance_meters ?? 0) >= 1000

    return (
        <div className="w-full rounded-xl border border-white/60 bg-white/60 p-3 shadow-sm backdrop-blur-sm">
            <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="font-['Luckiest_Guy'] text-lg tracking-wide text-green-700">
                    Profil wysokościowy
                </h3>
                <span className="text-xs font-semibold text-slate-400">
                    Wysokość (m)
                </span>
            </div>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                    >
                        <defs>
                            <linearGradient id="elevation-fill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#15803d" stopOpacity={0.35} />
                                <stop offset="95%" stopColor="#15803d" stopOpacity={0.04} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#cbd5e1" strokeDasharray="3 3" opacity={0.55} />
                        <XAxis
                            dataKey="distance_meters"
                            tickFormatter={(value: number) =>
                                useKilometers
                                    ? `${(value / 1000).toFixed(1)}`
                                    : `${Math.round(value)}`
                            }
                            tick={{ fill: "#64748b", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            label={{
                                value: useKilometers ? "Dystans (km)" : "Dystans (m)",
                                position: "insideBottom",
                                offset: -4,
                                fill: "#64748b",
                                fontSize: 11,
                            }}
                        />
                        <YAxis
                            dataKey="elevation_meters"
                            tickFormatter={(value: number) => `${Math.round(value)}`}
                            tick={{ fill: "#64748b", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            width={42}
                        />
                        <Tooltip
                            labelFormatter={(value) =>
                                `Dystans: ${formatDistance(Number(value), useKilometers)}`
                            }
                            formatter={(value) => [
                                `${Math.round(Number(value))} m`,
                                "Wysokość",
                            ]}
                            contentStyle={{
                                border: "1px solid #dcfce7",
                                borderRadius: "0.75rem",
                                backgroundColor: "rgba(255, 255, 255, 0.95)",
                                boxShadow: "0 4px 12px rgba(15, 23, 42, 0.1)",
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="elevation_meters"
                            stroke="#15803d"
                            strokeWidth={2.5}
                            fill="url(#elevation-fill)"
                            dot={false}
                            activeDot={{ r: 5, fill: "#15803d", stroke: "#ffffff", strokeWidth: 2 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
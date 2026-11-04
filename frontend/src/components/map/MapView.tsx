import { useEffect, useRef } from "react"
// import { Map, NavigationControl, setWorkerUrl, Popup, Marker } from "maplibre-gl"    // SEBKUC
import { Map, NavigationControl, setWorkerUrl, Popup, Marker, type GeoJSONSource } from "maplibre-gl" // SEBKUC [mapa-regiony]
import "maplibre-gl/dist/maplibre-gl.css"
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
import { ScaleControl } from "./Scale"
import { MARTIN_URL, REGIONS, type RegionId } from "./Regions" // SEBKUC [mapa-regiony]
import type { Coordinates, RoutePoint, RouteGeoJson, SinglePointRole } from "@/types/route"

const REGION_SOURCE_NAMES: Record<RegionId, string> = {
    malopolskie: "województwo małopolskie",
    pomorskie: "województwo pomorskie",
    maramures: "Maramureș",
}

setWorkerUrl(maplibreWorkerUrl)
interface MapViewProps {
    isSidebarOpen: boolean
    regionId: RegionId // SEBKUC [mapa-regiony]
    onRegionChange: (regionId: RegionId) => void
    isRouteLoading: boolean
    singlePointRole: SinglePointRole
    isAutoMode: boolean
    automaticWaypoints?: Coordinates[]
    points: RoutePoint[]
    onAddPoint: (coords: [number, number], mode: "start" | "end" | "middle") => void
    onRemovePoint: (id: string) => void
    routeGeoJson?: RouteGeoJson
}

// SEBKUC
// export function MapView({ isSidebarOpen, points, onAddPoint, onRemovePoint }: MapViewProps) {
//     const mapContainerRef = useRef<HTMLDivElement>(null)
//     const mapRef = useRef<Map | null>(null)
//     const activeMarkersRef = useRef<Marker[]>([])
//     const tempMarkerRef = useRef<Marker | null>(null)
//     const pointsRef = useRef(points)
//     useEffect(() => {
//         pointsRef.current = points
//     }, [points])

// SEBKUC
export function MapView({ isSidebarOpen, regionId, onRegionChange, isRouteLoading, singlePointRole, isAutoMode, automaticWaypoints, points, onAddPoint, onRemovePoint, routeGeoJson }: MapViewProps) { // [mapa-regiony]
    const mapContainerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<Map | null>(null)
    const regionRequestRef = useRef(0)
    const regionMoveEndRef = useRef<(() => void) | null>(null)
    const regionIdRef = useRef(regionId)
    const singlePointRoleRef = useRef(singlePointRole)
    const activeMarkersRef = useRef<Marker[]>([])
    const tempMarkerRef = useRef<Marker | null>(null)
    const pointsRef = useRef(points)
    useEffect(() => {
        pointsRef.current = points
    }, [points])
    useEffect(() => {
        regionIdRef.current = regionId
    }, [regionId])
    useEffect(() => {
        singlePointRoleRef.current = singlePointRole
    }, [singlePointRole])
// END SEBKUC

    useEffect(() => {
        if (!mapContainerRef.current) return
        if (mapRef.current) return

        // SEBKUC
        // const styleUrl =
        //     import.meta.env.VITE_MAP_STYLE_URL ||
        //     "https://tiles.openfreemap.org/styles/liberty" // only for testing

        const map = new Map({
            container: mapContainerRef.current,
            // style: styleUrl, // SEBKUC
            style: `${MARTIN_URL}/style/liberty`, // SEBKUC [mapa-regiony]
            center: [19.9449, 49.6091],
            zoom: 9,
        })

        map.addControl(new NavigationControl({ visualizePitch: true }), "top-right")
        map.addControl(new ScaleControl(), "bottom-left")

        map.on("load", () => {
            map.resize()
            if (!map.getLayer("region-click-area")) {
                map.addLayer({
                    id: "region-click-area",
                    type: "fill",
                    source: "map_regions",
                    "source-layer": "map_regions",
                    paint: {
                        "fill-opacity": 0,
                    },
                })
            }
            const topRightControls = document.querySelector('.maplibregl-ctrl-top-right');
            if (topRightControls) {
                topRightControls.classList.add('mt-18', 'mr-2');
            }
        })

        map.on("click", (e) => {
            const target = e.originalEvent.target as HTMLElement
            if (target.closest(".maplibregl-marker") || target.closest(".maplibregl-popup")) {
                return
            }
            const lng = e.lngLat.lng
            const lat = e.lngLat.lat
            const regionFeature = map.queryRenderedFeatures(e.point, {
                layers: ["region-click-area"],
            })[0]

            if (regionFeature?.properties?.name !== REGION_SOURCE_NAMES[regionIdRef.current]) return

            if (tempMarkerRef.current) {
                tempMarkerRef.current.remove()
            }

            const el = document.createElement("div")
            el.className = "relative flex items-center justify-center cursor-pointer"
            el.innerHTML = `
                <span class="absolute h-6 w-6 rounded-full bg-green-500/30 animate-ping"></span>
                <span class="relative h-4 w-4 rounded-full border-2 border-white bg-green-700 shadow-md"></span>
      `

            const popupNode = document.createElement("div")
            popupNode.className = "p-1 font-sans text-slate-800"

            const currentPoints = pointsRef.current
            const hasStart = currentPoints.length === 1
                ? singlePointRoleRef.current === "start"
                : Boolean(currentPoints[0]?.coordinates)
            const hasEnd = currentPoints.length >= 2 && Boolean(currentPoints[currentPoints.length - 1]?.coordinates)

            popupNode.innerHTML = `
                <div class="mb-2">
                  <p class="text-[11px] font-bold uppercase tracking-wider text-green-700">Wybrany punkt</p>
                  <p class="text-xs font-mono text-slate-500">${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
                </div>
                <div class="flex flex-col gap-1.5 pt-1 border-t border-slate-100">
                  ${
                        !hasStart
                            ? `<button id="btn-start" class="w-full rounded-md bg-green-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-green-800 transition">Ustaw jako Start</button>`
                            : !hasEnd
                                ? `
                        <button id="btn-end" class="w-full rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 transition">Ustaw jako Cel</button>
                      `
                                : `
                        <button id="btn-middle" class="w-full rounded-md bg-green-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-green-800 transition">Dodaj do trasy</button>
                        <button id="btn-end" class="w-full rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 transition">Zmień cel na ten punkt</button>
                      `
                    }
                </div>
      `

            const popup = new Popup({ offset: 12, closeButton: false })
                .setDOMContent(popupNode)
                .setLngLat([lng, lat])

            const tempMarker = new Marker({ element: el })
                .setLngLat([lng, lat])
                .setPopup(popup)
                .addTo(map)

            tempMarker.togglePopup()
            tempMarkerRef.current = tempMarker

            setTimeout(() => {
                popupNode.querySelector("#btn-start")?.addEventListener("click", () => {
                    onAddPoint([lng, lat], "start")
                    tempMarker.remove()
                })
                popupNode.querySelector("#btn-end")?.addEventListener("click", () => {
                    onAddPoint([lng, lat], "end")
                    tempMarker.remove()
                })
                popupNode.querySelector("#btn-middle")?.addEventListener("click", () => {
                    onAddPoint([lng, lat], "middle")
                    tempMarker.remove()
                })
            }, 0)
        })
        mapRef.current = map

        return () => {
            map.remove()
            mapRef.current = null
        }
    }, [])

    // SEBKUC [mapa-regiony] pokazanie wybranego regionu i ograniczenie widoku do jego prostokąta
    useEffect(() => {
        const map = mapRef.current
        if (!map) return
        let active = true
        const requestId = ++regionRequestRef.current
        const url = `${MARTIN_URL}/${regionId}`
        const abortController = new AbortController()

        map.setMaxBounds(null)
        if (regionMoveEndRef.current) {
            map.off("moveend", regionMoveEndRef.current)
            regionMoveEndRef.current = null
        }
        map.stop()
        fetch(url, { signal: abortController.signal })
            .then((res) => {
                if (!res.ok) throw new Error(`Nie udało się załadować regionu (${res.status})`)
                return res.json()
            })
            .then(({ bounds }) => {
                if (!active || requestId !== regionRequestRef.current) return
                const showRegion = () => {
                    if (!active || requestId !== regionRequestRef.current) return
                    const currentStyle = map.getStyle()
                    const openMapTilesSource = currentStyle.sources.openmaptiles
                    if (!openMapTilesSource || openMapTilesSource.type !== "vector") {
                        console.error("Region: brak wektorowego źródła openmaptiles")
                        return
                    }

                    map.setStyle({
                        ...currentStyle,
                        sources: {
                            ...currentStyle.sources,
                            openmaptiles: {
                                ...openMapTilesSource,
                                url,
                            },
                        },
                    }, { diff: false })
                }
                const padding = { top: 140, bottom: 40, left: 20, right: 20 }
                const moveToRegion = () => {
                    if (!active || requestId !== regionRequestRef.current) return
                    if (!map.getLayer("region-click-area")) {
                        map.addLayer({
                            id: "region-click-area",
                            type: "fill",
                            source: "map_regions",
                            "source-layer": "map_regions",
                            paint: {
                                "fill-opacity": 0,
                            },
                        })
                    }
                    map.stop()
                    map.fitBounds(bounds, { animate: true, duration: 1100, padding })
                    const handleMoveEnd = () => {
                        if (requestId === regionRequestRef.current) {
                            map.setMaxBounds(map.getBounds())
                        }
                        regionMoveEndRef.current = null
                    }
                    regionMoveEndRef.current = handleMoveEnd
                    map.once("moveend", handleMoveEnd)
                }

                map.once("styledata", moveToRegion)
                showRegion()
            })
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === "AbortError") return
                if (active) {
                    console.error("Region:", err)
                }
            })

        return () => {
            active = false
            if (regionMoveEndRef.current) {
                map.off("moveend", regionMoveEndRef.current)
                regionMoveEndRef.current = null
            }
            map.stop()
            abortController.abort()
        }
    }, [regionId])
    // END SEBKUC

    useEffect(() => {
        const map = mapRef.current
        if (!map) return

        // Usuwamy stare markery
        activeMarkersRef.current.forEach((m) => m.remove())
        activeMarkersRef.current = []

        points.forEach((pt, index) => {
            if (!pt.coordinates) return
            const isStart = index === 0
            const isEnd = index === points.length - 1 && points.length > 1
            const automaticIndex = isAutoMode
                ? automaticWaypoints?.findIndex(([longitude, latitude]) =>
                    Math.abs(longitude - pt.coordinates![0]) < 0.000001
                    && Math.abs(latitude - pt.coordinates![1]) < 0.000001,
                )
                : -1
            const displayIndex = automaticIndex !== undefined && automaticIndex >= 0
                ? automaticIndex
                : index

            const el = document.createElement("div")
            el.className =
                "flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-lg cursor-pointer hover:ring-2 hover:ring-slate-900"

            if (isStart) {
                el.className += " bg-green-700"
                el.innerText = "A"
            } else if (isEnd) {
                el.className += " bg-rose-600"
                el.innerText = "B"
            } else {
                el.className += " bg-slate-800 text-[10px]"
                el.innerText = displayIndex.toString()
            }

            const popup = new Popup({ offset: 15 }).setHTML(`
                <div class="p-1">
                  <p class="font-bold text-xs text-slate-800">${isStart ? "Początek trasy" : isEnd ? "Koniec trasy" : `Przystanek ${displayIndex}`}</p>
                  <p class="text-[10px] text-slate-500 font-mono">${pt.value}</p>
                </div>
      `)

            const marker = new Marker({ element: el })
                .setLngLat(pt.coordinates)
                .setPopup(popup)
                .addTo(map)

            activeMarkersRef.current.push(marker)
        })
    }, [points, onRemovePoint, isAutoMode, automaticWaypoints])

    useEffect(() => {
        const map = mapRef.current
        if (!map) return

        const sourceId = "route-source"
        const layerId = "route-layer"

        const updateRoute = () => {
            const data = routeGeoJson || { type: "FeatureCollection", features: [] }
            const source = map.getSource(sourceId) as GeoJSONSource | undefined
            if (source) {
                source.setData(data)
            } else {
                map.addSource(sourceId, {
                    type: "geojson",
                    data: data
                })
                map.addLayer({
                    id: layerId,
                    type: "line",
                    source: sourceId,
                    layout: {
                        "line-join": "round",
                        "line-cap": "round"
                    },
                    paint: {
                        "line-color": "#15803d",
                        "line-width": 4,
                        "line-opacity": 0.8
                    }
                })
            }
        }

        if (map.isStyleLoaded()) {
            updateRoute()
        } else {
            map.once("styledata", updateRoute)
        }
    }, [routeGeoJson])

    useEffect(() => {
        const rightControls = document.querySelectorAll('.maplibregl-ctrl-top-right');

        const updateTransform = () => {
            rightControls.forEach((ctrl) => {
                const element = ctrl as HTMLElement;
                element.style.transition = 'transform 0.3s ease-in-out';

                if (isSidebarOpen) {
                    if (window.innerWidth >= 1024) {
                        element.style.transform = 'translateX(-500px)';
                    } else if (window.innerWidth >= 768) {
                        element.style.transform = 'translateX(-340px)';
                    } else {
                        element.style.transform = 'translateX(-260px)';
                    }
                } else {
                    element.style.transform = 'translateX(0)';
                }
            });
        };

        updateTransform();
        window.addEventListener('resize', updateTransform);

        return () => window.removeEventListener('resize', updateTransform);
    }, [isSidebarOpen])

    return (
        <div className="absolute inset-0 h-full w-full">
            <div
                ref={mapContainerRef}
                className={`h-full w-full transition-opacity duration-300 ${isRouteLoading ? "opacity-75" : "opacity-100"}`}
            />
            {isRouteLoading && (
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur-sm">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-green-700 border-t-transparent" />
                    Wyznaczanie trasy...
                </div>
            )}
            <div
                className={`region-switcher absolute left-3 top-20 z-10 w-max max-w-[calc(100vw-1.5rem)] rounded-xl border border-white/70 bg-white/90 p-1 shadow-xl shadow-slate-900/10 backdrop-blur-xl transition-transform duration-300 ease-out sm:left-5 sm:top-20 sm:w-auto sm:min-w-0 sm:max-w-none sm:rounded-2xl sm:p-1.5 ${isSidebarOpen ? "lg:-translate-x-[500px] md:-translate-x-[340px] -translate-x-[260px]" : ""}`}
                aria-label="Wybór regionu"
            >
                <div className="hidden items-center gap-1 sm:flex">
                    {REGIONS.map((region) => {
                        const isActive = region.id === regionId

                        return (
                            <button
                                key={region.id}
                                type="button"
                                aria-pressed={isActive}
                                onClick={() => onRegionChange(region.id)}
                                className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-all duration-300 sm:flex-none sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs ${
                                    isActive
                                        ? "bg-green-700 text-white shadow-md shadow-green-900/20"
                                        : "text-slate-600 hover:bg-green-50 hover:text-green-800"
                                }`}
                            >
                                {region.name}
                            </button>
                        )
                    })}
                </div>
                <label className="flex w-max items-center gap-1.5 whitespace-nowrap px-1.5 py-0.5 sm:hidden">
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Region</span>
                    <select
                        value={regionId}
                        onChange={(event) => onRegionChange(event.target.value as RegionId)}
                        className="w-auto bg-transparent py-0.5 text-xs font-semibold text-slate-800 outline-none"
                        aria-label="Wybierz region mapy"
                    >
                        {REGIONS.map((region) => (
                            <option key={region.id} value={region.id}>{region.name}</option>
                        ))}
                    </select>
                </label>
            </div>
        </div>
    )
}

export default MapView
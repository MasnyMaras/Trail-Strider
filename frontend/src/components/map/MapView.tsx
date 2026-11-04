import { useEffect, useRef } from "react"
// import { Map, NavigationControl, setWorkerUrl, Popup, Marker } from "maplibre-gl"    // SEBKUC
import { Map, NavigationControl, setWorkerUrl, Popup, Marker, type VectorTileSource, type GeoJSONSource } from "maplibre-gl" // SEBKUC [mapa-regiony]
import "maplibre-gl/dist/maplibre-gl.css"
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
import { ScaleControl } from "./Scale"
import { MARTIN_URL, type RegionId } from "./Regions" // SEBKUC [mapa-regiony]
import type { RoutePoint, RouteGeoJson } from "@/types/route"

setWorkerUrl(maplibreWorkerUrl)
interface MapViewProps {
    isSidebarOpen: boolean
    regionId: RegionId // SEBKUC [mapa-regiony]
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
export function MapView({ isSidebarOpen, regionId, points, onAddPoint, onRemovePoint, routeGeoJson }: MapViewProps) { // [mapa-regiony]
    const mapContainerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<Map | null>(null)
    const activeMarkersRef = useRef<Marker[]>([])
    const tempMarkerRef = useRef<Marker | null>(null)
    const pointsRef = useRef(points)
    useEffect(() => {
        pointsRef.current = points
    }, [points])
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
            const hasStart = Boolean(currentPoints[0]?.coordinates)
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
                        <button id="btn-middle" class="w-full rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 transition">Dodaj jako przystanek</button>
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
        const url = `${MARTIN_URL}/${regionId}`

        fetch(url)
            .then((res) => res.json())
            .then(({ bounds }) => {
                if (!active) return
                map.setMaxBounds(null)
                // map.fitBounds(bounds, { animate: false })
                //map.setMaxBounds(bounds)      // to powuje że mapa jest ograniczona ale nie widac calego regionu na najdalszym zoomie
                map.fitBounds(bounds, { animate: false, padding: { top: 140, bottom: 40, left: 20, right: 20 } }) // miejsce na nagłówek i pasek wyszukiwania
                map.setMaxBounds(map.getBounds()) // granica = widok całego regionu
                const showRegion = () => map.getSource<VectorTileSource>("openmaptiles")?.setUrl(url)
                if (map.isStyleLoaded()) showRegion()
                else map.once("load", showRegion)
            })
            .catch((err) => console.error("Region:", err))

        return () => { active = false }
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
                el.innerText = index.toString()
            }

            const popup = new Popup({ offset: 15 }).setHTML(`
                <div class="p-1">
                  <p class="font-bold text-xs text-slate-800">${isStart ? "Początek trasy" : isEnd ? "Koniec trasy" : `Przystanek ${index}`}</p>
                  <p class="text-[10px] text-slate-500 font-mono">${pt.value}</p>
                </div>
      `)

            const marker = new Marker({ element: el })
                .setLngLat(pt.coordinates)
                .setPopup(popup)
                .addTo(map)

            activeMarkersRef.current.push(marker)
        })
    }, [points, onRemovePoint])

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
            <div ref={mapContainerRef} className="h-full w-full" />
        </div>
    )
}

export default MapView
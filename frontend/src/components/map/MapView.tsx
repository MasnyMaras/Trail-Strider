import { useEffect, useRef } from "react"
import { Map, NavigationControl, setWorkerUrl } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"

setWorkerUrl(maplibreWorkerUrl)

export function MapView() {
    const mapContainerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<Map | null>(null)

    useEffect(() => {
        if (!mapContainerRef.current) return
        if (mapRef.current) return

        const styleUrl =
            import.meta.env.VITE_MAP_STYLE_URL ||
            "https://tiles.openfreemap.org/styles/liberty"

        const map = new Map({
            container: mapContainerRef.current,
            style: styleUrl,
            center: [19.9449, 49.6091],
            zoom: 9,
        })

        map.addControl(
            new NavigationControl({ visualizePitch: true }),
            "top-right"
        )

        map.on("load", () => {
            map.resize()
            console.log("Mapa załadowana pomyślnie!")
        })

        map.on("error", (e) => {
            console.error("Błąd mapy:", e)
        })

        mapRef.current = map

        return () => {
            map.remove()
            mapRef.current = null
        }
    }, [])

    return (
        <div className="absolute inset-0 h-full w-full">
            <div ref={mapContainerRef} className="h-full w-full" />
        </div>
    )
}

export default MapView
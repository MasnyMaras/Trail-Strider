import { useEffect, useRef } from "react"
import { Map, NavigationControl, setWorkerUrl } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
import { ScaleControl } from "./Scale"

setWorkerUrl(maplibreWorkerUrl)
interface MapViewProps {
    isSidebarOpen: boolean;
}
export function MapView({ isSidebarOpen }: MapViewProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<Map | null>(null)

    useEffect(() => {
        if (!mapContainerRef.current) return
        if (mapRef.current) return

        const styleUrl =
            import.meta.env.VITE_MAP_STYLE_URL ||
            "https://tiles.openfreemap.org/styles/liberty" // only for testing

        const map = new Map({
            container: mapContainerRef.current,
            style: styleUrl,
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

        mapRef.current = map

        return () => {
            map.remove()
            mapRef.current = null
        }
    }, [])
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
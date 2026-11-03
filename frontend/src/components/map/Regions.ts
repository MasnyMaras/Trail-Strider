// caly plik SEBKUC 


// [mapa-regiony] regiony mapy serwowane przez lokalny serwer kafli Martin
export const MARTIN_URL = import.meta.env.VITE_MARTIN_URL || "http://localhost:3000"

// id = nazwa źródła kafli w Martinie (plik data/tiles/<id>.mbtiles)
export const REGIONS = [
    { id: "malopolskie", name: "Małopolska" },
    { id: "pomorskie", name: "Pomorze" },
    { id: "maramures", name: "Maramureș" },
] as const

export type RegionId = (typeof REGIONS)[number]["id"]


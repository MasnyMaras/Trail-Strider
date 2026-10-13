import type { IControl, Map } from "maplibre-gl"

/**
 * Supported measurement unit systems.
 */
export type ScaleUnit = "metric" | "imperial"

/**
 * Configuration options for the cartographic scale bar.
 */
export interface ScaleOptions {
    /**
     * Maximum target width of the scale bar in screen pixels.
     * @defaultValue 140
     */
    maxWidth?: number

    /**
     * Measurement system used for distance display.
     * @defaultValue "metric"
     */
    unit?: ScaleUnit
}

/**
 * Default configuration parameters.
 */
const DEFAULT_OPTIONS: Required<ScaleOptions> = {
    maxWidth: 180,
    unit: "imperial",
}

/** Conversion constant: 1 international mile in meters. */
const METERS_IN_MILE = 1609.344

/** Conversion constant: feet in one meter. */
const FEET_IN_METER = 3.28084

/** Mean volumetric radius of the Earth in meters (WGS 84). */
const EARTH_RADIUS_METERS = 6371008.8

/**
 * Custom MapLibre GL control that displays a segmented cartographic scale bar.
 *
 * Implements the MapLibre `IControl` interface to render a three-segment
 * alternating bar directly onto the map canvas with sub-pixel label alignment
 * and a text halo for contrast over variable terrain backgrounds.
 */
export class ScaleControl implements IControl {
    private _options: Required<ScaleOptions>
    private _map?: Map
    private _container?: HTMLElement
    private _labelsContainer?: HTMLElement
    private _labels: HTMLElement[] = []
    private _bar?: HTMLElement
    private _unitLabel?: HTMLElement

    /**
     * Creates a new instance of the cartographic scale control.
     *
     * @param options - Optional configuration settings.
     */
    constructor(options?: ScaleOptions) {
        this._options = { ...DEFAULT_OPTIONS, ...options }
    }

    /**
     * Updates the unit system at runtime and recalculates the display.
     *
     * @param unit - Target unit system ("metric" or "imperial").
     */
    public setUnit(unit: ScaleUnit): void {
        this._options.unit = unit
        this._update()
    }

    /**
     * MapLibre IControl lifecycle hook: attaches the control DOM elements to the map container.
     *
     * @param map - Target MapLibre map instance.
     * @returns Root HTMLElement of the control.
     */
    public onAdd(map: Map): HTMLElement {
        this._map = map

        this._container = document.createElement("div")
        this._container.className = "pointer-events-none select-none flex flex-col ml-4 mb-4"

        this._labelsContainer = document.createElement("div")
        this._labelsContainer.className =
            "relative mb-0.5 h-3 text-[10px] font-bold text-slate-900"

        // High-contrast halo outline
        const haloStyle =
            "[text-shadow:_1px_1px_0_#fff,_-1px_-1px_0_#fff,_1px_-1px_0_#fff,_-1px_1px_0_#fff,_0_1px_2px_rgba(255,255,255,0.9)]"

        const labelAlignments = [
            "left-0",
            "left-[33.33%] -translate-x-1/2",
            "left-[66.66%] -translate-x-1/2",
            "right-0 translate-x-1/2",
        ]

        for (let i = 0; i < 4; i++) {
            const span = document.createElement("span")
            span.className = `absolute ${labelAlignments[i]} leading-none ${haloStyle}`
            this._labelsContainer.appendChild(span)
            this._labels.push(span)
        }

        const barRow = document.createElement("div")
        barRow.className = "flex items-center gap-1.5"

        // 3-segment alternating bar
        this._bar = document.createElement("div")
        this._bar.className =
            "flex h-2 overflow-hidden border border-slate-900 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
        this._bar.innerHTML = `
      <div class="h-full flex-1 bg-slate-900"></div>
      <div class="h-full flex-1 border-x border-slate-900 bg-white"></div>
      <div class="h-full flex-1 bg-slate-900"></div>
    `

        this._unitLabel = document.createElement("span")
        this._unitLabel.className = `text-[10px] font-bold text-slate-900 leading-none ${haloStyle}`

        barRow.appendChild(this._bar)
        barRow.appendChild(this._unitLabel)

        this._container.appendChild(this._labelsContainer)
        this._container.appendChild(barRow)

        this._map.on("move", this._update)
        this._update()

        return this._container
    }

    /**
     * MapLibre IControl lifecycle hook: removes event listeners and detaches DOM elements.
     */
    public onRemove(): void {
        if (this._map) {
            this._map.off("move", this._update)
        }
        this._container?.remove()
        this._map = undefined
    }

    /**
     * Calculates geodesic ground distance and updates scale geometry and labels.
     */
    private _update = (): void => {
        if (
            !this._map ||
            !this._container ||
            !this._labelsContainer ||
            !this._bar ||
            !this._unitLabel
        ) {
            return
        }

        // Determine meters per screen pixel at the vertical center of viewport
        const y = this._map.getContainer().clientHeight / 2
        const p1 = this._map.unproject([0, y])
        const p2 = this._map.unproject([100, y])

        // Haversine formula for great-circle distance
        const rad = Math.PI / 180
        const dLat = (p2.lat - p1.lat) * rad
        const dLng = (p2.lng - p1.lng) * rad
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(p1.lat * rad) * Math.cos(p2.lat * rad) * Math.sin(dLng / 2) ** 2
        const distance100Px =
            2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        const metersPerPixel = distance100Px / 100

        // Unit conversion and threshold evaluation
        const isImperial = this._options.unit === "imperial"
        let unitsPerPixel = metersPerPixel
        let unit = "m"
        let isLargeUnit = false
        let divisor = 1

        if (isImperial) {
            const feetPerPixel = metersPerPixel * FEET_IN_METER
            const targetFeet = feetPerPixel * this._options.maxWidth

            if (targetFeet >= 5280) {
                unitsPerPixel = metersPerPixel / METERS_IN_MILE
                unit = "mi"
                isLargeUnit = true
            } else {
                unitsPerPixel = feetPerPixel
                unit = "ft"
            }
        } else {
            const targetMeters = metersPerPixel * this._options.maxWidth
            if (targetMeters >= 1000) {
                unit = "km"
                isLargeUnit = true
                divisor = 1000
            }
        }

        const targetUnits = unitsPerPixel * this._options.maxWidth

        // Normalize step size to cartographic standard subdivisions (1, 2, 2.5, 5 x 10^k)
        const exponent = Math.floor(Math.log10(targetUnits / 3))
        const power = Math.pow(10, exponent)
        const normalized = targetUnits / 3 / power

        let stepMultiplier = 1
        if (normalized >= 5) stepMultiplier = 5
        else if (normalized >= 2.5) stepMultiplier = 2.5
        else if (normalized >= 2) stepMultiplier = 2

        const stepValue = stepMultiplier * power
        const totalValue = stepValue * 3
        const actualWidthPx = Math.round(totalValue / unitsPerPixel)

        const formatNumber = (val: number): string => {
            const displayVal = isLargeUnit && !isImperial ? val / divisor : val
            return Number.isInteger(displayVal)
                ? displayVal.toString()
                : displayVal.toFixed(1)
        }

        this._labelsContainer.style.width = `${actualWidthPx}px`
        this._bar.style.width = `${actualWidthPx}px`

        this._labels[0].textContent = "0"
        this._labels[1].textContent = formatNumber(stepValue)
        this._labels[2].textContent = formatNumber(stepValue * 2)
        this._labels[3].textContent = formatNumber(totalValue)

        this._unitLabel.textContent = unit
    }
}
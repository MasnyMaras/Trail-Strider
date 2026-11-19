import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { searchPlaces, type PlaceSearchResult } from "@/api/places";

interface SearchBarProps {
    isSidebarOpen: boolean;
    onSelectPlace: (place: PlaceSearchResult) => void;
}

export default function SearchBar({ isSidebarOpen, onSelectPlace }: SearchBarProps) {
    const [searchValue, setSearchValue] = useState("");
    const [results, setResults] = useState<PlaceSearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    useEffect(() => {
        const query = searchValue.trim();
        if (query.length < 2) {
            setResults([]);
            setIsLoading(false);
            setError(null);
            return;
        }

        setResults([]);
        setError(null);
        const controller = new AbortController();
        const timeoutId = window.setTimeout(async () => {
            setIsLoading(true);
            setError(null);
            try {
                const places = await searchPlaces(query, controller.signal);
                setResults(places);
            } catch (searchError) {
                if (!controller.signal.aborted) {
                    setResults([]);
                    setError(
                        searchError instanceof Error
                            ? searchError.message
                            : "Nie udało się wyszukać miejsc.",
                    );
                }
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        }, 250);

        return () => {
            window.clearTimeout(timeoutId);
            controller.abort();
        };
    }, [searchValue]);

    const selectPlace = (place: PlaceSearchResult) => {
        setSearchValue(place.name);
        setIsDropdownOpen(false);
        setResults([]);
        onSelectPlace(place);
    };

    return (
        <div
            className={`absolute top-20 z-30 transition-all duration-300 ease-in-out px-4 md:px-0 ${
                isSidebarOpen
                    ? "left-4 right-[300px] md:right-[400px] lg:right-[570px]" 
                    : "left-4 right-16 md:left-24 md:right-20 max-w-xl mx-auto" 
            }`}
        >
            <div className="relative">
                <div className="flex h-12 w-full min-w-0 items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-4 shadow-lg backdrop-blur-md transition-shadow focus-within:shadow-xl">
                    <Search size={20} className="shrink-0 text-green-700" />
                    <input
                        type="search"
                        value={searchValue}
                        onChange={(event) => {
                            setSearchValue(event.target.value);
                            setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        onKeyDown={(event) => {
                            if (event.key === "Escape") setIsDropdownOpen(false);
                            if (event.key === "Enter" && results[0]) {
                                event.preventDefault();
                                selectPlace(results[0]);
                            }
                        }}
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={isDropdownOpen && searchValue.trim().length >= 2}
                        aria-controls="place-search-results"
                        placeholder="Szukaj miejscowości, szlaku lub miejsca..."
                        className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                    />
                    {isLoading && (
                        <span
                            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-green-700 border-t-transparent"
                            aria-label="Wyszukiwanie"
                        />
                    )}
                </div>
                {isDropdownOpen && searchValue.trim().length >= 2 && (
                    <div
                        id="place-search-results"
                        role="listbox"
                        className="absolute left-0 right-0 top-full mt-2 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-xl"
                    >
                        {error ? (
                            <p className="px-4 py-3 text-sm text-rose-700">{error}</p>
                        ) : isLoading && results.length === 0 ? (
                            <p className="px-4 py-3 text-sm text-slate-500">Szukam...</p>
                        ) : results.length === 0 ? (
                            <p className="px-4 py-3 text-sm text-slate-500">Brak pasujących miejsc.</p>
                        ) : (
                            results.map((place) => (
                                <button
                                    key={place.id}
                                    type="button"
                                    role="option"
                                    aria-selected="false"
                                    onClick={() => selectPlace(place)}
                                    className="flex w-full flex-col items-start gap-0.5 px-4 py-2 text-left transition-colors hover:bg-green-50 focus:bg-green-50 focus:outline-none"
                                >
                                    <span className="text-sm font-semibold text-slate-800">{place.name}</span>
                                    <span className="text-xs text-slate-500">
                                        {place.category.replaceAll("_", " ")} · {place.region}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
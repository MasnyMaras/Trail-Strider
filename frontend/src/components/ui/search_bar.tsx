import { Search } from "lucide-react";
import { useState } from "react";

interface SearchBarProps {
    isSidebarOpen: boolean;
}

export default function SearchBar({ isSidebarOpen }: SearchBarProps) {
    const [searchValue, setSearchValue] = useState("");

    return (
        <div
            className={`absolute top-20 z-30 transition-all duration-300 ease-in-out px-4 md:px-0 ${
                isSidebarOpen
                    ? "left-4 right-[300px] md:right-[400px] lg:right-[570px]" 
                    : "left-4 right-16 md:left-24 md:right-20 max-w-xl mx-auto" 
            }`}
        >
            <div className="flex h-12 w-full min-w-0 items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-4 shadow-lg backdrop-blur-md transition-shadow focus-within:shadow-xl">
                <Search
                    size={20}
                    className="shrink-0 text-green-700"
                />

                <input
                    type="text"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder="Szukaj miejsca lub wpisz współrzędne..."
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
            </div>
        </div>
    );
}
export default function Footer() {
    return (
        <footer className="absolute bottom-1 left-1/2 z-10 w-max max-w-[calc(100vw-1.5rem)] -translate-x-1/2 pointer-events-none sm:bottom-4">
            <div className="rounded-full border border-white/40 bg-white/70 px-2.5 py-1 text-slate-700 shadow-sm backdrop-blur-md sm:px-4 sm:py-1.5">
                <p className="text-[9px] font-medium tracking-wide sm:text-xs">
                    &copy; {new Date().getFullYear()} Trail-Strider. Wszelkie prawa zastrzeżone.
                </p>
            </div>
        </footer>
    );
}
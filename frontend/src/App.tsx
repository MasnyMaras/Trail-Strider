//import { Button } from "@/components/ui/button"
import Header from "@/components/ui/header"
import MapView from "@/components/map/MapView"
import Footer from "@/components/ui/footer"
import Sidebar from "@/components/ui/sidebar"
import { useState } from "react";

export function App() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    return (
        <div className="flex min-h-screen flex-col overflow-hidden bg-slate-50">
            <Header />
            <main className="relative flex-1 w-full h-full">
                <MapView isSidebarOpen={isSidebarOpen}/>
                <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
                <Footer />
            </main>
        </div>
    )
}

export default App
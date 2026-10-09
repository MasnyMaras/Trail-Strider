import { Button } from "@/components/ui/button"

export function App() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center ">
                <p className="text-sm">
                    Tailwind CSS & shadcn/ui działają
                </p>
                <Button variant="default" onClick={() => alert("Dziala")}>
                    test
                </Button>
        </div>
    )
}

export default App
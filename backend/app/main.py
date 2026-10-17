from fastapi import FastAPI

app = FastAPI(title="Trail-Strider API")


@app.get("/api/health")
def health():
    return {"status": "ok"}

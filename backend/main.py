import os
import io
import time
import base64
import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from PIL import Image

# ── Config ────────────────────────────────────────────────────
SIGHTENGINE_USER   = os.environ.get("SIGHTENGINE_USER", "YOUR_USER")
SIGHTENGINE_SECRET = os.environ.get("SIGHTENGINE_SECRET", "YOUR_SECRET")
SIGHTENGINE_URL    = "https://api.sightengine.com/1.0/check.json"

# ── App ───────────────────────────────────────────────────────
app = FastAPI(title="Reality Check AI", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request model ─────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    image: str
    tab_url: str = ""

# ── Helpers ───────────────────────────────────────────────────
def get_explanation(probability: float) -> str:
    if probability >= 0.85:
        return "Very strong AI indicators detected. High confidence this image is AI-generated."
    elif probability >= 0.70:
        return "Strong AI indicators detected. This image shows patterns consistent with AI generation."
    elif probability >= 0.50:
        return "Moderate AI indicators detected. This image may have been AI-generated."
    elif probability >= 0.40:
        return "Weak AI indicators present. Treat with mild caution."
    else:
        return "No significant AI artifacts detected. This image appears to be authentic."

def get_confidence_level(probability: float) -> str:
    if probability >= 0.70:
        return "High"
    elif probability >= 0.40:
        return "Moderate"
    return "Low"

def call_sightengine(image_bytes: bytes) -> float:
    try:
        response = requests.post(
            SIGHTENGINE_URL,
            data={
                "models": "genai",
                "api_user": SIGHTENGINE_USER,
                "api_secret": SIGHTENGINE_SECRET
            },
            files={"media": ("image.jpg", image_bytes, "image/jpeg")},
            timeout=15
        )
        response.raise_for_status()
        data = response.json()
        print(f"Sightengine response: {data}")
        return round(float(data["type"]["ai_generated"]), 4)
    except Exception as e:
        print(f"Sightengine error: {e}")
        return 0.0

# ── Endpoints ─────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "model": "sightengine", "version": "1.0"}

@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    start = time.time()

    try:
        if "," in req.image:
            image_data = base64.b64decode(req.image.split(",")[1])
        else:
            image_data = base64.b64decode(req.image)

        image = Image.open(io.BytesIO(image_data)).convert("RGB")
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=85)
        image_bytes = buffer.getvalue()

        ai_probability = call_sightengine(image_bytes)
        elapsed = round((time.time() - start) * 1000)

        return JSONResponse({
            "ai_probability": ai_probability,
            "confidence_level": get_confidence_level(ai_probability),
            "explanation": get_explanation(ai_probability),
            "inference_time_ms": elapsed
        })

    except Exception as e:
        print(f"Analyze error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

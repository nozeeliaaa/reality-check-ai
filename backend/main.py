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
HIVE_API_KEY = os.environ.get("HIVE_API_KEY", "YOUR_KEY_HERE")
HIVE_URL = "https://api.thehive.ai/api/v3/hive/ai-generated-and-deepfake-content-detection"

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
    image: str        # base64 encoded JPEG from extension
    tab_url: str = "" # URL of the tab being scanned

# ── Helpers ───────────────────────────────────────────────────
def get_explanation(probability: float) -> str:
    if probability >= 0.90:
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

def call_hive(image_b64: str) -> dict:
    try:
        response = requests.post(
            HIVE_URL,
            headers={
                "authorization": f"Bearer {HIVE_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "input": [
                    {"media_base64": image_b64}
                ]
            },
            timeout=15
        )
        response.raise_for_status()
        classes = response.json()["output"][0]["classes"]

        ai_score = 0.0
        deepfake_score = 0.0

        for c in classes:
            if c["class"] == "ai_generated":
                ai_score = round(float(c["value"]), 4)
            if c["class"] == "deepfake":
                deepfake_score = round(float(c["value"]), 4)

        return {"ai_score": ai_score, "deepfake_score": deepfake_score}

    except Exception as e:
        print(f"Hive API error: {e}")
        return {"ai_score": 0.0, "deepfake_score": 0.0}

# ── Endpoints ─────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "model": "hive-v3", "version": "1.0"}

@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    start = time.time()

    try:
        # Strip data URL prefix if present
        if "," in req.image:
            image_b64 = req.image.split(",")[1]
        else:
            image_b64 = req.image

        # Compress image before sending
        image_data = base64.b64decode(image_b64)
        image = Image.open(io.BytesIO(image_data)).convert("RGB")
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=85)
        compressed_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        # Call Hive V3
        scores = call_hive(compressed_b64)

        ai_probability = scores["ai_score"]
        elapsed = round((time.time() - start) * 1000)

        return JSONResponse({
            "ai_probability": ai_probability,
            "confidence_level": get_confidence_level(ai_probability),
            "explanation": get_explanation(ai_probability),
            "deepfake_score": scores["deepfake_score"],
            "inference_time_ms": elapsed
        })

    except Exception as e:
        print(f"Analyze error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

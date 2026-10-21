"""Generates product and category photos with Gemini and saves them as WebP.
Usage: python -I gen.py sample | all     (key is read from GEMINI_API_KEY; never printed)
Skips files that already exist, so it can be re-run safely."""
import io, json, os, sys, time, urllib.request
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".pylibs"))
from google import genai
from google.genai import types
from PIL import Image

BASE = os.environ.get("API", "http://localhost:3000/api")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
MODEL = os.environ.get("IMAGE_MODEL", "gemini-2.5-flash-image")
STYLE = ("Professional food photography for a restaurant menu app. Top-down 45-degree view on a rustic dark wooden table, "
         "warm natural light, shallow depth of field, appetising, realistic, no text, no logos, no hands, no people, "
         "centered subject with a little empty space around it. ")

def get(path):
    with urllib.request.urlopen(BASE + path, timeout=30) as r:
        return json.load(r)

def prompt_for(kind, name, desc, category):
    if kind == "category":
        return STYLE + f"A hero image representing the menu category '{name}' of an Italian pizzeria in Germany."
    what = f"{name}" + (f" ({desc})" if desc else "")
    return STYLE + f"The dish: {what}, from the category '{category}' of an Italian pizzeria (Steinofen pizza, German menu). Show only this dish, correctly garnished with the listed ingredients."

def make(client, key, text, path):
    if os.path.exists(path):
        return "skip"
    for attempt in range(3):
        try:
            res = client.models.generate_content(model=MODEL, contents=text,
                config=types.GenerateContentConfig(response_modalities=["IMAGE"], image_config=types.ImageConfig(aspect_ratio="4:3")))
            for part in res.candidates[0].content.parts:
                if part.inline_data:
                    img = Image.open(io.BytesIO(part.inline_data.data)).convert("RGB")
                    img.thumbnail((1024, 1024))
                    os.makedirs(os.path.dirname(path), exist_ok=True)
                    img.save(path, "WEBP", quality=82)
                    return "ok"
            return "no-image"
        except Exception as e:
            msg = str(e)[:160].replace(key, "***")
            if attempt == 2:
                return "error: " + msg
            time.sleep(4 * (attempt + 1))

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "sample"
    key = os.environ["GEMINI_API_KEY"]
    client = genai.Client(api_key=key)
    cats = get("/categories")["items"]
    cname = {c["id"]: c["name"] for c in cats}
    products, cursor = [], None
    while True:
        page = get("/products?limit=100" + (f"&cursor={cursor}" if cursor else ""))
        products += page["items"]
        cursor = page.get("next_cursor")
        if not cursor:
            break
    jobs = [("category", c["slug"], c["name"], c["description"], "", c["id"]) for c in cats]
    jobs += [("product", p["id"], p["name"], p["description"], cname.get(p["category_id"], ""), p["id"]) for p in products]
    if mode == "sample":
        pick = {"Margherita", "Salami", "Calzone", "Softdrinks"}
        jobs = [j for j in jobs if (j[0] == "product" and j[2] in pick) or (j[0] == "category" and j[2] in ("Pizza", "Getränke"))]
    print(len(jobs), "images to make")
    for kind, ident, name, desc, cat, _ in jobs:
        path = os.path.join(OUT, kind + "s", f"{ident}.webp")
        print(f"{kind:8} {name:35} {make(client, key, prompt_for(kind, name, desc, cat), path)}", flush=True)

main()

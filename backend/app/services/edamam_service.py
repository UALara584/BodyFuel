from __future__ import annotations

import os
from typing import Any

import requests


EDAMAM_BASE_URL = "https://api.edamam.com/api/food-database/v2/parser"

def search_edamam_foods(query: str) -> list[dict[str, Any]]:
    app_id = os.getenv("EDAMAM_APP_ID", "").strip()
    app_key = os.getenv("EDAMAM_APP_KEY", "").strip()

    if not app_id or not app_key:
        raise RuntimeError("Faltan EDAMAM_APP_ID o EDAMAM_APP_KEY")

    params = {
        "app_id": app_id,
        "app_key": app_key,
        "ingr": query,
    }

    response = requests.get(EDAMAM_BASE_URL, params=params, timeout=20)
    response.raise_for_status()

    data = response.json()
    hints = data.get("hints", [])

    generic_results: list[dict[str, Any]] = []
    packaged_results: list[dict[str, Any]] = []

    for item in hints:
        food = item.get("food", {})
        nutrients = food.get("nutrients", {})
        category = food.get("category", "")

        result = {
            "nombre": food.get("label", "Desconocido"),
            "calorias": float(nutrients.get("ENERC_KCAL", 0)),
            "proteinas": float(nutrients.get("PROCNT", 0)),
            "carbos": float(nutrients.get("CHOCDF", 0)),
            "grasas": float(nutrients.get("FAT", 0)),
            "fuente": "api",
            "food_id": food.get("foodId"),
            "category": category,
            "image": food.get("image"),
        }

        if category == "Generic foods":
            generic_results.append(result)
        else:
            packaged_results.append(result)

    generic_results = generic_results[:8]
    packaged_results = packaged_results[:4]

    return generic_results + packaged_results

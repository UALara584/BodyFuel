from __future__ import annotations

import os
from typing import Any

import requests

from .food_translation import (
    translate_food_category_to_spanish,
    translate_food_label_to_spanish,
)

EDAMAM_BASE_URL = "https://api.edamam.com/api/food-database/v2/parser"

BLOCKED_TERMS = [
    "chips",
    "crisps",
    "candy",
    "cookie",
    "biscuit",
    "bar",
    "syrup",
    "soda",
    "cola",
    "drink",
    "juice drink",
    "dessert",
    "ice cream",
    "chocolate",
    "snack",
]


def is_clean_food(label: str, category: str) -> bool:
    label_lower = (label or "").lower()
    category_lower = (category or "").lower()

    if "packaged" in category_lower:
        return False

    if any(term in label_lower for term in BLOCKED_TERMS):
        return False

    return True


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

    results: list[dict[str, Any]] = []

    for item in hints:
        food = item.get("food", {})
        nutrients = food.get("nutrients", {})
        label = food.get("label", "Desconocido")
        category = food.get("category", "")

        if not is_clean_food(label, category):
            continue

        results.append(
            {
                "nombre": translate_food_label_to_spanish(label),
                "nombre_original": label,
                "calorias": float(nutrients.get("ENERC_KCAL", 0)),
                "proteinas": float(nutrients.get("PROCNT", 0)),
                "carbos": float(nutrients.get("CHOCDF", 0)),
                "grasas": float(nutrients.get("FAT", 0)),
                "fuente": "api",
                "food_id": food.get("foodId"),
                "category": translate_food_category_to_spanish(category),
                "category_original": category,
                "image": food.get("image"),
            }
        )

    return results[:8]
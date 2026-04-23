from __future__ import annotations

import re
import unicodedata


FOOD_TRANSLATIONS_ES_TO_EN = {
    "platano": "banana",
    "plátano": "banana",
    "banana": "banana",
    "arroz": "rice",
    "arroz blanco": "white rice",
    "arroz integral": "brown rice",
    "pollo": "chicken",
    "pechuga de pollo": "chicken breast",
    "huevo": "egg",
    "claras de huevo": "egg white",
    "salmon": "salmon",
    "salmón": "salmon",
    "atun": "tuna",
    "atún": "tuna",
    "avena": "oats",
    "patata": "potato",
    "batata": "sweet potato",
    "aceite de oliva": "olive oil",
    "manzana": "apple",
    "pera": "pear",
    "fresa": "strawberry",
    "fresas": "strawberries",
    "yogur": "yogurt",
    "yogur griego": "greek yogurt",
    "brocoli": "broccoli",
    "brócoli": "broccoli",
    "leche": "milk",
    "leche desnatada": "skim milk",
    "leche entera": "whole milk",
    "queso": "cheese",
    "pan": "bread",
    "pan integral": "whole wheat bread",
    "lentejas": "lentils",
    "garbanzos": "chickpeas",
    "almendras": "almonds",
    "nueces": "walnuts",
    "tomate": "tomato",
    "pepino": "cucumber",
    "zanahoria": "carrot",
    "pavo": "turkey",
    "ternera": "beef",
    "cerdo": "pork",
}

FOOD_TRANSLATIONS_EN_TO_ES = {
    "banana": "Plátano",
    "white rice": "Arroz blanco",
    "brown rice": "Arroz integral",
    "rice": "Arroz",
    "chicken": "Pollo",
    "chicken breast": "Pechuga de pollo",
    "egg": "Huevo",
    "egg white": "Claras de huevo",
    "salmon": "Salmón",
    "tuna": "Atún",
    "oats": "Avena",
    "potato": "Patata",
    "sweet potato": "Batata",
    "olive oil": "Aceite de oliva",
    "apple": "Manzana",
    "pear": "Pera",
    "strawberry": "Fresa",
    "strawberries": "Fresas",
    "yogurt": "Yogur",
    "greek yogurt": "Yogur griego",
    "broccoli": "Brócoli",
    "milk": "Leche",
    "skim milk": "Leche desnatada",
    "whole milk": "Leche entera",
    "cheese": "Queso",
    "bread": "Pan",
    "whole wheat bread": "Pan integral",
    "lentils": "Lentejas",
    "chickpeas": "Garbanzos",
    "almonds": "Almendras",
    "walnuts": "Nueces",
    "tomato": "Tomate",
    "cucumber": "Pepino",
    "carrot": "Zanahoria",
    "turkey": "Pavo",
    "beef": "Ternera",
    "pork": "Cerdo",
}

CATEGORY_TRANSLATIONS_EN_TO_ES = {
    "generic foods": "Alimentos genéricos",
    "packaged foods": "Alimentos envasados",
    "generic meals": "Comidas genéricas",
}


def normalize_text(text: str) -> str:
    text = text.strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"\s+", " ", text)
    return text


def translate_food_query_to_english(query: str) -> str:
    query_clean = normalize_text(query)
    return FOOD_TRANSLATIONS_ES_TO_EN.get(query_clean, query)


def translate_food_label_to_spanish(label: str) -> str:
    label_clean = normalize_text(label)

    if label_clean in FOOD_TRANSLATIONS_EN_TO_ES:
        return FOOD_TRANSLATIONS_EN_TO_ES[label_clean]

    return label


def translate_food_category_to_spanish(category: str) -> str:
    category_clean = normalize_text(category)

    if category_clean in CATEGORY_TRANSLATIONS_EN_TO_ES:
        return CATEGORY_TRANSLATIONS_EN_TO_ES[category_clean]

    return category
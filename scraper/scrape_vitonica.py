import os
import re
import sys
import time
from typing import List, Tuple

import psycopg2
import requests
from bs4 import BeautifulSoup
from psycopg2.errors import UndefinedTable

SOURCE_URLS = [
    "https://www.vitonica.com/categoria/recetas-saludables/record/20",
    "https://www.vitonica.com/categoria/recetas-saludables/record/40",
    "https://www.vitonica.com/categoria/recetas-saludables/record/60",
    "https://www.vitonica.com/categoria/recetas-saludables/record/80",
    "https://www.vitonica.com/categoria/recetas-saludables/record/100",
]

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def infer_diet_type(text: str) -> str | None:
    lowered = text.lower()

    if "keto" in lowered:
        return "keto"
    if "vegano" in lowered or "vegan" in lowered:
        return "vegana"
    if "vegetar" in lowered:
        return "vegetariana"
    if "sin gluten" in lowered:
        return "sin gluten"
    if "prote" in lowered:
        return "alta en proteinas"

    return None


def parse_minutes(text: str) -> int:
    match = re.search(r"(\d+)\s*min", text.lower())
    if not match:
        return 0
    return int(match.group(1))


def parse_calories(text: str) -> float:
    match = re.search(r"(\d+)\s*(kcal|calor[ií]as)", text.lower())
    if not match:
        return 0.0
    return float(match.group(1))


def fetch_html(url: str) -> str:
    response = requests.get(
        url,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    response.raise_for_status()
    return response.text


def extract_listing_recipes(url: str) -> List[Tuple[str, str, str]]:
    html = fetch_html(url)
    soup = BeautifulSoup(html, "html.parser")

    found: list[tuple[str, str, str]] = []
    seen_urls: set[str] = set()

    for anchor in soup.find_all("a", href=True):
        href = anchor["href"]

        if not href.startswith("https://www.vitonica.com/recetas-saludables/"):
            continue
        if "#" in href:
            continue

        title = normalize_spaces(anchor.get_text(" "))
        if not title:
            continue

        article = anchor.find_parent("article")
        summary = ""
        if article:
            paragraph = article.find("p")
            if paragraph:
                summary = normalize_spaces(paragraph.get_text(" "))

        if href in seen_urls:
            continue

        seen_urls.add(href)
        found.append((title, href, summary))

    return found


def parse_source_urls_from_env() -> List[str]:
    raw_urls = os.getenv("VITONICA_URLS", "")
    if raw_urls.strip():
        urls = [normalize_spaces(url) for url in raw_urls.split(",") if normalize_spaces(url)]
        if urls:
            return urls

    single_url = normalize_spaces(os.getenv("VITONICA_URL", ""))
    if single_url:
        return [single_url]

    return SOURCE_URLS


def wait_for_db(db_url: str, retries: int = 30, delay_seconds: int = 2) -> None:
    for attempt in range(1, retries + 1):
        try:
            with psycopg2.connect(db_url):
                print("Conexion con la base de datos establecida")
                return
        except psycopg2.OperationalError:
            if attempt == retries:
                raise
            print(f"DB no disponible (intento {attempt}/{retries}), reintentando...")
            time.sleep(delay_seconds)


def wait_for_recipes_table(db_url: str, retries: int = 30, delay_seconds: int = 2) -> None:
    for attempt in range(1, retries + 1):
        try:
            with psycopg2.connect(db_url) as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT 1 FROM recipes LIMIT 1")
                    print("Tabla recipes lista")
                    return
        except (psycopg2.OperationalError, UndefinedTable):
            if attempt == retries:
                raise
            print(f"Tabla recipes no disponible (intento {attempt}/{retries}), reintentando...")
            time.sleep(delay_seconds)


def insert_recipes(db_url: str, rows: List[Tuple[str, str, str]]) -> tuple[int, int]:
    inserted = 0
    skipped = 0

    with psycopg2.connect(db_url) as conn:
        with conn.cursor() as cursor:
            for title, recipe_url, summary in rows:
                cursor.execute("SELECT id FROM recipes WHERE fuente_url = %s", (recipe_url,))
                if cursor.fetchone():
                    skipped += 1
                    continue

                details_text = f"{title}. {summary}".strip()
                ingredients = summary if summary else "No especificados"
                diet_type = infer_diet_type(details_text)
                minutes = parse_minutes(details_text)
                calories = parse_calories(details_text)

                cursor.execute(
                    """
                    INSERT INTO recipes (
                        nombre,
                        ingredientes,
                        calorias_totales,
                        proteinas,
                        carbos,
                        grasas,
                        tiempo_preparacion,
                        tipo_dieta,
                        fuente_url,
                        origen
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        title,
                        ingredients,
                        calories,
                        0.0,
                        0.0,
                        0.0,
                        minutes,
                        diet_type,
                        recipe_url,
                        "scraping",
                    ),
                )
                inserted += 1

        conn.commit()

    return inserted, skipped


def main() -> int:
    source_urls = parse_source_urls_from_env()
    db_url = os.getenv("DATABASE_URL", "postgresql://bodyfuel:bodyfuel@db:5432/bodyfuel")

    recipes: list[tuple[str, str, str]] = []
    seen_urls: set[str] = set()

    for source_url in source_urls:
        print(f"Extrayendo recetas de: {source_url}")
        page_recipes = extract_listing_recipes(source_url)
        print(f"Recetas detectadas en el listado: {len(page_recipes)}")

        for title, recipe_url, summary in page_recipes:
            if recipe_url in seen_urls:
                continue
            seen_urls.add(recipe_url)
            recipes.append((title, recipe_url, summary))

    print(f"Recetas unicas detectadas en total: {len(recipes)}")

    if not recipes:
        print("No se encontraron recetas para importar.")
        return 1

    wait_for_db(db_url)
    wait_for_recipes_table(db_url)

    inserted, skipped = insert_recipes(db_url, recipes)

    print(f"Importacion completada. Insertadas: {inserted} | Omitidas (duplicadas): {skipped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
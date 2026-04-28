import time
from sqlalchemy.exc import OperationalError

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from .models import Food
from sqlalchemy.orm import Session
from .database import Base, engine
from . import models
from .routers.users import router as users_router
from .routers.tracking import router as tracking_router
from .routers.foods import router as foods_router
from .routers.recipes import router as recipes_router
from .routers.assistant import router as assistant_router
from .routers.plans import router as plans_router
from .routers.meals import router as meals_router
from .routers.meal_items import router as meal_items_router
from .routers.external_foods import router as external_foods_router
from .routers.friends import router as friends_router

app = FastAPI()


def estimate_recipe_macros(nombre: str, ingredientes: str, calorias_totales: float) -> tuple[float, float, float]:
    text_blob = f"{nombre} {ingredientes}".lower()
    calories = max(float(calorias_totales or 0), 120.0)

    protein_ratio = 0.24
    carb_ratio = 0.46
    fat_ratio = 0.30

    high_protein_terms = [
        "pollo", "pavo", "atun", "atún", "ternera", "res", "huevo", "claras",
        "salmon", "salmón", "bacalao", "merluza", "gambas", "marisco", "tofu", "tempeh",
        "legumbre", "lenteja", "garbanzo", "judia", "judía", "proteico", "proteina", "proteína"
    ]
    high_carb_terms = [
        "arroz", "pasta", "quinoa", "patata", "batata", "avena", "pan", "trigo",
        "cuscus", "cous cous", "fideos", "maiz", "maíz", "fruta"
    ]
    high_fat_terms = [
        "aguacate", "aceite", "fruto seco", "nuez", "almendra", "cacahuete",
        "queso", "mantequilla", "salmon", "salmón", "yema", "coco", "semillas"
    ]

    if any(term in text_blob for term in high_protein_terms):
        protein_ratio += 0.08
        carb_ratio -= 0.04
        fat_ratio -= 0.04
    if any(term in text_blob for term in high_carb_terms):
        carb_ratio += 0.10
        protein_ratio -= 0.05
        fat_ratio -= 0.05
    if any(term in text_blob for term in high_fat_terms):
        fat_ratio += 0.10
        protein_ratio -= 0.05
        carb_ratio -= 0.05

    protein_ratio = min(max(protein_ratio, 0.12), 0.45)
    carb_ratio = min(max(carb_ratio, 0.20), 0.65)
    fat_ratio = min(max(fat_ratio, 0.15), 0.55)

    total_ratio = protein_ratio + carb_ratio + fat_ratio
    protein_ratio /= total_ratio
    carb_ratio /= total_ratio
    fat_ratio /= total_ratio

    proteinas = round((calories * protein_ratio) / 4.0, 1)
    carbos = round((calories * carb_ratio) / 4.0, 1)
    grasas = round((calories * fat_ratio) / 9.0, 1)
    return proteinas, carbos, grasas


def estimate_recipe_calories(nombre: str, ingredientes: str, tiempo_preparacion: int) -> float:
    text_blob = f"{nombre} {ingredientes}".lower()
    calories = 380.0

    light_terms = ["ensalada", "salteado", "sopa", "crema", "verdura", "vegetal", "light", "bajo en calorias"]
    medium_terms = ["arroz", "pollo", "carne", "pescado", "legumbre", "garbanzo", "lenteja"]
    high_cal_terms = [
        "pasta", "pizza", "hamburguesa", "lasana", "lasaña", "empanada", "tarta",
        "postre", "brownie", "bizcocho", "galleta", "queso", "mantequilla", "frito"
    ]

    if any(term in text_blob for term in light_terms):
        calories -= 130.0
    if any(term in text_blob for term in medium_terms):
        calories += 40.0
    if any(term in text_blob for term in high_cal_terms):
        calories += 180.0

    prep_minutes = int(tiempo_preparacion or 0)
    if prep_minutes >= 50:
        calories += 40.0
    elif 0 < prep_minutes <= 15:
        calories -= 20.0

    return round(max(calories, 140.0), 1)


def ensure_scraping_recipe_macros() -> None:
    with Session(engine) as session:
        recipes = (
            session.query(models.Recipe)
            .filter(models.Recipe.origen == "scraping")
            .all()
        )

        changed = 0
        for recipe in recipes:
            has_empty_calories = float(recipe.calorias_totales or 0) <= 0
            if has_empty_calories:
                recipe.calorias_totales = estimate_recipe_calories(
                    recipe.nombre or "",
                    recipe.ingredientes or "",
                    int(recipe.tiempo_preparacion or 0),
                )
                changed += 1

            has_empty_macros = (
                float(recipe.proteinas or 0) <= 0
                and float(recipe.carbos or 0) <= 0
                and float(recipe.grasas or 0) <= 0
            )
            if not has_empty_macros:
                continue

            proteinas, carbos, grasas = estimate_recipe_macros(
                recipe.nombre or "",
                recipe.ingredientes or "",
                float(recipe.calorias_totales or 0),
            )
            recipe.proteinas = proteinas
            recipe.carbos = carbos
            recipe.grasas = grasas
            changed += 1

        if changed:
            session.commit()
            print(f"Macros estimados para recetas scraping: {changed}")


def ensure_user_auth_columns() -> None:
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR"))
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR"))
        connection.execute(
            text(
                "UPDATE users SET email = COALESCE(email, nombre, ''), password = COALESCE(password, objetivo, '')"
            )
        )
        connection.execute(text("ALTER TABLE users ALTER COLUMN email SET NOT NULL"))
        connection.execute(text("ALTER TABLE users ALTER COLUMN password SET NOT NULL"))

def ensure_food_user_column() -> None:
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE foods ADD COLUMN IF NOT EXISTS user_id INTEGER")
        )

DEFAULT_FOODS = [
    # Cereales y granos
    {"nombre": "Avena", "calorias": 389, "proteinas": 16.9, "carbos": 66.3, "grasas": 6.9, "fuente": "default"},
    {"nombre": "Arroz blanco", "calorias": 130, "proteinas": 2.7, "carbos": 28.0, "grasas": 0.3, "fuente": "default"},
    {"nombre": "Arroz integral", "calorias": 123, "proteinas": 2.7, "carbos": 25.6, "grasas": 1.0, "fuente": "default"},
    {"nombre": "Pasta cocida", "calorias": 131, "proteinas": 5.0, "carbos": 25.0, "grasas": 1.1, "fuente": "default"},
    {"nombre": "Pan integral", "calorias": 247, "proteinas": 13.0, "carbos": 41.0, "grasas": 4.2, "fuente": "default"},
    {"nombre": "Pan blanco", "calorias": 265, "proteinas": 9.0, "carbos": 49.0, "grasas": 3.0, "fuente": "default"},
    {"nombre": "Quinoa cocida", "calorias": 120, "proteinas": 4.4, "carbos": 21.3, "grasas": 1.9, "fuente": "default"},
    {"nombre": "Cereal con fibra", "calorias": 350, "proteinas": 8.0, "carbos": 73.0, "grasas": 2.0, "fuente": "default"},
    {"nombre": "Trigo sarraceno cocido", "calorias": 92, "proteinas": 3.4, "carbos": 19.9, "grasas": 0.6, "fuente": "default"},
    
    # Carnes y aves
    {"nombre": "Pechuga de pollo", "calorias": 165, "proteinas": 31.0, "carbos": 0.0, "grasas": 3.6, "fuente": "default"},
    {"nombre": "Pechuga de pollo sin piel", "calorias": 137, "proteinas": 30.0, "carbos": 0.0, "grasas": 1.3, "fuente": "default"},
    {"nombre": "Muslo de pollo", "calorias": 209, "proteinas": 26.0, "carbos": 0.0, "grasas": 11.0, "fuente": "default"},
    {"nombre": "Carne de res magra", "calorias": 250, "proteinas": 26.0, "carbos": 0.0, "grasas": 15.0, "fuente": "default"},
    {"nombre": "Lomo de res", "calorias": 180, "proteinas": 27.0, "carbos": 0.0, "grasas": 7.4, "fuente": "default"},
    {"nombre": "Carne de cerdo", "calorias": 242, "proteinas": 27.0, "carbos": 0.0, "grasas": 14.0, "fuente": "default"},
    {"nombre": "Jamón serrano", "calorias": 284, "proteinas": 30.0, "carbos": 0.0, "grasas": 17.0, "fuente": "default"},
    {"nombre": "Pavo", "calorias": 135, "proteinas": 29.0, "carbos": 0.0, "grasas": 1.0, "fuente": "default"},
    {"nombre": "Cordero", "calorias": 294, "proteinas": 25.0, "carbos": 0.0, "grasas": 21.0, "fuente": "default"},
    
    # Pescados y mariscos
    {"nombre": "Salmón", "calorias": 208, "proteinas": 20.0, "carbos": 0.0, "grasas": 13.0, "fuente": "default"},
    {"nombre": "Atún al natural", "calorias": 116, "proteinas": 26.0, "carbos": 0.0, "grasas": 1.0, "fuente": "default"},
    {"nombre": "Atún en lata", "calorias": 132, "proteinas": 29.0, "carbos": 0.0, "grasas": 0.9, "fuente": "default"},
    {"nombre": "Trucha", "calorias": 150, "proteinas": 26.0, "carbos": 0.0, "grasas": 5.0, "fuente": "default"},
    {"nombre": "Bacalao", "calorias": 82, "proteinas": 17.8, "carbos": 0.0, "grasas": 0.7, "fuente": "default"},
    {"nombre": "Merluza", "calorias": 82, "proteinas": 17.5, "carbos": 0.0, "grasas": 1.0, "fuente": "default"},
    {"nombre": "Sardinas en lata", "calorias": 208, "proteinas": 25.0, "carbos": 0.0, "grasas": 11.0, "fuente": "default"},
    {"nombre": "Camarones", "calorias": 99, "proteinas": 24.0, "carbos": 0.0, "grasas": 0.3, "fuente": "default"},
    {"nombre": "Mejillones", "calorias": 95, "proteinas": 16.0, "carbos": 3.0, "grasas": 2.0, "fuente": "default"},
    {"nombre": "Pulpo", "calorias": 82, "proteinas": 15.0, "carbos": 0.0, "grasas": 1.0, "fuente": "default"},
    
    # Huevos
    {"nombre": "Huevo entero", "calorias": 155, "proteinas": 13.0, "carbos": 1.1, "grasas": 11.0, "fuente": "default"},
    {"nombre": "Claras de huevo", "calorias": 52, "proteinas": 11.0, "carbos": 0.7, "grasas": 0.2, "fuente": "default"},
    {"nombre": "Yema de huevo", "calorias": 322, "proteinas": 15.9, "carbos": 3.3, "grasas": 26.5, "fuente": "default"},
    
    # Lácteos
    {"nombre": "Yogur griego 0%", "calorias": 59, "proteinas": 10.3, "carbos": 3.6, "grasas": 0.4, "fuente": "default"},
    {"nombre": "Yogur natural", "calorias": 61, "proteinas": 3.5, "carbos": 4.7, "grasas": 0.4, "fuente": "default"},
    {"nombre": "Yogur de frutas", "calorias": 95, "proteinas": 3.3, "carbos": 17.0, "grasas": 0.4, "fuente": "default"},
    {"nombre": "Queso fresco", "calorias": 98, "proteinas": 11.0, "carbos": 1.3, "grasas": 5.3, "fuente": "default"},
    {"nombre": "Queso cottage", "calorias": 98, "proteinas": 11.0, "carbos": 3.4, "grasas": 5.3, "fuente": "default"},
    {"nombre": "Queso cheddar", "calorias": 403, "proteinas": 23.0, "carbos": 3.4, "grasas": 33.0, "fuente": "default"},
    {"nombre": "Queso mozzarella", "calorias": 280, "proteinas": 28.0, "carbos": 3.1, "grasas": 17.0, "fuente": "default"},
    {"nombre": "Leche desnatada", "calorias": 35, "proteinas": 3.6, "carbos": 4.8, "grasas": 0.1, "fuente": "default"},
    {"nombre": "Leche semidesnatada", "calorias": 47, "proteinas": 3.2, "carbos": 4.8, "grasas": 1.6, "fuente": "default"},
    {"nombre": "Leche entera", "calorias": 61, "proteinas": 3.2, "carbos": 4.8, "grasas": 3.3, "fuente": "default"},
    {"nombre": "Leche de almendra sin azúcar", "calorias": 30, "proteinas": 1.0, "carbos": 1.0, "grasas": 2.5, "fuente": "default"},
    
    # Frutas
    {"nombre": "Plátano", "calorias": 89, "proteinas": 1.1, "carbos": 22.8, "grasas": 0.3, "fuente": "default"},
    {"nombre": "Manzana", "calorias": 52, "proteinas": 0.3, "carbos": 13.8, "grasas": 0.2, "fuente": "default"},
    {"nombre": "Naranja", "calorias": 47, "proteinas": 0.9, "carbos": 11.8, "grasas": 0.1, "fuente": "default"},
    {"nombre": "Fresa", "calorias": 32, "proteinas": 0.7, "carbos": 7.7, "grasas": 0.3, "fuente": "default"},
    {"nombre": "Arándanos", "calorias": 57, "proteinas": 0.7, "carbos": 14.5, "grasas": 0.3, "fuente": "default"},
    {"nombre": "Frambuesas", "calorias": 52, "proteinas": 1.2, "carbos": 11.9, "grasas": 0.7, "fuente": "default"},
    {"nombre": "Sandía", "calorias": 30, "proteinas": 0.6, "carbos": 7.6, "grasas": 0.2, "fuente": "default"},
    {"nombre": "Melón", "calorias": 36, "proteinas": 0.8, "carbos": 8.6, "grasas": 0.2, "fuente": "default"},
    {"nombre": "Piña", "calorias": 50, "proteinas": 0.5, "carbos": 13.1, "grasas": 0.1, "fuente": "default"},
    {"nombre": "Mango", "calorias": 60, "proteinas": 0.7, "carbos": 15.0, "grasas": 0.4, "fuente": "default"},
    {"nombre": "Pera", "calorias": 57, "proteinas": 0.4, "carbos": 15.2, "grasas": 0.1, "fuente": "default"},
    {"nombre": "Melocotón", "calorias": 39, "proteinas": 0.9, "carbos": 9.5, "grasas": 0.3, "fuente": "default"},
    {"nombre": "Cereza", "calorias": 63, "proteinas": 1.1, "carbos": 16.0, "grasas": 0.3, "fuente": "default"},
    {"nombre": "Uva", "calorias": 67, "proteinas": 0.7, "carbos": 17.0, "grasas": 0.4, "fuente": "default"},
    {"nombre": "Limón", "calorias": 29, "proteinas": 1.1, "carbos": 9.3, "grasas": 0.3, "fuente": "default"},
    
    # Verduras
    {"nombre": "Brócoli", "calorias": 34, "proteinas": 2.8, "carbos": 6.6, "grasas": 0.4, "fuente": "default"},
    {"nombre": "Coliflor", "calorias": 25, "proteinas": 1.9, "carbos": 4.9, "grasas": 0.3, "fuente": "default"},
    {"nombre": "Tomate", "calorias": 18, "proteinas": 0.9, "carbos": 3.9, "grasas": 0.2, "fuente": "default"},
    {"nombre": "Pepino", "calorias": 16, "proteinas": 0.7, "carbos": 3.6, "grasas": 0.1, "fuente": "default"},
    {"nombre": "Lechuga", "calorias": 15, "proteinas": 0.9, "carbos": 2.9, "grasas": 0.1, "fuente": "default"},
    {"nombre": "Espinaca cruda", "calorias": 23, "proteinas": 2.7, "carbos": 3.6, "grasas": 0.4, "fuente": "default"},
    {"nombre": "Espinaca cocida", "calorias": 23, "proteinas": 2.9, "carbos": 3.7, "grasas": 0.4, "fuente": "default"},
    {"nombre": "Zanahoria", "calorias": 41, "proteinas": 0.9, "carbos": 9.6, "grasas": 0.2, "fuente": "default"},
    {"nombre": "Patata cocida", "calorias": 87, "proteinas": 1.9, "carbos": 20.1, "grasas": 0.1, "fuente": "default"},
    {"nombre": "Patata al horno", "calorias": 77, "proteinas": 2.1, "carbos": 17.0, "grasas": 0.1, "fuente": "default"},
    {"nombre": "Batata cocida", "calorias": 86, "proteinas": 1.6, "carbos": 20.1, "grasas": 0.1, "fuente": "default"},
    {"nombre": "Cebolla", "calorias": 40, "proteinas": 1.1, "carbos": 9.0, "grasas": 0.1, "fuente": "default"},
    {"nombre": "Ajo", "calorias": 149, "proteinas": 6.4, "carbos": 33.0, "grasas": 0.5, "fuente": "default"},
    {"nombre": "Calabacín", "calorias": 17, "proteinas": 1.5, "carbos": 3.1, "grasas": 0.4, "fuente": "default"},
    {"nombre": "Berenjena", "calorias": 25, "proteinas": 1.0, "carbos": 5.9, "grasas": 0.2, "fuente": "default"},
    {"nombre": "Pimiento verde", "calorias": 31, "proteinas": 1.0, "carbos": 6.0, "grasas": 0.4, "fuente": "default"},
    {"nombre": "Pimiento rojo", "calorias": 37, "proteinas": 1.2, "carbos": 8.8, "grasas": 0.3, "fuente": "default"},
    {"nombre": "Pimiento amarillo", "calorias": 41, "proteinas": 1.0, "carbos": 9.8, "grasas": 0.4, "fuente": "default"},
    {"nombre": "Guisantes cocidos", "calorias": 81, "proteinas": 5.4, "carbos": 14.5, "grasas": 0.4, "fuente": "default"},
    {"nombre": "Champiñones", "calorias": 22, "proteinas": 3.1, "carbos": 3.3, "grasas": 0.3, "fuente": "default"},
    
    # Legumbres
    {"nombre": "Lentejas cocidas", "calorias": 116, "proteinas": 9.0, "carbos": 20.1, "grasas": 0.4, "fuente": "default"},
    {"nombre": "Garbanzos cocidos", "calorias": 164, "proteinas": 8.9, "carbos": 27.4, "grasas": 2.6, "fuente": "default"},
    {"nombre": "Judías cocidas", "calorias": 127, "proteinas": 8.7, "carbos": 23.0, "grasas": 0.4, "fuente": "default"},
    {"nombre": "Soja cocida", "calorias": 173, "proteinas": 18.6, "carbos": 5.0, "grasas": 9.7, "fuente": "default"},
    {"nombre": "Tofu", "calorias": 76, "proteinas": 8.1, "carbos": 1.9, "grasas": 4.8, "fuente": "default"},
    {"nombre": "Tempeh", "calorias": 193, "proteinas": 19.0, "carbos": 7.6, "grasas": 11.0, "fuente": "default"},
    
    # Frutos secos y semillas
    {"nombre": "Almendras", "calorias": 579, "proteinas": 21.2, "carbos": 21.6, "grasas": 49.9, "fuente": "default"},
    {"nombre": "Avellanas", "calorias": 628, "proteinas": 14.1, "carbos": 16.7, "grasas": 60.8, "fuente": "default"},
    {"nombre": "Cacahuetes", "calorias": 567, "proteinas": 25.8, "carbos": 16.1, "grasas": 49.2, "fuente": "default"},
    {"nombre": "Pistachos", "calorias": 560, "proteinas": 20.3, "carbos": 27.7, "grasas": 45.3, "fuente": "default"},
    {"nombre": "Nueces", "calorias": 654, "proteinas": 15.2, "carbos": 13.7, "grasas": 65.2, "fuente": "default"},
    {"nombre": "Semillas de girasol", "calorias": 584, "proteinas": 20.0, "carbos": 20.0, "grasas": 51.5, "fuente": "default"},
    {"nombre": "Semillas de calabaza", "calorias": 559, "proteinas": 19.0, "carbos": 11.0, "grasas": 49.0, "fuente": "default"},
    {"nombre": "Semillas de lino", "calorias": 534, "proteinas": 18.3, "carbos": 28.9, "grasas": 42.2, "fuente": "default"},
    {"nombre": "Semillas de chía", "calorias": 486, "proteinas": 16.5, "carbos": 42.1, "grasas": 30.7, "fuente": "default"},
    
    # Grasas y aceites
    {"nombre": "Aceite de oliva", "calorias": 884, "proteinas": 0.0, "carbos": 0.0, "grasas": 100.0, "fuente": "default"},
    {"nombre": "Aceite de girasol", "calorias": 884, "proteinas": 0.0, "carbos": 0.0, "grasas": 100.0, "fuente": "default"},
    {"nombre": "Aceite de coco", "calorias": 892, "proteinas": 0.0, "carbos": 0.0, "grasas": 99.0, "fuente": "default"},
    {"nombre": "Mantequilla", "calorias": 717, "proteinas": 0.9, "carbos": 0.1, "grasas": 81.7, "fuente": "default"},
    {"nombre": "Aguacate", "calorias": 160, "proteinas": 2.0, "carbos": 8.5, "grasas": 14.7, "fuente": "default"},
    
    # Bebidas
    {"nombre": "Agua", "calorias": 0, "proteinas": 0.0, "carbos": 0.0, "grasas": 0.0, "fuente": "default"},
    {"nombre": "Café negro", "calorias": 2, "proteinas": 0.3, "carbos": 0.0, "grasas": 0.0, "fuente": "default"},
    {"nombre": "Té", "calorias": 2, "proteinas": 0.0, "carbos": 0.0, "grasas": 0.0, "fuente": "default"},
    {"nombre": "Jugo de naranja", "calorias": 47, "proteinas": 0.9, "carbos": 11.8, "grasas": 0.1, "fuente": "default"},
    {"nombre": "Jugo de manzana", "calorias": 52, "proteinas": 0.1, "carbos": 13.8, "grasas": 0.0, "fuente": "default"},
    
    # Condimentos y especias
    {"nombre": "Sal", "calorias": 0, "proteinas": 0.0, "carbos": 0.0, "grasas": 0.0, "fuente": "default"},
    {"nombre": "Pimienta negra", "calorias": 251, "proteinas": 10.4, "carbos": 64.8, "grasas": 3.3, "fuente": "default"},
    {"nombre": "Vinagre", "calorias": 18, "proteinas": 0.0, "carbos": 0.9, "grasas": 0.0, "fuente": "default"},
    
    # Productos procesados saludables
    {"nombre": "Batido proteico", "calorias": 120, "proteinas": 24.0, "carbos": 3.0, "grasas": 1.5, "fuente": "default"},
    {"nombre": "Barra de proteína", "calorias": 210, "proteinas": 20.0, "carbos": 22.0, "grasas": 5.0, "fuente": "default"},
    {"nombre": "Proteína en polvo", "calorias": 110, "proteinas": 24.0, "carbos": 1.0, "grasas": 0.5, "fuente": "default"},
]

def ensure_default_foods() -> None:
    with Session(engine) as session:
        existing_names = {
            row[0].strip().lower()
            for row in session.query(Food.nombre).all()
            if row[0]
        }

        foods_to_insert = [
            Food(**food_data)
            for food_data in DEFAULT_FOODS
            if food_data["nombre"].strip().lower() not in existing_names
        ]

        if foods_to_insert:
            session.add_all(foods_to_insert)
            session.commit()
            
            
def ensure_recipe_macro_columns() -> None:
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE recipes ADD COLUMN IF NOT EXISTS proteinas DOUBLE PRECISION DEFAULT 0"))
        connection.execute(text("ALTER TABLE recipes ADD COLUMN IF NOT EXISTS carbos DOUBLE PRECISION DEFAULT 0"))
        connection.execute(text("ALTER TABLE recipes ADD COLUMN IF NOT EXISTS grasas DOUBLE PRECISION DEFAULT 0"))
        connection.execute(text("UPDATE recipes SET proteinas = COALESCE(proteinas, 0), carbos = COALESCE(carbos, 0), grasas = COALESCE(grasas, 0)"))
        connection.execute(text("ALTER TABLE recipes ALTER COLUMN proteinas SET NOT NULL"))
        connection.execute(text("ALTER TABLE recipes ALTER COLUMN carbos SET NOT NULL"))
        connection.execute(text("ALTER TABLE recipes ALTER COLUMN grasas SET NOT NULL"))
        connection.execute(text("ALTER TABLE recipes ADD COLUMN IF NOT EXISTS user_id INTEGER"))
        # Solo intenta agregar constraint si no existe
        try:
            connection.execute(text("ALTER TABLE recipes ADD CONSTRAINT recipes_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"))
        except:
            pass  # La constraint ya existe, ignorar error


        
        
def initialize_database(retries: int = 20, delay: int = 3) -> None:
    for attempt in range(1, retries + 1):
        try:
            Base.metadata.create_all(bind=engine)
            ensure_user_auth_columns()
            ensure_recipe_macro_columns()
            ensure_default_foods()
            print("Base de datos inicializada correctamente")
            return
        except OperationalError:
            print(f"Intento {attempt}/{retries}: esperando a PostgreSQL...")
            if attempt == retries:
                raise
            time.sleep(delay)


initialize_database()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
Base.metadata.create_all(bind=engine)
ensure_user_auth_columns()
ensure_recipe_macro_columns()
ensure_food_user_column()
ensure_default_foods()
ensure_scraping_recipe_macros()

app.include_router(users_router)
app.include_router(tracking_router)
app.include_router(foods_router)
app.include_router(recipes_router)
app.include_router(assistant_router)
app.include_router(plans_router)
app.include_router(meals_router)
app.include_router(meal_items_router)
app.include_router(external_foods_router)
app.include_router(friends_router)

@app.get("/health")
def health():
    return {"status": "ok"}

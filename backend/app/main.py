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

app = FastAPI()


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



DEFAULT_FOODS = [
    {"nombre": "Avena", "calorias": 389, "proteinas": 16.9, "carbos": 66.3, "grasas": 6.9, "fuente": "default"},
    {"nombre": "Arroz blanco", "calorias": 130, "proteinas": 2.7, "carbos": 28.0, "grasas": 0.3, "fuente": "default"},
    {"nombre": "Arroz integral", "calorias": 123, "proteinas": 2.7, "carbos": 25.6, "grasas": 1.0, "fuente": "default"},
    {"nombre": "Pechuga de pollo", "calorias": 165, "proteinas": 31.0, "carbos": 0.0, "grasas": 3.6, "fuente": "default"},
    {"nombre": "Huevo", "calorias": 155, "proteinas": 13.0, "carbos": 1.1, "grasas": 11.0, "fuente": "default"},
    {"nombre": "Claras de huevo", "calorias": 52, "proteinas": 11.0, "carbos": 0.7, "grasas": 0.2, "fuente": "default"},
    {"nombre": "Plátano", "calorias": 89, "proteinas": 1.1, "carbos": 22.8, "grasas": 0.3, "fuente": "default"},
    {"nombre": "Manzana", "calorias": 52, "proteinas": 0.3, "carbos": 13.8, "grasas": 0.2, "fuente": "default"},
    {"nombre": "Salmón", "calorias": 208, "proteinas": 20.0, "carbos": 0.0, "grasas": 13.0, "fuente": "default"},
    {"nombre": "Atún al natural", "calorias": 116, "proteinas": 26.0, "carbos": 0.0, "grasas": 1.0, "fuente": "default"},
    {"nombre": "Patata cocida", "calorias": 87, "proteinas": 1.9, "carbos": 20.1, "grasas": 0.1, "fuente": "default"},
    {"nombre": "Batata", "calorias": 86, "proteinas": 1.6, "carbos": 20.1, "grasas": 0.1, "fuente": "default"},
    {"nombre": "Pan integral", "calorias": 247, "proteinas": 13.0, "carbos": 41.0, "grasas": 4.2, "fuente": "default"},
    {"nombre": "Pasta cocida", "calorias": 131, "proteinas": 5.0, "carbos": 25.0, "grasas": 1.1, "fuente": "default"},
    {"nombre": "Yogur griego 0%", "calorias": 59, "proteinas": 10.3, "carbos": 3.6, "grasas": 0.4, "fuente": "default"},
    {"nombre": "Queso fresco batido 0%", "calorias": 46, "proteinas": 8.0, "carbos": 4.0, "grasas": 0.2, "fuente": "default"},
    {"nombre": "Leche semidesnatada", "calorias": 47, "proteinas": 3.2, "carbos": 4.8, "grasas": 1.6, "fuente": "default"},
    {"nombre": "Brócoli", "calorias": 34, "proteinas": 2.8, "carbos": 6.6, "grasas": 0.4, "fuente": "default"},
    {"nombre": "Tomate", "calorias": 18, "proteinas": 0.9, "carbos": 3.9, "grasas": 0.2, "fuente": "default"},
    {"nombre": "Aguacate", "calorias": 160, "proteinas": 2.0, "carbos": 8.5, "grasas": 14.7, "fuente": "default"},
    {"nombre": "Almendras", "calorias": 579, "proteinas": 21.2, "carbos": 21.6, "grasas": 49.9, "fuente": "default"},
    {"nombre": "Aceite de oliva", "calorias": 884, "proteinas": 0.0, "carbos": 0.0, "grasas": 100.0, "fuente": "default"},
    {"nombre": "Quinoa cocida", "calorias": 120, "proteinas": 4.4, "carbos": 21.3, "grasas": 1.9, "fuente": "default"},
    {"nombre": "Lentejas cocidas", "calorias": 116, "proteinas": 9.0, "carbos": 20.1, "grasas": 0.4, "fuente": "default"},
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
        
        
Base.metadata.create_all(bind=engine)
ensure_user_auth_columns()
ensure_recipe_macro_columns()
ensure_default_foods()

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

app.include_router(users_router)
app.include_router(tracking_router)
app.include_router(foods_router)
app.include_router(recipes_router)
app.include_router(assistant_router)
app.include_router(plans_router)
app.include_router(meals_router)
app.include_router(meal_items_router)

@app.get("/health")
def health():
    return {"status": "ok"}
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .database import Base, engine
from . import models
from .routers.users import router as users_router
from .routers.tracking import router as tracking_router
from .routers.foods import router as foods_router
from .routers.recipes import router as recipes_router
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


Base.metadata.create_all(bind=engine)
ensure_user_auth_columns()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users_router)
app.include_router(tracking_router)
app.include_router(foods_router)
app.include_router(recipes_router)
app.include_router(plans_router)
app.include_router(meals_router)
app.include_router(meal_items_router)

@app.get("/health")
def health():
    return {"status": "ok"}
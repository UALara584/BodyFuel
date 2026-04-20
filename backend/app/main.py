from fastapi import FastAPI

from .database import Base, engine
from . import models
from .routers.users import router as users_router
from .routers.tracking import router as tracking_router

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.include_router(users_router)
app.include_router(tracking_router)

@app.get("/health")
def health():
    return {"status": "ok"}
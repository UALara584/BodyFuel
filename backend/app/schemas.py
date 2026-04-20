from pydantic import BaseModel
from datetime import date


class UserCreate(BaseModel):
    nombre: str
    edad: int
    peso: float
    altura: float
    objetivo: str
    calorias_objetivo: int


class UserResponse(UserCreate):
    id: int

    class Config:
        from_attributes = True


class TrackingCreate(BaseModel):
    user_id: int
    fecha: date
    peso: float
    calorias_consumidas: int


class TrackingUpdate(BaseModel):
    fecha: date
    peso: float
    calorias_consumidas: int


class TrackingResponse(TrackingCreate):
    id: int

    class Config:
        from_attributes = True
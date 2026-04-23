from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Food

from ..schemas import FoodCreate, FoodResponse, FoodImportFromApi

router = APIRouter(prefix="/foods", tags=["Foods"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=FoodResponse)
def create_food(food: FoodCreate, db: Session = Depends(get_db)):
    new_food = Food(**food.dict())
    db.add(new_food)
    db.commit()
    db.refresh(new_food)
    return new_food


@router.get("/", response_model=list[FoodResponse])
def get_foods(nombre: str | None = Query(default=None), db: Session = Depends(get_db)):
    query = db.query(Food)

    if nombre:
        query = query.filter(Food.nombre.ilike(f"%{nombre}%"))

    return query.all()


@router.get("/{food_id}", response_model=FoodResponse)
def get_food(food_id: int, db: Session = Depends(get_db)):
    food = db.query(Food).filter(Food.id == food_id).first()

    if not food:
        raise HTTPException(status_code=404, detail="Alimento no encontrado")

    return food


@router.put("/{food_id}", response_model=FoodResponse)
def update_food(food_id: int, data: FoodCreate, db: Session = Depends(get_db)):
    food = db.query(Food).filter(Food.id == food_id).first()

    if not food:
        raise HTTPException(status_code=404, detail="Alimento no encontrado")

    for key, value in data.dict().items():
        setattr(food, key, value)

    db.commit()
    db.refresh(food)
    return food


@router.delete("/{food_id}")
def delete_food(food_id: int, db: Session = Depends(get_db)):
    food = db.query(Food).filter(Food.id == food_id).first()

    if not food:
        raise HTTPException(status_code=404, detail="Alimento no encontrado")

    db.delete(food)
    db.commit()
    return {"message": "Alimento eliminado"}
@router.post("/import", response_model=FoodResponse)
def import_food_from_api(payload: FoodImportFromApi, db: Session = Depends(get_db)):
    existing_food = (
        db.query(Food)
        .filter(Food.nombre.ilike(payload.nombre.strip()))
        .first()
    )

    if existing_food:
        return existing_food

    new_food = Food(
        nombre=payload.nombre.strip(),
        calorias=payload.calorias,
        proteinas=payload.proteinas,
        carbos=payload.carbos,
        grasas=payload.grasas,
        fuente=payload.fuente or "api",
    )

    db.add(new_food)
    db.commit()
    db.refresh(new_food)

    return new_food

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import MealItem, Meal, Food, Recipe
from ..schemas import MealItemCreate, MealItemUpdate, MealItemResponse

router = APIRouter(prefix="/meal-items", tags=["Meal Items"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=MealItemResponse)
def create_meal_item(data: MealItemCreate, db: Session = Depends(get_db)):
    meal = db.query(Meal).filter(Meal.id == data.meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Comida no encontrada")

    if data.food_id is None and data.recipe_id is None:
        raise HTTPException(status_code=400, detail="Debes indicar un food_id o un recipe_id")

    if data.food_id is not None and data.recipe_id is not None:
        raise HTTPException(status_code=400, detail="Solo puedes indicar food_id o recipe_id, no ambos")

    if data.food_id is not None:
        food = db.query(Food).filter(Food.id == data.food_id).first()
        if not food:
            raise HTTPException(status_code=404, detail="Alimento no encontrado")

    if data.recipe_id is not None:
        recipe = db.query(Recipe).filter(Recipe.id == data.recipe_id).first()
        if not recipe:
            raise HTTPException(status_code=404, detail="Receta no encontrada")

    new_item = MealItem(**data.dict())
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item


@router.get("/{meal_id}", response_model=list[MealItemResponse])
def get_meal_items(meal_id: int, db: Session = Depends(get_db)):
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Comida no encontrada")

    return db.query(MealItem).filter(MealItem.meal_id == meal_id).all()


@router.put("/{item_id}", response_model=MealItemResponse)
def update_meal_item(item_id: int, data: MealItemUpdate, db: Session = Depends(get_db)):
    item = db.query(MealItem).filter(MealItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Elemento no encontrado")

    if data.food_id is None and data.recipe_id is None:
        raise HTTPException(status_code=400, detail="Debes indicar un food_id o un recipe_id")

    if data.food_id is not None and data.recipe_id is not None:
        raise HTTPException(status_code=400, detail="Solo puedes indicar food_id o recipe_id, no ambos")

    if data.food_id is not None:
        food = db.query(Food).filter(Food.id == data.food_id).first()
        if not food:
            raise HTTPException(status_code=404, detail="Alimento no encontrado")

    if data.recipe_id is not None:
        recipe = db.query(Recipe).filter(Recipe.id == data.recipe_id).first()
        if not recipe:
            raise HTTPException(status_code=404, detail="Receta no encontrada")

    item.food_id = data.food_id
    item.recipe_id = data.recipe_id
    item.cantidad = data.cantidad
    item.notas = data.notas

    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}")
def delete_meal_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(MealItem).filter(MealItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Elemento no encontrado")

    db.delete(item)
    db.commit()
    return {"message": "Elemento eliminado"}
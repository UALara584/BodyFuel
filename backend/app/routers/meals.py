from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Meal, WeeklyPlan
from ..schemas import MealCreate, MealUpdate, MealResponse

router = APIRouter(prefix="/meals", tags=["Meals"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=MealResponse)
def create_meal(data: MealCreate, db: Session = Depends(get_db)):
    plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == data.weekly_plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan semanal no encontrado")

    new_meal = Meal(**data.dict())
    db.add(new_meal)
    db.commit()
    db.refresh(new_meal)
    return new_meal


@router.get("/{plan_id}", response_model=list[MealResponse])
def get_meals_by_plan(plan_id: int, db: Session = Depends(get_db)):
    return db.query(Meal).filter(Meal.weekly_plan_id == plan_id).all()


@router.put("/{meal_id}", response_model=MealResponse)
def update_meal(meal_id: int, data: MealUpdate, db: Session = Depends(get_db)):
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Comida no encontrada")

    meal.dia = data.dia
    meal.tipo_comida = data.tipo_comida
    meal.hora = data.hora

    db.commit()
    db.refresh(meal)
    return meal


@router.delete("/{meal_id}")
def delete_meal(meal_id: int, db: Session = Depends(get_db)):
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Comida no encontrada")

    db.delete(meal)
    db.commit()
    return {"message": "Comida eliminada"}
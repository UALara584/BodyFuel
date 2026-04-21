from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..database import SessionLocal
from ..models import WeeklyPlan, User, Meal, MealItem
from ..schemas import WeeklyPlanCreate, WeeklyPlanResponse, WeeklyPlanFullResponse

router = APIRouter(prefix="/plans", tags=["Plans"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=WeeklyPlanResponse)
def create_plan(data: WeeklyPlanCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    existing_plan = db.query(WeeklyPlan).filter(
        WeeklyPlan.user_id == data.user_id,
        WeeklyPlan.semana_inicio == data.semana_inicio
    ).first()

    if existing_plan:
        raise HTTPException(status_code=400, detail="Ya existe un plan para esa semana")

    new_plan = WeeklyPlan(**data.dict())
    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)
    return new_plan


@router.get("/{user_id}/{week_start}", response_model=WeeklyPlanResponse)
def get_plan(user_id: int, week_start: str, db: Session = Depends(get_db)):
    plan = db.query(WeeklyPlan).filter(
        WeeklyPlan.user_id == user_id,
        WeeklyPlan.semana_inicio == week_start
    ).first()

    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")

    return plan


@router.get("/{user_id}/{week_start}/full", response_model=WeeklyPlanFullResponse)
def get_full_plan(user_id: int, week_start: str, db: Session = Depends(get_db)):
    plan = (
        db.query(WeeklyPlan)
        .options(
            joinedload(WeeklyPlan.meals)
            .joinedload(Meal.items)
            .joinedload(MealItem.food),

            joinedload(WeeklyPlan.meals)
            .joinedload(Meal.items)
            .joinedload(MealItem.recipe),
        )
        .filter(
            WeeklyPlan.user_id == user_id,
            WeeklyPlan.semana_inicio == week_start
        )
        .first()
    )

    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")

    return plan
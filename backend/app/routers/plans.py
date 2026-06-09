from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..database import SessionLocal
from ..models import ChatMessage, ChatParticipant, WeeklyPlan, User, Meal, MealItem
from ..schemas import (
    WeeklyPlanCreate,
    WeeklyPlanFullResponse,
    WeeklyPlanResponse,
    WeeklyPlanUpdate,
)

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

    plan_data = data.model_dump()
    plan_data["nombre"] = data.nombre.strip()
    new_plan = WeeklyPlan(**plan_data)
    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)
    return new_plan


@router.get("/shared/{plan_id}/full", response_model=WeeklyPlanFullResponse)
def get_shared_full_plan(plan_id: int, user_id: int, db: Session = Depends(get_db)):
    shared_message = (
        db.query(ChatMessage.id)
        .join(
            ChatParticipant,
            ChatParticipant.conversation_id == ChatMessage.conversation_id,
        )
        .filter(
            ChatMessage.weekly_plan_id == plan_id,
            ChatMessage.message_type == "weekly_plan_share",
            ChatParticipant.user_id == user_id,
        )
        .first()
    )

    if not shared_message:
        raise HTTPException(status_code=403, detail="No tienes acceso a este plan compartido")

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
        .filter(WeeklyPlan.id == plan_id)
        .first()
    )

    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")

    return plan


@router.put("/{plan_id}", response_model=WeeklyPlanResponse)
def update_plan(plan_id: int, data: WeeklyPlanUpdate, db: Session = Depends(get_db)):
    plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == plan_id).first()

    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    if plan.user_id != data.user_id:
        raise HTTPException(status_code=403, detail="No puedes modificar este plan")

    plan.nombre = data.nombre.strip()
    db.commit()
    db.refresh(plan)
    return plan


@router.post("/{plan_id}/clear")
def clear_plan(plan_id: int, user_id: int, db: Session = Depends(get_db)):
    plan = (
        db.query(WeeklyPlan)
        .options(joinedload(WeeklyPlan.meals).joinedload(Meal.items))
        .filter(WeeklyPlan.id == plan_id)
        .first()
    )

    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    if plan.user_id != user_id:
        raise HTTPException(status_code=403, detail="No puedes vaciar este plan")

    deleted_meals = len(plan.meals)
    for meal in list(plan.meals):
        db.delete(meal)

    db.commit()
    return {"message": "Plan vaciado", "deleted_meals": deleted_meals}


@router.delete("/{plan_id}")
def delete_plan(plan_id: int, user_id: int, db: Session = Depends(get_db)):
    plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == plan_id).first()

    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    if plan.user_id != user_id:
        raise HTTPException(status_code=403, detail="No puedes eliminar este plan")

    db.query(ChatMessage).filter(ChatMessage.weekly_plan_id == plan.id).update(
        {ChatMessage.weekly_plan_id: None},
        synchronize_session=False,
    )
    db.delete(plan)
    db.commit()
    return {"message": "Plan eliminado"}


@router.get("/{user_id}/{week_start}", response_model=WeeklyPlanResponse)
def get_plan(user_id: int, week_start: str, db: Session = Depends(get_db)):
    plan = db.query(WeeklyPlan).filter(
        WeeklyPlan.user_id == user_id,
        WeeklyPlan.semana_inicio == week_start
    ).first()

    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")

    return plan


@router.get("/user/{user_id}/full", response_model=list[WeeklyPlanFullResponse])
def get_user_full_plans(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    return (
        db.query(WeeklyPlan)
        .options(
            joinedload(WeeklyPlan.meals)
            .joinedload(Meal.items)
            .joinedload(MealItem.food),

            joinedload(WeeklyPlan.meals)
            .joinedload(Meal.items)
            .joinedload(MealItem.recipe),
        )
        .filter(WeeklyPlan.user_id == user_id)
        .order_by(WeeklyPlan.semana_inicio.asc())
        .all()
    )


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

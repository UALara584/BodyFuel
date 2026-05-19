from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import (
    AssistantMessage,
    ChatConversation,
    ChatMessage,
    ChatParticipant,
    Food,
    Friendship,
    Meal,
    MealItem,
    Recipe,
    RecipeItem,
    Tracking,
    User,
    WeeklyPlan,
)
from ..schemas import AuthCredentials, UserCreate, UserDeleteConfirm, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])
USER_NOT_FOUND = "Usuario no encontrado"
INVALID_CREDENTIALS = "Correo o contraseña incorrectos"

ACTIVITY_FACTORS = {
    1: 1.2,
    2: 1.375,
    3: 1.55,
    4: 1.725,
    5: 1.9,
}


def calculate_age(fecha_nacimiento: date | None) -> int | None:
    if not fecha_nacimiento:
        return None

    today = date.today()
    age = today.year - fecha_nacimiento.year
    if (today.month, today.day) < (fecha_nacimiento.month, fecha_nacimiento.day):
        age -= 1
    return age


def normalize_objective(objetivo: str | None) -> str:
    text = (objetivo or "").strip().lower()
    if text in {"volumen", "ganar", "ganar_musculo"}:
        return "ganar"
    if text in {"definicion", "definición", "perder", "perder_peso"}:
        return "perder"
    return "mantener"


def calculate_target_calories(user_data: dict) -> int | None:
    peso = user_data.get("peso")
    altura = user_data.get("altura")
    sexo = user_data.get("sexo")
    edad = user_data.get("edad") or calculate_age(user_data.get("fecha_nacimiento"))

    if not peso or not altura or not sexo or not edad:
        return user_data.get("calorias_objetivo")

    bmr = (10 * float(peso)) + (6.25 * float(altura)) - (5 * int(edad))
    bmr += 5 if sexo == "hombre" else -161
    activity_factor = ACTIVITY_FACTORS.get(int(user_data.get("nivel_actividad") or 3), ACTIVITY_FACTORS[3])
    tdee = bmr * activity_factor
    objetivo = normalize_objective(user_data.get("objetivo"))

    if objetivo == "perder":
        return round(tdee - 500)
    if objetivo == "ganar":
        return round(tdee + 300)
    return round(tdee)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=UserResponse)
def create_user(user: UserCreate, db: Annotated[Session, Depends(get_db)]):
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Ese correo ya está registrado")

    user_data = user.dict()
    user_data["nombre"] = user_data.get("nombre") or user_data["email"]
    user_data["objetivo"] = normalize_objective(user_data.get("objetivo"))
    user_data["edad"] = user_data.get("edad") or calculate_age(user_data.get("fecha_nacimiento"))
    user_data["calorias_objetivo"] = calculate_target_calories(user_data)

    new_user = User(**user_data)
    db.add(new_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Ese correo ya está registrado")
    db.refresh(new_user)
    return new_user


@router.post("/register", response_model=UserResponse)
def register_user(user: UserCreate, db: Annotated[Session, Depends(get_db)]):
    return create_user(user, db)


@router.post("/login", response_model=UserResponse, responses={401: {"description": INVALID_CREDENTIALS}})
def login_user(credentials: AuthCredentials, db: Annotated[Session, Depends(get_db)]):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or user.password != credentials.password:
        raise HTTPException(status_code=401, detail=INVALID_CREDENTIALS)

    return user


@router.get("/", response_model=list[UserResponse])
def get_users(db: Annotated[Session, Depends(get_db)]):
    return db.query(User).all()


@router.get("/{user_id}", response_model=UserResponse, responses={404: {"description": USER_NOT_FOUND}})
def get_user(user_id: int, db: Annotated[Session, Depends(get_db)]):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail=USER_NOT_FOUND)

    return user


@router.put("/{user_id}", response_model=UserResponse, responses={404: {"description": USER_NOT_FOUND}})
def update_user(user_id: int, data: UserUpdate, db: Annotated[Session, Depends(get_db)]):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail=USER_NOT_FOUND)

    update_data = data.dict(exclude_unset=True)

    if "email" in update_data:
        email_exists = (
            db.query(User)
            .filter(User.email == update_data["email"], User.id != user_id)
            .first()
        )
        if email_exists:
            raise HTTPException(status_code=400, detail="Ese correo ya está registrado")
        user.email = update_data["email"]

    if "password" in update_data:
        user.password = update_data["password"]

    if "nombre" in update_data:
        user.nombre = update_data["nombre"] or user.email

    profile_keys = [
        "edad",
        "fecha_nacimiento",
        "sexo",
        "peso",
        "altura",
        "peso_objetivo_kg",
        "nivel_actividad",
        "objetivo",
        "tipo_dieta",
        "intolerancias",
        "calorias_objetivo",
    ]

    has_manual_calories = "calorias_objetivo" in update_data

    if "objetivo" in update_data:
        update_data["objetivo"] = normalize_objective(update_data.get("objetivo"))

    for key in profile_keys:
        if key in update_data:
            setattr(user, key, update_data[key])

    recalculation_keys = {
        "fecha_nacimiento",
        "sexo",
        "peso",
        "altura",
        "nivel_actividad",
        "objetivo",
    }
    if recalculation_keys.intersection(update_data):
        user.edad = calculate_age(user.fecha_nacimiento) or user.edad
        if not has_manual_calories:
            user.calorias_objetivo = calculate_target_calories(
                {
                    "fecha_nacimiento": user.fecha_nacimiento,
                    "sexo": user.sexo,
                    "peso": user.peso,
                    "altura": user.altura,
                    "nivel_actividad": user.nivel_actividad,
                    "objetivo": user.objetivo,
                    "edad": user.edad,
                    "calorias_objetivo": user.calorias_objetivo,
                }
            )

    db.commit()
    db.refresh(user)
    return user


def delete_user_with_password(user_id: int, data: UserDeleteConfirm, db: Session):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail=USER_NOT_FOUND)

    if user.password != data.password:
        raise HTTPException(status_code=401, detail=INVALID_CREDENTIALS)

    recipe_ids = select(Recipe.id).where(Recipe.user_id == user_id)
    food_ids = select(Food.id).where(Food.user_id == user_id)
    plan_ids = select(WeeklyPlan.id).where(WeeklyPlan.user_id == user_id)
    meal_ids = select(Meal.id).where(Meal.weekly_plan_id.in_(plan_ids))

    db.query(MealItem).filter(
        or_(
            MealItem.meal_id.in_(meal_ids),
            MealItem.recipe_id.in_(recipe_ids),
            MealItem.food_id.in_(food_ids),
        )
    ).delete(synchronize_session=False)
    db.query(RecipeItem).filter(
        or_(
            RecipeItem.recipe_id.in_(recipe_ids),
            RecipeItem.food_id.in_(food_ids),
        )
    ).delete(synchronize_session=False)
    db.query(Meal).filter(Meal.weekly_plan_id.in_(plan_ids)).delete(synchronize_session=False)
    db.query(WeeklyPlan).filter(WeeklyPlan.user_id == user_id).delete(synchronize_session=False)
    db.query(Recipe).filter(Recipe.user_id == user_id).delete(synchronize_session=False)
    db.query(Food).filter(Food.user_id == user_id).delete(synchronize_session=False)
    db.query(Tracking).filter(Tracking.user_id == user_id).delete(synchronize_session=False)
    db.query(AssistantMessage).filter(AssistantMessage.user_id == user_id).delete(synchronize_session=False)
    chat_conversation_ids = [
        row[0]
        for row in db.query(ChatParticipant.conversation_id)
        .filter(ChatParticipant.user_id == user_id)
        .all()
    ]
    if chat_conversation_ids:
        db.query(ChatMessage).filter(ChatMessage.conversation_id.in_(chat_conversation_ids)).delete(
            synchronize_session=False
        )
        db.query(ChatParticipant).filter(ChatParticipant.conversation_id.in_(chat_conversation_ids)).delete(
            synchronize_session=False
        )
        db.query(ChatConversation).filter(ChatConversation.id.in_(chat_conversation_ids)).delete(
            synchronize_session=False
        )
    db.query(Friendship).filter(
        or_(Friendship.requester_id == user_id, Friendship.addressee_id == user_id)
    ).delete(synchronize_session=False)

    db.delete(user)
    db.commit()

    return {"message": "Usuario eliminado"}


@router.post("/{user_id}/delete-confirm", responses={404: {"description": USER_NOT_FOUND}})
def confirm_delete_user(user_id: int, data: UserDeleteConfirm, db: Annotated[Session, Depends(get_db)]):
    return delete_user_with_password(user_id, data, db)


@router.delete("/{user_id}", responses={404: {"description": USER_NOT_FOUND}})
def delete_user(user_id: int, data: UserDeleteConfirm, db: Annotated[Session, Depends(get_db)]):
    return delete_user_with_password(user_id, data, db)

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import User
from ..schemas import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])
USER_NOT_FOUND = "Usuario no encontrado"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=UserResponse)
def create_user(user: UserCreate, db: Annotated[Session, Depends(get_db)]):
    user_data = user.dict()
    user_data["nombre"] = user_data.get("nombre") or user_data["email"]
    new_user = User(**user_data)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


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
        user.email = update_data["email"]

    if "password" in update_data:
        user.password = update_data["password"]

    if "nombre" in update_data:
        user.nombre = update_data["nombre"] or user.email

    for key in ["edad", "peso", "altura", "objetivo", "calorias_objetivo"]:
        if key in update_data:
            setattr(user, key, update_data[key])

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", responses={404: {"description": USER_NOT_FOUND}})
def delete_user(user_id: int, db: Annotated[Session, Depends(get_db)]):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail=USER_NOT_FOUND)

    db.delete(user)
    db.commit()

    return {"message": "Usuario eliminado"}
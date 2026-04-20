from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Tracking, User
from ..schemas import TrackingCreate, TrackingUpdate, TrackingResponse

router = APIRouter(prefix="/tracking", tags=["Tracking"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=TrackingResponse)
def create_tracking(data: TrackingCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    new_entry = Tracking(**data.dict())
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    return new_entry


@router.get("/{user_id}", response_model=list[TrackingResponse])
def get_tracking_by_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    return db.query(Tracking).filter(Tracking.user_id == user_id).order_by(Tracking.fecha.desc()).all()


@router.put("/{tracking_id}", response_model=TrackingResponse)
def update_tracking(tracking_id: int, data: TrackingUpdate, db: Session = Depends(get_db)):
    entry = db.query(Tracking).filter(Tracking.id == tracking_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    entry.fecha = data.fecha
    entry.peso = data.peso
    entry.calorias_consumidas = data.calorias_consumidas

    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{tracking_id}")
def delete_tracking(tracking_id: int, db: Session = Depends(get_db)):
    entry = db.query(Tracking).filter(Tracking.id == tracking_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    db.delete(entry)
    db.commit()
    return {"message": "Registro eliminado"}
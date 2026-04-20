from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    edad = Column(Integer)
    peso = Column(Float)
    altura = Column(Float)
    objetivo = Column(String)
    calorias_objetivo = Column(Integer)

    tracking_entries = relationship("Tracking", back_populates="user", cascade="all, delete")


class Tracking(Base):
    __tablename__ = "tracking"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    fecha = Column(Date, nullable=False)
    peso = Column(Float)
    calorias_consumidas = Column(Integer)

    user = relationship("User", back_populates="tracking_entries")
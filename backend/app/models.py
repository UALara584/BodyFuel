from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Text, ForeignKey, func
from sqlalchemy.orm import relationship
from .database import Base

CASCADE_DELETE = "all, delete"
USER_FK = "users.id"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False, unique=True, index=True)
    password = Column(String, nullable=False)
    nombre = Column(String, nullable=False)
    edad = Column(Integer)
    peso = Column(Float)
    altura = Column(Float)
    objetivo = Column(String)
    calorias_objetivo = Column(Integer)

    tracking_entries = relationship("Tracking", back_populates="user", cascade=CASCADE_DELETE)
    plans = relationship("WeeklyPlan", cascade=CASCADE_DELETE)
    assistant_messages = relationship("AssistantMessage", back_populates="user", cascade=CASCADE_DELETE)

class Tracking(Base):
    __tablename__ = "tracking"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey(USER_FK), nullable=False)
    fecha = Column(Date, nullable=False)
    peso = Column(Float)
    calorias_consumidas = Column(Integer)

    user = relationship("User", back_populates="tracking_entries")
    
class Food(Base):
    __tablename__ = "foods"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False, index=True)
    calorias = Column(Float, nullable=False)
    proteinas = Column(Float, nullable=False)
    carbos = Column(Float, nullable=False)
    grasas = Column(Float, nullable=False)
    fuente = Column(String, nullable=False)
    meal_items = relationship("MealItem", back_populates="food")
    
class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False, index=True)
    ingredientes = Column(String, nullable=False)
    calorias_totales = Column(Float, nullable=False)
    tiempo_preparacion = Column(Integer, nullable=False)
    tipo_dieta = Column(String, nullable=True, index=True)
    fuente_url = Column(String, nullable=True)
    origen = Column(String, nullable=False)
    meal_items = relationship("MealItem", back_populates="recipe")

class WeeklyPlan(Base):
    __tablename__ = "weekly_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey(USER_FK), nullable=False)
    semana_inicio = Column(Date, nullable=False)

    meals = relationship("Meal", back_populates="weekly_plan", cascade="all, delete")
    
class Meal(Base):
    __tablename__ = "meals"

    id = Column(Integer, primary_key=True, index=True)
    weekly_plan_id = Column(Integer, ForeignKey("weekly_plans.id"), nullable=False)
    dia = Column(String, nullable=False)
    tipo_comida = Column(String, nullable=False)
    hora = Column(String, nullable=False)
    items = relationship("MealItem", back_populates="meal", cascade=CASCADE_DELETE)

    weekly_plan = relationship("WeeklyPlan", back_populates="meals")
    items = relationship("MealItem", cascade=CASCADE_DELETE)
    
class MealItem(Base):
    __tablename__ = "meal_items"

    id = Column(Integer, primary_key=True, index=True)
    meal_id = Column(Integer, ForeignKey("meals.id"), nullable=False)
    food_id = Column(Integer, ForeignKey("foods.id"), nullable=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=True)
    cantidad = Column(Float, nullable=False)
    notas = Column(String, nullable=True)

    meal = relationship("Meal", back_populates="items")
    food = relationship("Food", back_populates="meal_items")
    recipe = relationship("Recipe", back_populates="meal_items")


class AssistantMessage(Base):
    __tablename__ = "assistant_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey(USER_FK), nullable=True, index=True)
    role = Column(String, nullable=False)  # user | assistant
    content = Column(Text, nullable=False)
    intent = Column(String, nullable=True)
    source = Column(String, nullable=True)  # local | llm
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    user = relationship("User", back_populates="assistant_messages")
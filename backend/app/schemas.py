from pydantic import BaseModel
from datetime import date


class UserCreate(BaseModel):
    email: str
    password: str
    nombre: str
    edad: int
    peso: float
    altura: float
    objetivo: str
    calorias_objetivo: int


class UserUpdate(BaseModel):
    email: str | None = None
    password: str | None = None
    nombre: str | None = None
    edad: int | None = None
    peso: float | None = None
    altura: float | None = None
    objetivo: str | None = None
    calorias_objetivo: int | None = None


class UserResponse(UserCreate):
    id: int

    class Config:
        from_attributes = True


class AuthCredentials(BaseModel):
    email: str
    password: str


class TrackingCreate(BaseModel):
    user_id: int
    fecha: date
    peso: float
    calorias_consumidas: int


class TrackingUpdate(BaseModel):
    fecha: date
    peso: float
    calorias_consumidas: int


class TrackingResponse(TrackingCreate):
    id: int

    class Config:
        from_attributes = True
        
class FoodCreate(BaseModel):
    nombre: str
    calorias: float
    proteinas: float
    carbos: float
    grasas: float
    fuente: str


class FoodResponse(FoodCreate):
    id: int

    class Config:
        from_attributes = True

class RecipeCreate(BaseModel):
    nombre: str
    ingredientes: str
    calorias_totales: float
    tiempo_preparacion: int
    tipo_dieta: str | None = None
    fuente_url: str | None = None
    origen: str


class RecipeResponse(RecipeCreate):
    id: int

    class Config:
        from_attributes = True
        
class WeeklyPlanCreate(BaseModel):
    user_id: int
    semana_inicio: date


class WeeklyPlanResponse(WeeklyPlanCreate):
    id: int

    class Config:
        from_attributes = True

class MealCreate(BaseModel):
    weekly_plan_id: int
    dia: str
    tipo_comida: str
    hora: str


class MealUpdate(BaseModel):
    dia: str
    tipo_comida: str
    hora: str


class MealResponse(MealCreate):
    id: int

    class Config:
        from_attributes = True

class MealItemCreate(BaseModel):
    meal_id: int
    food_id: int | None = None
    recipe_id: int | None = None
    cantidad: float
    notas: str | None = None


class MealItemUpdate(BaseModel):
    food_id: int | None = None
    recipe_id: int | None = None
    cantidad: float
    notas: str | None = None


class MealItemResponse(MealItemCreate):
    id: int

    class Config:
        from_attributes = True

class FoodMini(BaseModel):
    id: int
    nombre: str
    calorias: float
    proteinas: float
    carbos: float
    grasas: float
    fuente: str

    class Config:
        from_attributes = True


class RecipeMini(BaseModel):
    id: int
    nombre: str
    ingredientes: str
    calorias_totales: float
    tiempo_preparacion: int
    tipo_dieta: str | None = None
    fuente_url: str | None = None
    origen: str

    class Config:
        from_attributes = True
        
class MealItemDetailResponse(BaseModel):
    id: int
    cantidad: float
    notas: str | None = None
    food: FoodMini | None = None
    recipe: RecipeMini | None = None

    class Config:
        from_attributes = True
        
class MealDetailResponse(BaseModel):
    id: int
    weekly_plan_id: int
    dia: str
    tipo_comida: str
    hora: str
    items: list[MealItemDetailResponse] = []

    class Config:
        from_attributes = True
        
class WeeklyPlanFullResponse(BaseModel):
    id: int
    user_id: int
    semana_inicio: date
    meals: list[MealDetailResponse] = []

    class Config:
        from_attributes = True
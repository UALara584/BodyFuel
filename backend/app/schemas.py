from pydantic import BaseModel, Field
from datetime import date, datetime


class UserCreate(BaseModel):
    email: str
    password: str
    nombre: str
    edad: int | None = None
    fecha_nacimiento: date | None = None
    sexo: str | None = None
    peso: float
    altura: float
    peso_objetivo_kg: float | None = None
    nivel_actividad: int | None = 3
    objetivo: str
    tipo_dieta: str | None = None
    intolerancias: list[str] = Field(default_factory=list)
    calorias_objetivo: int | None = None


class UserUpdate(BaseModel):
    email: str | None = None
    password: str | None = None
    nombre: str | None = None
    edad: int | None = None
    fecha_nacimiento: date | None = None
    sexo: str | None = None
    peso: float | None = None
    altura: float | None = None
    peso_objetivo_kg: float | None = None
    nivel_actividad: int | None = None
    objetivo: str | None = None
    tipo_dieta: str | None = None
    intolerancias: list[str] | None = None
    calorias_objetivo: int | None = None


class UserDeleteConfirm(BaseModel):
    password: str


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
    user_id: int | None = None


class FoodResponse(FoodCreate):
    id: int

    class Config:
        from_attributes = True

class RecipeIngredientResponse(BaseModel):
    id: int
    food_id: int
    gramos: float

    class Config:
        from_attributes = True


class RecipeCreate(BaseModel):
    nombre: str
    ingredientes: str
    calorias_totales: float
    proteinas: float
    carbos: float
    grasas: float
    tiempo_preparacion: int
    tipo_dieta: str | None = None
    fuente_url: str | None = None
    origen: str
    user_id: int | None = None


class RecipeResponse(RecipeCreate):
    id: int
    items: list[RecipeIngredientResponse] = Field(default_factory=list)

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
    proteinas: float
    carbos: float
    grasas: float
    tiempo_preparacion: int
    tipo_dieta: str | None = None
    fuente_url: str | None = None
    origen: str
    user_id: int | None = None

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
        
class FoodImportFromApi(BaseModel):
    nombre: str
    calorias: float
    proteinas: float
    carbos: float
    grasas: float
    fuente: str = "api"
    user_id: int | None = None


class RecipeItemCreate(BaseModel):
    food_id: int
    gramos: float


class RecipeCreateWithItems(BaseModel):
    nombre: str
    ingredientes: str | None = None
    tiempo_preparacion: int = 0
    tipo_dieta: str | None = None
    user_id: int | None = None
    items: list[RecipeItemCreate]


class RecipeCloneRequest(BaseModel):
    user_id: int | None = None


class FriendUser(BaseModel):
    id: int
    nombre: str
    email: str

    class Config:
        from_attributes = True


class FriendshipCreate(BaseModel):
    requester_id: int
    addressee_id: int


class FriendshipRespond(BaseModel):
    user_id: int
    accept: bool


class FriendInvitationItem(BaseModel):
    invitation_id: int
    user: FriendUser


class FriendshipListResponse(BaseModel):
    friends: list[FriendUser]
    incoming: list[FriendInvitationItem]
    outgoing: list[FriendInvitationItem]


class ChatConversationCreate(BaseModel):
    user_id: int
    other_user_id: int


class ChatRecipeShare(BaseModel):
    id: int
    nombre: str
    imagen_url: str | None = None
    tiempo_preparacion: int | None = None
    calorias_totales: float | None = None
    proteinas: float | None = None
    carbos: float | None = None
    grasas: float | None = None
    fuente_url: str | None = None


class ChatWeeklyPlanShare(BaseModel):
    id: int
    nombre: str
    semana_inicio: date
    semana_fin: date
    meal_count: int
    recipe_count: int
    food_count: int


class ChatMessageCreate(BaseModel):
    user_id: int
    content: str | None = None
    message_type: str = "text"
    recipe_id: int | None = None
    weekly_plan_id: int | None = None


class ChatMessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender: FriendUser
    message_type: str
    content: str | None = None
    recipe: ChatRecipeShare | None = None
    weekly_plan: ChatWeeklyPlanShare | None = None
    created_at: datetime
    read_at: datetime | None = None


class ChatConversationResponse(BaseModel):
    id: int
    other_user: FriendUser
    last_message: ChatMessageResponse | None = None
    last_message_at: datetime | None = None
    unread_count: int = 0
    created_at: datetime
    updated_at: datetime


class ChatReadRequest(BaseModel):
    user_id: int

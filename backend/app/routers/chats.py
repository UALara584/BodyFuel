from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from ..database import SessionLocal
from ..models import (
    ChatConversation,
    ChatMessage,
    ChatParticipant,
    Meal,
    Recipe,
    User,
    WeeklyPlan,
)
from ..schemas import (
    ChatConversationCreate,
    ChatConversationResponse,
    ChatMessageCreate,
    ChatMessageResponse,
    ChatReadRequest,
    ChatRecipeShare,
    ChatWeeklyPlanShare,
    FriendUser,
)

router = APIRouter(prefix="/chats", tags=["Chats"])

VALID_MESSAGE_TYPES = {"text", "recipe_share", "weekly_plan_share"}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def make_conversation_key(user_a: int, user_b: int) -> str:
    first, second = sorted([user_a, user_b])
    return f"{first}:{second}"


def get_user_or_404(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


def get_conversation_for_user(
    db: Session, conversation_id: int, user_id: int
) -> ChatConversation:
    conversation = (
        db.query(ChatConversation)
        .options(joinedload(ChatConversation.participants).joinedload(ChatParticipant.user))
        .filter(ChatConversation.id == conversation_id)
        .first()
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")

    if not any(participant.user_id == user_id for participant in conversation.participants):
        raise HTTPException(status_code=403, detail="No perteneces a esta conversacion")

    return conversation


def get_plan_share(plan: WeeklyPlan | None) -> ChatWeeklyPlanShare | None:
    if not plan:
        return None

    recipe_ids: set[int] = set()
    food_ids: set[int] = set()
    meals = plan.meals or []

    for meal in meals:
        for item in meal.items or []:
            if item.recipe_id:
                recipe_ids.add(item.recipe_id)
            if item.food_id:
                food_ids.add(item.food_id)

    return ChatWeeklyPlanShare(
        id=plan.id,
        nombre="Plan semanal",
        semana_inicio=plan.semana_inicio,
        semana_fin=plan.semana_inicio + timedelta(days=6),
        meal_count=len(meals),
        recipe_count=len(recipe_ids),
        food_count=len(food_ids),
    )


def get_recipe_share(recipe: Recipe | None) -> ChatRecipeShare | None:
    if not recipe:
        return None

    return ChatRecipeShare(
        id=recipe.id,
        nombre=recipe.nombre,
        imagen_url=None,
        tiempo_preparacion=recipe.tiempo_preparacion,
        calorias_totales=recipe.calorias_totales,
        proteinas=recipe.proteinas,
        carbos=recipe.carbos,
        grasas=recipe.grasas,
        fuente_url=recipe.fuente_url,
    )


def get_message_response(message: ChatMessage) -> ChatMessageResponse:
    return ChatMessageResponse(
        id=message.id,
        conversation_id=message.conversation_id,
        sender=FriendUser.model_validate(message.sender),
        message_type=message.message_type,
        content=message.content,
        recipe=get_recipe_share(message.recipe),
        weekly_plan=get_plan_share(message.weekly_plan),
        created_at=message.created_at,
        read_at=message.read_at,
    )


def get_last_message(db: Session, conversation_id: int) -> ChatMessage | None:
    return (
        db.query(ChatMessage)
        .options(
            joinedload(ChatMessage.sender),
            joinedload(ChatMessage.recipe),
            joinedload(ChatMessage.weekly_plan)
            .joinedload(WeeklyPlan.meals)
            .joinedload(Meal.items),
        )
        .filter(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .first()
    )


def get_conversation_response(
    db: Session, conversation: ChatConversation, user_id: int
) -> ChatConversationResponse:
    other_participant = next(
        (participant for participant in conversation.participants if participant.user_id != user_id),
        None,
    )

    if not other_participant:
        raise HTTPException(status_code=400, detail="Conversacion sin otro participante")

    last_message = get_last_message(db, conversation.id)
    unread_count = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.conversation_id == conversation.id,
            ChatMessage.sender_id != user_id,
            ChatMessage.read_at.is_(None),
        )
        .count()
    )

    return ChatConversationResponse(
        id=conversation.id,
        other_user=FriendUser.model_validate(other_participant.user),
        last_message=get_message_response(last_message) if last_message else None,
        last_message_at=last_message.created_at if last_message else conversation.updated_at,
        unread_count=unread_count,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
    )


@router.get("/users/search", response_model=list[FriendUser])
def search_chat_users(
    db: Annotated[Session, Depends(get_db)],
    user_id: int = Query(...),
    q: str = Query(default=""),
):
    get_user_or_404(db, user_id)
    query_text = q.strip()

    users_query = db.query(User).filter(User.id != user_id)
    if query_text:
        users_query = users_query.filter(
            or_(
                User.nombre.ilike(f"%{query_text}%"),
                User.email.ilike(f"%{query_text}%"),
            )
        )

    users = users_query.order_by(User.nombre.asc()).limit(20).all()
    return [FriendUser.model_validate(user) for user in users]


@router.post("/conversations", response_model=ChatConversationResponse)
def create_or_get_conversation(
    payload: ChatConversationCreate,
    db: Annotated[Session, Depends(get_db)],
):
    if payload.user_id == payload.other_user_id:
        raise HTTPException(status_code=400, detail="No puedes chatear contigo mismo")

    get_user_or_404(db, payload.user_id)
    get_user_or_404(db, payload.other_user_id)

    conversation_key = make_conversation_key(payload.user_id, payload.other_user_id)
    conversation = (
        db.query(ChatConversation)
        .options(joinedload(ChatConversation.participants).joinedload(ChatParticipant.user))
        .filter(ChatConversation.conversation_key == conversation_key)
        .first()
    )

    if conversation:
        return get_conversation_response(db, conversation, payload.user_id)

    conversation = ChatConversation(conversation_key=conversation_key)
    db.add(conversation)
    db.flush()
    db.add_all(
        [
            ChatParticipant(conversation_id=conversation.id, user_id=payload.user_id),
            ChatParticipant(conversation_id=conversation.id, user_id=payload.other_user_id),
        ]
    )
    db.commit()

    conversation = get_conversation_for_user(db, conversation.id, payload.user_id)
    return get_conversation_response(db, conversation, payload.user_id)


@router.get("/conversations/{user_id}", response_model=list[ChatConversationResponse])
def list_conversations(user_id: int, db: Annotated[Session, Depends(get_db)]):
    get_user_or_404(db, user_id)

    conversation_ids = select(ChatParticipant.conversation_id).where(ChatParticipant.user_id == user_id)
    conversations = (
        db.query(ChatConversation)
        .options(joinedload(ChatConversation.participants).joinedload(ChatParticipant.user))
        .filter(ChatConversation.id.in_(conversation_ids))
        .all()
    )
    responses = [
        get_conversation_response(db, conversation, user_id)
        for conversation in conversations
    ]

    return sorted(
        responses,
        key=lambda item: item.last_message_at or item.updated_at,
        reverse=True,
    )


@router.get("/conversations/{conversation_id}/messages", response_model=list[ChatMessageResponse])
def list_messages(
    conversation_id: int,
    db: Annotated[Session, Depends(get_db)],
    user_id: int = Query(...),
):
    get_conversation_for_user(db, conversation_id, user_id)

    messages = (
        db.query(ChatMessage)
        .options(
            joinedload(ChatMessage.sender),
            joinedload(ChatMessage.recipe),
            joinedload(ChatMessage.weekly_plan)
            .joinedload(WeeklyPlan.meals)
            .joinedload(Meal.items),
        )
        .filter(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
        .all()
    )

    return [get_message_response(message) for message in messages]


@router.post("/conversations/{conversation_id}/messages", response_model=ChatMessageResponse)
def send_message(
    conversation_id: int,
    payload: ChatMessageCreate,
    db: Annotated[Session, Depends(get_db)],
):
    conversation = get_conversation_for_user(db, conversation_id, payload.user_id)
    message_type = payload.message_type

    if message_type not in VALID_MESSAGE_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de mensaje no soportado")

    content = (payload.content or "").strip() or None
    recipe_id = None
    weekly_plan_id = None

    if message_type == "text":
        if not content:
            raise HTTPException(status_code=400, detail="Escribe un mensaje")
    elif message_type == "recipe_share":
        if not payload.recipe_id:
            raise HTTPException(status_code=400, detail="Selecciona una receta")
        recipe = db.query(Recipe).filter(Recipe.id == payload.recipe_id).first()
        if not recipe:
            raise HTTPException(status_code=404, detail="Receta no encontrada")
        recipe_id = recipe.id
        content = content or "Te compartio una receta"
    elif message_type == "weekly_plan_share":
        if not payload.weekly_plan_id:
            raise HTTPException(status_code=400, detail="Selecciona un plan semanal")
        plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == payload.weekly_plan_id).first()
        if not plan:
            raise HTTPException(status_code=404, detail="Plan semanal no encontrado")
        if plan.user_id != payload.user_id:
            raise HTTPException(status_code=403, detail="Solo puedes compartir tus planes")
        weekly_plan_id = plan.id
        content = content or "Te compartio un plan semanal"

    message = ChatMessage(
        conversation_id=conversation.id,
        sender_id=payload.user_id,
        message_type=message_type,
        content=content,
        recipe_id=recipe_id,
        weekly_plan_id=weekly_plan_id,
    )
    conversation.updated_at = datetime.now(timezone.utc)

    db.add(message)
    db.commit()
    db.refresh(message)

    message = (
        db.query(ChatMessage)
        .options(
            joinedload(ChatMessage.sender),
            joinedload(ChatMessage.recipe),
            joinedload(ChatMessage.weekly_plan)
            .joinedload(WeeklyPlan.meals)
            .joinedload(Meal.items),
        )
        .filter(ChatMessage.id == message.id)
        .first()
    )
    return get_message_response(message)


@router.post("/conversations/{conversation_id}/read")
def mark_conversation_read(
    conversation_id: int,
    payload: ChatReadRequest,
    db: Annotated[Session, Depends(get_db)],
):
    get_conversation_for_user(db, conversation_id, payload.user_id)
    now = datetime.now(timezone.utc)

    updated = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.conversation_id == conversation_id,
            ChatMessage.sender_id != payload.user_id,
            ChatMessage.read_at.is_(None),
        )
        .update({ChatMessage.read_at: now}, synchronize_session=False)
    )
    participant = (
        db.query(ChatParticipant)
        .filter(
            ChatParticipant.conversation_id == conversation_id,
            ChatParticipant.user_id == payload.user_id,
        )
        .first()
    )
    if participant:
        participant.last_read_at = now

    db.commit()
    return {"updated": updated}

from __future__ import annotations

import json
import os
import re
import unicodedata
from datetime import datetime
from difflib import SequenceMatcher
from typing import Annotated, Iterable
from urllib.error import URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import AssistantMessage, Food, Recipe

router = APIRouter(prefix="/assistant", tags=["Assistant"])


class AssistantChatRequest(BaseModel):
    message: str
    max_results: int = 5
    user_id: int | None = None


class AssistantChatResponse(BaseModel):
    reply: str
    intent: str
    source: str = "local"
    matched_foods: list[str] = []
    matched_recipes: list[str] = []


class AssistantHistoryItem(BaseModel):
    id: int
    user_id: int | None
    role: str
    content: str
    intent: str | None = None
    source: str | None = None
    created_at: datetime


class AssistantHistoryResponse(BaseModel):
    items: list[AssistantHistoryItem]


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def normalize_text(text: str) -> str:
    cleaned = unicodedata.normalize("NFKD", text.lower())
    cleaned = "".join(ch for ch in cleaned if not unicodedata.combining(ch))
    cleaned = re.sub(r"[^a-z0-9\s]", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def metric_keywords(message: str) -> set[str]:
    keywords = {
        "calorias": ["caloria", "calorias", "kcal"],
        "proteinas": ["proteina", "proteinas"],
        "carbos": ["carbo", "carbos", "hidrato", "hidratos", "carbohidrato", "carbohidratos"],
        "grasas": ["grasa", "grasas", "lipido", "lipidos"],
    }

    found: set[str] = set()
    for metric, terms in keywords.items():
        if any(term in message for term in terms):
            found.add(metric)

    return found


def rank_matches_by_name(message_norm: str, entities: Iterable, max_results: int) -> list:
    ranked: list[tuple[float, object]] = []

    for entity in entities:
        name_norm = normalize_text(entity.nombre)

        if not name_norm:
            continue

        if name_norm in message_norm:
            ranked.append((2.0 + len(name_norm) / 100.0, entity))
            continue

        similarity = SequenceMatcher(None, message_norm, name_norm).ratio()
        token_similarity = max(
            (SequenceMatcher(None, token, name_norm).ratio() for token in message_norm.split()),
            default=0.0,
        )
        score = max(similarity, token_similarity)

        if score >= 0.6:
            ranked.append((score, entity))

    ranked.sort(key=lambda item: item[0], reverse=True)

    unique: list[object] = []
    seen_ids: set[int] = set()

    for _, entity in ranked:
        if entity.id in seen_ids:
            continue
        unique.append(entity)
        seen_ids.add(entity.id)
        if len(unique) >= max_results:
            break

    return unique


def rank_food_matches(message_norm: str, foods: list[Food], max_results: int) -> list[Food]:
    return rank_matches_by_name(message_norm, foods, max_results)


def rank_recipe_matches(message_norm: str, recipes: list[Recipe], max_results: int) -> list[Recipe]:
    return rank_matches_by_name(message_norm, recipes, max_results)


def format_food_line(food: Food) -> str:
    return (
        f"{food.nombre}: {food.calorias:.0f} kcal | "
        f"Proteinas {food.proteinas:.1f} g | "
        f"Carbos {food.carbos:.1f} g | "
        f"Grasas {food.grasas:.1f} g"
    )


def format_recipe_line(recipe: Recipe) -> str:
    return (
        f"{recipe.nombre}: {recipe.calorias_totales:.0f} kcal total | "
        f"Tiempo {recipe.tiempo_preparacion} min | "
        f"Tipo {recipe.tipo_dieta or 'No especificado'}"
    )


def save_message(
    db: Session,
    *,
    user_id: int | None,
    role: str,
    content: str,
    intent: str | None,
    source: str | None,
) -> None:
    item = AssistantMessage(
        user_id=user_id,
        role=role,
        content=content,
        intent=intent,
        source=source,
    )
    db.add(item)


def get_recent_history(db: Session, user_id: int | None, limit: int = 10) -> list[AssistantMessage]:
    if not user_id:
        return []

    rows = (
        db.query(AssistantMessage)
        .filter(AssistantMessage.user_id == user_id)
        .order_by(AssistantMessage.created_at.desc())
        .limit(limit)
        .all()
    )
    rows.reverse()
    return rows


def build_llm_context(foods: list[Food], recipes: list[Recipe]) -> str:
    food_lines = "\n".join(f"- {format_food_line(food)}" for food in foods[:6])
    recipe_lines = "\n".join(
        f"- {format_recipe_line(recipe)}{' | URL: ' + recipe.fuente_url if recipe.fuente_url else ''}"
        for recipe in recipes[:6]
    )
    return (
        "Alimentos relevantes:\n"
        f"{food_lines or '- Ninguno'}\n\n"
        "Recetas relevantes:\n"
        f"{recipe_lines or '- Ninguna'}"
    )


def ask_external_llm(
    message: str,
    history: list[AssistantMessage],
    matched_foods: list[Food],
    matched_recipes: list[Recipe],
) -> str | None:
    api_url = os.getenv("LLM_API_URL", "").strip()
    api_key = os.getenv("LLM_API_KEY", "").strip()
    model = os.getenv("LLM_MODEL", "gpt-4o-mini").strip()

    if not api_url or not api_key:
        return None

    system_prompt = (
        "Eres un asistente nutricional para BodyFuel. "
        "Responde en espanol claro y practico usando solo los datos proporcionados. "
        "Si faltan datos, dilo explicitamente."
    )

    llm_messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]

    for item in history[-8:]:
        llm_messages.append({"role": item.role, "content": item.content})

    context_block = build_llm_context(matched_foods, matched_recipes)
    llm_messages.append(
        {
            "role": "user",
            "content": f"Contexto de datos de BodyFuel:\n{context_block}\n\nPregunta: {message}",
        }
    )

    payload = {
        "model": model,
        "messages": llm_messages,
        "temperature": 0.2,
    }

    request = Request(
        url=api_url,
        method="POST",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )

    try:
        with urlopen(request, timeout=20) as response:
            data = json.loads(response.read().decode("utf-8"))
            content = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            return content or None
    except (URLError, TimeoutError, json.JSONDecodeError, KeyError, IndexError):
        return None


def save_chat_exchange(
    db: Session,
    *,
    user_id: int | None,
    user_message: str,
    assistant_reply: str,
    intent: str,
    source: str,
) -> None:
    save_message(
        db,
        user_id=user_id,
        role="user",
        content=user_message,
        intent="query",
        source="client",
    )
    save_message(
        db,
        user_id=user_id,
        role="assistant",
        content=assistant_reply,
        intent=intent,
        source=source,
    )
    db.commit()


def build_local_response(
    *,
    message_norm: str,
    max_results: int,
    foods: list[Food],
    recipes: list[Recipe],
    matched_foods: list[Food],
    matched_recipes: list[Recipe],
) -> AssistantChatResponse:
    compare_requested = any(word in message_norm for word in ["compar", "vs", "versus", "mejor"])
    top_protein_requested = "mas prote" in message_norm or "alto en prote" in message_norm
    low_cal_requested = "menos calor" in message_norm or "bajo en calor" in message_norm
    recipe_hint = any(word in message_norm for word in ["receta", "recetas", "preparar", "cocinar"])

    if top_protein_requested:
        return build_rank_response(foods, max_results, rank_type="protein")
    if low_cal_requested:
        return build_rank_response(foods, max_results, rank_type="low_calories")
    if compare_requested and len(matched_foods) >= 2:
        return build_compare_response(matched_foods[0], matched_foods[1])
    if matched_recipes and (recipe_hint or not matched_foods):
        return build_recipe_info_response(matched_recipes[:max_results], intent="recipe_info")
    if matched_foods:
        return build_food_info_response(message_norm, matched_foods[:max_results])
    if matched_recipes:
        return build_recipe_info_response(matched_recipes[:max_results], intent="recipe_suggestion")
    return build_fallback_response(foods, recipes)


@router.post("/chat", response_model=AssistantChatResponse)
def chat_with_assistant(payload: AssistantChatRequest, db: Annotated[Session, Depends(get_db)]):
    message = payload.message.strip()
    if not message:
        return AssistantChatResponse(
            reply="Escribe una pregunta para ayudarte con calorias, proteinas, carbos o grasas.",
            intent="empty",
            source="local",
            matched_foods=[],
            matched_recipes=[],
        )

    message_norm = normalize_text(message)
    foods = db.query(Food).all()
    recipes = db.query(Recipe).all()
    history = get_recent_history(db, payload.user_id, limit=12)

    if not foods and not recipes:
        response = AssistantChatResponse(
            reply="No hay alimentos ni recetas cargadas todavia. Agrega datos y vuelvo a ayudarte.",
            intent="no_data",
            source="local",
            matched_foods=[],
            matched_recipes=[],
        )
        save_chat_exchange(
            db,
            user_id=payload.user_id,
            user_message=message,
            assistant_reply=response.reply,
            intent=response.intent,
            source=response.source,
        )
        return response

    matched_foods = rank_food_matches(message_norm, foods, max_results=max(2, payload.max_results)) if foods else []
    matched_recipes = rank_recipe_matches(message_norm, recipes, max_results=max(2, payload.max_results)) if recipes else []

    llm_reply = ask_external_llm(message, history, matched_foods, matched_recipes)
    if llm_reply:
        llm_response = AssistantChatResponse(
            reply=llm_reply,
            intent="llm",
            source="llm",
            matched_foods=[food.nombre for food in matched_foods[: payload.max_results]],
            matched_recipes=[recipe.nombre for recipe in matched_recipes[: payload.max_results]],
        )
        save_chat_exchange(
            db,
            user_id=payload.user_id,
            user_message=message,
            assistant_reply=llm_response.reply,
            intent=llm_response.intent,
            source=llm_response.source,
        )
        return llm_response

    response = build_local_response(
        message_norm=message_norm,
        max_results=payload.max_results,
        foods=foods,
        recipes=recipes,
        matched_foods=matched_foods,
        matched_recipes=matched_recipes,
    )

    response.matched_foods = [food.nombre for food in matched_foods[: payload.max_results]]
    response.matched_recipes = [recipe.nombre for recipe in matched_recipes[: payload.max_results]]

    save_chat_exchange(
        db,
        user_id=payload.user_id,
        user_message=message,
        assistant_reply=response.reply,
        intent=response.intent,
        source=response.source,
    )

    return response


def build_rank_response(foods: list[Food], max_results: int, rank_type: str) -> AssistantChatResponse:
    if rank_type == "protein":
        top_foods = sorted(foods, key=lambda f: f.proteinas, reverse=True)[:max_results]
        reply = "Top alimentos con mas proteinas por cada registro:\n"
        intent = "top_protein"
    else:
        top_foods = sorted(foods, key=lambda f: f.calorias)[:max_results]
        reply = "Alimentos con menos calorias:\n"
        intent = "low_calories"

    reply += "\n".join(f"- {format_food_line(food)}" for food in top_foods)
    return AssistantChatResponse(
        reply=reply,
        intent=intent,
        source="local",
        matched_foods=[food.nombre for food in top_foods],
        matched_recipes=[],
    )


def build_compare_response(a: Food, b: Food) -> AssistantChatResponse:
    reply_lines = [
        f"Comparacion entre {a.nombre} y {b.nombre}:",
        f"- Calorias: {a.calorias:.0f} vs {b.calorias:.0f} kcal",
        f"- Proteinas: {a.proteinas:.1f} vs {b.proteinas:.1f} g",
        f"- Carbos: {a.carbos:.1f} vs {b.carbos:.1f} g",
        f"- Grasas: {a.grasas:.1f} vs {b.grasas:.1f} g",
    ]
    return AssistantChatResponse(
        reply="\n".join(reply_lines),
        intent="compare",
        source="local",
        matched_foods=[a.nombre, b.nombre],
        matched_recipes=[],
    )


def build_food_info_response(message_norm: str, foods: list[Food]) -> AssistantChatResponse:
    requested_metrics = metric_keywords(message_norm)

    if len(foods) == 1 and requested_metrics:
        food = foods[0]
        metric_text: list[str] = []
        if "calorias" in requested_metrics:
            metric_text.append(f"Calorias: {food.calorias:.0f} kcal")
        if "proteinas" in requested_metrics:
            metric_text.append(f"Proteinas: {food.proteinas:.1f} g")
        if "carbos" in requested_metrics:
            metric_text.append(f"Carbos: {food.carbos:.1f} g")
        if "grasas" in requested_metrics:
            metric_text.append(f"Grasas: {food.grasas:.1f} g")

        return AssistantChatResponse(
            reply=f"{food.nombre}: " + " | ".join(metric_text),
            intent="metric_query",
            source="local",
            matched_foods=[food.nombre],
            matched_recipes=[],
        )

    reply = "Esto es lo que encontre:\n" + "\n".join(f"- {format_food_line(food)}" for food in foods)
    return AssistantChatResponse(
        reply=reply,
        intent="food_info",
        source="local",
        matched_foods=[food.nombre for food in foods],
        matched_recipes=[],
    )


def build_recipe_info_response(recipes: list[Recipe], intent: str) -> AssistantChatResponse:
    reply = "Te recomiendo estas recetas:\n" + "\n".join(
        f"- {format_recipe_line(recipe)}{' | URL: ' + recipe.fuente_url if recipe.fuente_url else ''}"
        for recipe in recipes
    )
    return AssistantChatResponse(
        reply=reply,
        intent=intent,
        source="local",
        matched_foods=[],
        matched_recipes=[recipe.nombre for recipe in recipes],
    )


def build_fallback_response(foods: list[Food], recipes: list[Recipe]) -> AssistantChatResponse:
    suggestions = sorted(foods, key=lambda f: f.proteinas, reverse=True)[:3]
    recipe_suggestions = sorted(recipes, key=lambda r: r.calorias_totales)[:2]
    return AssistantChatResponse(
        reply=(
            "No encontre ese elemento exactamente. Puedes probar con preguntas como:\n"
            "- calorias de avena\n"
            "- proteinas del pollo\n"
            "- compara arroz vs quinoa\n\n"
            "- receta con pollo\n"
            "- receta baja en calorias\n\n"
            "Algunos alimentos disponibles ahora mismo:\n"
            + "\n".join(f"- {food.nombre}" for food in suggestions)
            + "\n\nRecetas destacadas:\n"
            + "\n".join(f"- {recipe.nombre}" for recipe in recipe_suggestions)
        ),
        intent="fallback",
        source="local",
        matched_foods=[],
        matched_recipes=[],
    )


@router.get("/history/{user_id}", response_model=AssistantHistoryResponse)
def get_assistant_history(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    limit: int = 50,
):
    limit_safe = min(max(limit, 1), 200)
    rows = (
        db.query(AssistantMessage)
        .filter(AssistantMessage.user_id == user_id)
        .order_by(AssistantMessage.created_at.asc())
        .limit(limit_safe)
        .all()
    )

    items = [
        AssistantHistoryItem(
            id=row.id,
            user_id=row.user_id,
            role=row.role,
            content=row.content,
            intent=row.intent,
            source=row.source,
            created_at=row.created_at,
        )
        for row in rows
    ]
    return AssistantHistoryResponse(items=items)


@router.delete("/history/{user_id}")
def clear_assistant_history(user_id: int, db: Annotated[Session, Depends(get_db)]):
    db.query(AssistantMessage).filter(AssistantMessage.user_id == user_id).delete()
    db.commit()
    return {"message": "Historial del asistente eliminado"}

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Food, Recipe, RecipeItem
from ..schemas import RecipeCloneRequest, RecipeCreate, RecipeCreateWithItems, RecipeItemCreate, RecipeResponse

router = APIRouter(prefix="/recipes", tags=["Recipes"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def apply_recipe_items(recipe: Recipe, items: list[RecipeItemCreate], db: Session) -> None:
    if not items:
        raise HTTPException(status_code=400, detail="Añade al menos un alimento a la receta")

    db.query(RecipeItem).filter(RecipeItem.recipe_id == recipe.id).delete(synchronize_session=False)

    total_calorias = 0.0
    total_proteinas = 0.0
    total_carbos = 0.0
    total_grasas = 0.0

    for item in items:
        if item.gramos <= 0:
            raise HTTPException(status_code=400, detail="Los gramos deben ser mayores que 0")

        food = db.query(Food).filter(Food.id == item.food_id).first()

        if not food:
            raise HTTPException(
                status_code=404,
                detail=f"Alimento {item.food_id} no encontrado",
            )

        factor = item.gramos / 100.0

        total_calorias += food.calorias * factor
        total_proteinas += food.proteinas * factor
        total_carbos += food.carbos * factor
        total_grasas += food.grasas * factor

        recipe_item = RecipeItem(
            recipe_id=recipe.id,
            food_id=item.food_id,
            gramos=item.gramos,
        )
        db.add(recipe_item)

    recipe.calorias_totales = round(total_calorias, 2)
    recipe.proteinas = round(total_proteinas, 2)
    recipe.carbos = round(total_carbos, 2)
    recipe.grasas = round(total_grasas, 2)


@router.post("/", response_model=RecipeResponse)
def create_recipe(recipe: RecipeCreate, db: Session = Depends(get_db)):
    new_recipe = Recipe(**recipe.dict())
    db.add(new_recipe)
    db.commit()
    db.refresh(new_recipe)
    return new_recipe


@router.post("/with-items", response_model=RecipeResponse)
def create_recipe_with_items(
    payload: RecipeCreateWithItems,
    db: Session = Depends(get_db),
):
    recipe = Recipe(
        nombre=payload.nombre.strip(),
        ingredientes=(payload.ingredientes or "").strip() or "Receta creada desde alimentos",
        calorias_totales=0.0,
        proteinas=0.0,
        carbos=0.0,
        grasas=0.0,
        tiempo_preparacion=payload.tiempo_preparacion,
        tipo_dieta=payload.tipo_dieta,
        fuente_url=None,
        origen="manual",
        user_id=payload.user_id,
    )

    db.add(recipe)
    db.flush()

    apply_recipe_items(recipe, payload.items, db)

    db.commit()
    db.refresh(recipe)

    return recipe


@router.put("/{recipe_id}/with-items", response_model=RecipeResponse)
def update_recipe_with_items(
    recipe_id: int,
    payload: RecipeCreateWithItems,
    db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()

    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")

    if recipe.origen != "manual":
        raise HTTPException(
            status_code=400,
            detail="Solo puedes editar recetas manuales. Añádela primero a Mis recetas.",
        )

    if recipe.user_id is not None and payload.user_id is not None and recipe.user_id != payload.user_id:
        raise HTTPException(status_code=403, detail="No puedes editar esta receta")

    recipe.nombre = payload.nombre.strip()
    recipe.ingredientes = (payload.ingredientes or "").strip() or "Receta creada desde alimentos"
    recipe.tiempo_preparacion = payload.tiempo_preparacion
    recipe.tipo_dieta = payload.tipo_dieta
    recipe.origen = "manual"
    recipe.user_id = payload.user_id if payload.user_id is not None else recipe.user_id

    apply_recipe_items(recipe, payload.items, db)

    db.commit()
    db.refresh(recipe)

    return recipe


@router.post("/{recipe_id}/clone", response_model=RecipeResponse)
def clone_recipe_to_user(
    recipe_id: int,
    payload: RecipeCloneRequest,
    db: Session = Depends(get_db),
):
    source_recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()

    if not source_recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")

    existing_query = db.query(Recipe).filter(
        Recipe.user_id == payload.user_id,
        Recipe.origen == "manual",
    )

    if source_recipe.fuente_url:
        existing_recipe = existing_query.filter(Recipe.fuente_url == source_recipe.fuente_url).first()
    else:
        existing_recipe = existing_query.filter(Recipe.nombre == source_recipe.nombre).first()

    if existing_recipe:
        return existing_recipe

    new_recipe = Recipe(
        nombre=source_recipe.nombre,
        ingredientes=source_recipe.ingredientes,
        calorias_totales=source_recipe.calorias_totales,
        proteinas=source_recipe.proteinas,
        carbos=source_recipe.carbos,
        grasas=source_recipe.grasas,
        tiempo_preparacion=source_recipe.tiempo_preparacion,
        tipo_dieta=source_recipe.tipo_dieta,
        fuente_url=source_recipe.fuente_url,
        origen="manual",
        user_id=payload.user_id,
    )

    db.add(new_recipe)
    db.flush()

    for source_item in source_recipe.items:
        db.add(
            RecipeItem(
                recipe_id=new_recipe.id,
                food_id=source_item.food_id,
                gramos=source_item.gramos,
            )
        )

    db.commit()
    db.refresh(new_recipe)

    return new_recipe


@router.get("/", response_model=list[RecipeResponse])
def get_recipes(
    nombre: str | None = Query(default=None),
    tipo_dieta: str | None = Query(default=None),
    user_id: int | None = Query(default=None),
    db: Session = Depends(get_db)
):
    query = db.query(Recipe)

    if user_id is not None:
        query = query.filter(or_(Recipe.user_id.is_(None), Recipe.user_id == user_id))
    else:
        query = query.filter(Recipe.user_id.is_(None))

    if nombre:
        query = query.filter(Recipe.nombre.ilike(f"%{nombre}%"))

    if tipo_dieta:
        query = query.filter(Recipe.tipo_dieta.ilike(f"%{tipo_dieta}%"))

    return query.all()


@router.get("/{recipe_id}", response_model=RecipeResponse)
def get_recipe(recipe_id: int, db: Session = Depends(get_db)):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()

    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")

    return recipe


@router.put("/{recipe_id}", response_model=RecipeResponse)
def update_recipe(recipe_id: int, data: RecipeCreate, db: Session = Depends(get_db)):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()

    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")

    for key, value in data.dict().items():
        setattr(recipe, key, value)

    db.commit()
    db.refresh(recipe)
    return recipe


@router.delete("/{recipe_id}")
def delete_recipe(recipe_id: int, db: Session = Depends(get_db)):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()

    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")

    db.delete(recipe)
    db.commit()
    return {"message": "Receta eliminada"}

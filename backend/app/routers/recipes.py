from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Food, Recipe, RecipeItem
from ..schemas import RecipeCreate, RecipeCreateWithItems, RecipeResponse

router = APIRouter(prefix="/recipes", tags=["Recipes"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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
    total_calorias = 0.0
    total_proteinas = 0.0
    total_carbos = 0.0
    total_grasas = 0.0

    recipe = Recipe(
        nombre=payload.nombre,
        ingredientes=payload.ingredientes or "",
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

    for item in payload.items:
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

    db.commit()
    db.refresh(recipe)

    return recipe


@router.get("/", response_model=list[RecipeResponse])
def get_recipes(
    nombre: str | None = Query(default=None),
    tipo_dieta: str | None = Query(default=None),
    db: Session = Depends(get_db)
):
    query = db.query(Recipe)

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
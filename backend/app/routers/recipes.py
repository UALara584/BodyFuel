from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Recipe
from ..schemas import RecipeCreate, RecipeResponse

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
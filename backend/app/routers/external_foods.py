from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..services.edamam_service import search_edamam_foods

router = APIRouter(prefix="/external-foods", tags=["External Foods"])


@router.get("/")
def search_external_foods(q: str = Query(..., min_length=2)):
    try:
        return search_edamam_foods(q)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error consultando Edamam: {exc}")
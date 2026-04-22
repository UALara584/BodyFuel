import { useEffect, useState } from "react";
import { fetchRecipes } from "../services/api";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  async function loadRecipes(nombre = "") {
    setLoading(true);
    setError("");

    try {
      const data = await fetchRecipes(nombre);
      setRecipes(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecipes();
  }, []);

  function openRecipeModal(recipe) {
    setSelectedRecipe(recipe);
  }

  function closeRecipeModal() {
    setSelectedRecipe(null);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Recetas</h2>
        <p>Consulta recetas y revisa su información nutricional.</p>
      </div>

      {loading && <p>Cargando...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && (
        <div className="grid-cards">
          {recipes.length === 0 ? (
            <div className="card">
              <p>No hay recetas para mostrar.</p>
            </div>
          ) : (
            recipes.map((recipe) => (
              <div key={recipe.id} className="card">
                <button
                  type="button"
                  className="food-card-trigger"
                  onClick={() => openRecipeModal(recipe)}
                  aria-label={`Ver detalle de la receta ${recipe.nombre}`}
                >
                  <span className="food-card-name">{recipe.nombre}</span>
                  <span className="food-card-arrow" aria-hidden="true">
                    Ver
                  </span>
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {selectedRecipe && (
        <div className="modal-overlay">
          <button
            type="button"
            className="modal-backdrop"
            onClick={closeRecipeModal}
            aria-label="Cerrar ventana de receta"
          />

          <div className="modal-card">
            <div className="modal-header">
              <h3>{selectedRecipe.nombre}</h3>
              <button
                className="close-button"
                onClick={closeRecipeModal}
                type="button"
                aria-label="Cerrar ventana"
              >
                ×
              </button>
            </div>

            <div className="food-card-details">
              <p>
                <strong>Informacion adicional</strong>
              </p>
              <p>
                <strong>Descripcion:</strong> {selectedRecipe.ingredientes || "No disponible"}
              </p>

              {selectedRecipe.fuente_url && (
                <p>
                  <strong>Enlace a la receta:</strong>{" "}
                  <a href={selectedRecipe.fuente_url} target="_blank" rel="noreferrer">
                    Ver receta original
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
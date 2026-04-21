import { useEffect, useState } from "react";
import { fetchRecipes } from "../services/api";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  function handleSubmit(event) {
    event.preventDefault();
    loadRecipes(search);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Recetas</h2>
        <p>Consulta recetas y revisa su información nutricional.</p>
      </div>

      <form onSubmit={handleSubmit} className="search-form">
        <input
          type="text"
          placeholder="Buscar receta"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit">Buscar</button>
      </form>

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
                <h3>{recipe.nombre}</h3>
                <p><strong>Ingredientes:</strong> {recipe.ingredientes}</p>
                <p><strong>Calorías:</strong> {recipe.calorias_totales}</p>
                <p><strong>Tiempo:</strong> {recipe.tiempo_preparacion} min</p>
                <p><strong>Tipo dieta:</strong> {recipe.tipo_dieta || "No especificado"}</p>
                <p><strong>Origen:</strong> {recipe.origen}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
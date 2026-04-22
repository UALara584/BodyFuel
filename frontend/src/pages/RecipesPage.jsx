import { useEffect, useMemo, useState } from "react";
import { createRecipe, fetchRecipes } from "../services/api";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("manual");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    ingredientes: "",
    calorias_totales: "",
    proteinas: "",
    carbos: "",
    grasas: "",
    tiempo_preparacion: "",
    tipo_dieta: "",
    fuente_url: "",
    origen: "manual",
  });

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

  function handleSearchSubmit(event) {
    event.preventDefault();
    loadRecipes(search);
  }

  function openRecipeModal(recipe) {
    setSelectedRecipe(recipe);
  }

  function closeRecipeModal() {
    setSelectedRecipe(null);
  }

  function openCreateModal() {
    setShowCreateModal(true);
    setError("");
  }

  function closeCreateModal() {
    setShowCreateModal(false);
    setFormData({
      nombre: "",
      ingredientes: "",
      calorias_totales: "",
      proteinas: "",
      carbos: "",
      grasas: "",
      tiempo_preparacion: "",
      tipo_dieta: "",
      fuente_url: "",
      origen: "manual",
    });
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleCreateRecipe(event) {
    event.preventDefault();
    setError("");

    try {
      await createRecipe({
        nombre: formData.nombre,
        ingredientes: formData.ingredientes,
        calorias_totales: Number(formData.calorias_totales),
        proteinas: Number(formData.proteinas),
        carbos: Number(formData.carbos),
        grasas: Number(formData.grasas),
        tiempo_preparacion: Number(formData.tiempo_preparacion),
        tipo_dieta: formData.tipo_dieta || null,
        fuente_url: formData.fuente_url || null,
        origen: "manual",
      });

      await loadRecipes(search);
      closeCreateModal();
      setActiveTab("manual");
    } catch (err) {
      setError(err.message);
    }
  }

  const manualRecipes = useMemo(
    () => recipes.filter((recipe) => (recipe.origen || "").toLowerCase() === "manual"),
    [recipes]
  );

  const scrapingRecipes = useMemo(
    () => recipes.filter((recipe) => (recipe.origen || "").toLowerCase() !== "manual"),
    [recipes]
  );

  const visibleRecipes = activeTab === "manual" ? manualRecipes : scrapingRecipes;

  return (
    <div className="page recipes-page">
      <div className="page-header page-header-row">
        <div>
          <h2>Recetas</h2>
          <p>Consulta recetas scrapeadas o crea tus propias recetas.</p>
        </div>

        <button
          className="add-button"
          onClick={openCreateModal}
          aria-label="Añadir receta"
          type="button"
        >
          +
        </button>
      </div>

      <div className="recipes-tabs">
        <button
          type="button"
          className={`recipes-tab ${activeTab === "manual" ? "active" : ""}`}
          onClick={() => setActiveTab("manual")}
        >
          Mis recetas
        </button>

        <button
          type="button"
          className={`recipes-tab ${activeTab === "scraping" ? "active" : ""}`}
          onClick={() => setActiveTab("scraping")}
        >
          Recetas scraping
        </button>
      </div>

      <form onSubmit={handleSearchSubmit} className="search-form">
        <input
          type="text"
          placeholder={
            activeTab === "manual"
              ? "Buscar en mis recetas"
              : "Buscar en recetas scraping"
          }
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button type="submit">Buscar</button>
      </form>

      {loading && <p>Cargando...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && (
        <div className="grid-cards">
          {visibleRecipes.length === 0 ? (
            <div className="card">
              <p>
                {activeTab === "manual"
                  ? "No tienes recetas creadas todavía."
                  : "No hay recetas scrapeadas para mostrar."}
              </p>
            </div>
          ) : (
            visibleRecipes.map((recipe) => (
              <div key={recipe.id} className="card recipe-title-card">
                <button
                  type="button"
                  className="recipe-title-trigger"
                  onClick={() => openRecipeModal(recipe)}
                  aria-label={`Ver detalle de la receta ${recipe.nombre}`}
                >
                  <span className="recipe-title-text">{recipe.nombre}</span>
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

            <div className="recipe-modal-body">
              <div className="recipe-modal-grid">
                <div className="recipe-modal-stat">
                  <span>Calorías</span>
                  <strong>{selectedRecipe.calorias_totales || 0} kcal</strong>
                </div>

                <div className="recipe-modal-stat">
                  <span>Proteínas</span>
                  <strong>{selectedRecipe.proteinas || 0} g</strong>
                </div>

                <div className="recipe-modal-stat">
                  <span>Carbohidratos</span>
                  <strong>{selectedRecipe.carbos || 0} g</strong>
                </div>

                <div className="recipe-modal-stat">
                  <span>Grasas</span>
                  <strong>{selectedRecipe.grasas || 0} g</strong>
                </div>

                <div className="recipe-modal-stat">
                  <span>Tiempo</span>
                  <strong>{selectedRecipe.tiempo_preparacion || 0} min</strong>
                </div>

                <div className="recipe-modal-stat">
                  <span>Tipo</span>
                  <strong>{selectedRecipe.tipo_dieta || "No especificado"}</strong>
                </div>

                <div className="recipe-modal-stat">
                  <span>Origen</span>
                  <strong>{selectedRecipe.origen || "manual"}</strong>
                </div>
              </div>

              <div className="recipe-description-box">
                <h4>Ingredientes / descripción</h4>
                <p>{selectedRecipe.ingredientes || "No disponible"}</p>
              </div>

              {selectedRecipe.fuente_url ? (
                <a
                  className="recipe-link-button"
                  href={selectedRecipe.fuente_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver receta original
                </a>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay">
          <button
            type="button"
            className="modal-backdrop"
            onClick={closeCreateModal}
            aria-label="Cerrar ventana de crear receta"
          />

          <div className="modal-card">
            <div className="modal-header">
              <h3>Crear receta</h3>
              <button
                className="close-button"
                onClick={closeCreateModal}
                type="button"
                aria-label="Cerrar ventana"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateRecipe} className="modal-form">
              <div className="field-group">
                <label htmlFor="recipe_nombre">Nombre</label>
                <input
                  id="recipe_nombre"
                  type="text"
                  name="nombre"
                  placeholder="Ej. Bowl de pollo"
                  value={formData.nombre}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="field-group">
                <label htmlFor="recipe_tipo_dieta">Tipo de dieta</label>
                <input
                  id="recipe_tipo_dieta"
                  type="text"
                  name="tipo_dieta"
                  placeholder="Ej. alta_proteina"
                  value={formData.tipo_dieta}
                  onChange={handleChange}
                />
              </div>

              <div className="field-group">
                <label htmlFor="recipe_calorias">Calorías totales</label>
                <input
                  id="recipe_calorias"
                  type="number"
                  step="0.1"
                  name="calorias_totales"
                  placeholder="Ej. 540"
                  value={formData.calorias_totales}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="field-group">
                <label htmlFor="recipe_proteinas">Proteínas</label>
                <input
                  id="recipe_proteinas"
                  type="number"
                  step="0.1"
                  name="proteinas"
                  placeholder="Ej. 42"
                  value={formData.proteinas}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="field-group">
                <label htmlFor="recipe_carbos">Carbohidratos</label>
                <input
                  id="recipe_carbos"
                  type="number"
                  step="0.1"
                  name="carbos"
                  placeholder="Ej. 55"
                  value={formData.carbos}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="field-group">
                <label htmlFor="recipe_grasas">Grasas</label>
                <input
                  id="recipe_grasas"
                  type="number"
                  step="0.1"
                  name="grasas"
                  placeholder="Ej. 14"
                  value={formData.grasas}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="field-group">
                <label htmlFor="recipe_tiempo">Tiempo de preparación</label>
                <input
                  id="recipe_tiempo"
                  type="number"
                  name="tiempo_preparacion"
                  placeholder="Ej. 20"
                  value={formData.tiempo_preparacion}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="field-group field-group-full">
                <label htmlFor="recipe_ingredientes">Ingredientes</label>
                <textarea
                  id="recipe_ingredientes"
                  name="ingredientes"
                  placeholder="Ej. pollo, arroz, tomate, aceite..."
                  value={formData.ingredientes}
                  onChange={handleChange}
                  rows={5}
                  required
                />
              </div>

              <div className="field-group field-group-full">
                <label htmlFor="recipe_fuente_url">Enlace original (opcional)</label>
                <input
                  id="recipe_fuente_url"
                  type="url"
                  name="fuente_url"
                  placeholder="https://..."
                  value={formData.fuente_url}
                  onChange={handleChange}
                />
              </div>

              <button type="submit" className="submit-button">
                Guardar receta
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
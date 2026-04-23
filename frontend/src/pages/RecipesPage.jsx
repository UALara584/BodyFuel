
import { useEffect, useMemo, useState } from "react";
import {
  createRecipeWithItems,
  fetchFoods,
  fetchRecipes,
} from "../services/api";

function emptyRecipeItem() {
  return {
    food_id: "",
    gramos: "",
  };
}

export default function RecipesPage() {
  const currentUser = JSON.parse(localStorage.getItem("bf_current_user") || "null");
  const userId = currentUser?.id ?? null;

  const [recipes, setRecipes] = useState([]);
  const [foods, setFoods] = useState([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("manual");
  const [expandedRecipeId, setExpandedRecipeId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [foodsLoading, setFoodsLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [savingRecipe, setSavingRecipe] = useState(false);

  const [formData, setFormData] = useState({
    nombre: "",
    ingredientes: "",
    tiempo_preparacion: "",
    tipo_dieta: "",
  });

  const [recipeItems, setRecipeItems] = useState([emptyRecipeItem()]);

  async function loadRecipesAndFoods() {
    setLoading(true);
    setFoodsLoading(true);
    setError("");

    try {
      const [recipesData, foodsData] = await Promise.all([
        fetchRecipes(),
        fetchFoods("", userId),
      ]);

      setRecipes(recipesData || []);
      setFoods(foodsData || []);
    } catch (err) {
      setError(err.message || "Error al cargar recetas y alimentos");
    } finally {
      setLoading(false);
      setFoodsLoading(false);
    }
  }

  useEffect(() => {
    loadRecipesAndFoods();
  }, [userId]);

  const manualRecipes = useMemo(
    () => recipes.filter((recipe) => (recipe.origen || "").toLowerCase() === "manual"),
    [recipes]
  );

  const scrapingRecipes = useMemo(
    () => recipes.filter((recipe) => (recipe.origen || "").toLowerCase() !== "manual"),
    [recipes]
  );

  const filteredManualRecipes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return manualRecipes;
    return manualRecipes.filter((recipe) =>
      recipe.nombre.toLowerCase().includes(query)
    );
  }, [manualRecipes, search]);

  const filteredScrapingRecipes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return scrapingRecipes;
    return scrapingRecipes.filter((recipe) =>
      recipe.nombre.toLowerCase().includes(query)
    );
  }, [scrapingRecipes, search]);

  const computedTotals = useMemo(() => {
    return recipeItems.reduce(
      (acc, item) => {
        const food = foods.find((entry) => entry.id === Number(item.food_id));
        const gramos = Number(item.gramos || 0);

        if (!food || gramos <= 0) {
          return acc;
        }

        const factor = gramos / 100;

        acc.calorias += food.calorias * factor;
        acc.proteinas += food.proteinas * factor;
        acc.carbos += food.carbos * factor;
        acc.grasas += food.grasas * factor;

        return acc;
      },
      { calorias: 0, proteinas: 0, carbos: 0, grasas: 0 }
    );
  }, [recipeItems, foods]);

  function openModal() {
    setShowModal(true);
    setError("");
    setFormData({
      nombre: "",
      ingredientes: "",
      tiempo_preparacion: "",
      tipo_dieta: "",
    });
    setRecipeItems([emptyRecipeItem()]);
  }

  function closeModal() {
    setShowModal(false);
    setSavingRecipe(false);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleRecipeItemChange(index, field, value) {
    setRecipeItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  }

  function addRecipeItemRow() {
    setRecipeItems((prev) => [...prev, emptyRecipeItem()]);
  }

  function removeRecipeItemRow(index) {
    setRecipeItems((prev) => {
      if (prev.length === 1) {
        return [emptyRecipeItem()];
      }
      return prev.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  async function handleCreateRecipe(event) {
    event.preventDefault();
    setError("");

    const validItems = recipeItems
      .map((item) => ({
        food_id: Number(item.food_id),
        gramos: Number(item.gramos),
      }))
      .filter((item) => item.food_id > 0 && item.gramos > 0);

    if (!formData.nombre.trim()) {
      setError("Escribe un nombre para la receta.");
      return;
    }

    if (validItems.length === 0) {
      setError("Añade al menos un alimento con gramos válidos.");
      return;
    }

    try {
      setSavingRecipe(true);

      await createRecipeWithItems({
        nombre: formData.nombre.trim(),
        ingredientes: formData.ingredientes.trim() || "Receta creada desde alimentos",
        tiempo_preparacion: Number(formData.tiempo_preparacion || 0),
        tipo_dieta: formData.tipo_dieta.trim() || null,
        user_id: userId,
        items: validItems,
      });

      await loadRecipesAndFoods();
      closeModal();
      setActiveTab("manual");
    } catch (err) {
      setError(err.message || "Error al crear receta");
    } finally {
      setSavingRecipe(false);
    }
  }

  function toggleRecipe(recipeId) {
    setExpandedRecipeId((prev) => (prev === recipeId ? null : recipeId));
  }

  function renderRecipeCards(list, emptyText) {
    if (list.length === 0) {
      return (
        <div className="card">
          <p>{emptyText}</p>
        </div>
      );
    }

    return (
      <div className="grid-cards">
        {list.map((recipe) => {
          const isOpen = expandedRecipeId === recipe.id;

          return (
            <div key={recipe.id} className="card recipe-title-card">
              <button
                type="button"
                className="recipe-title-trigger"
                onClick={() => toggleRecipe(recipe.id)}
              >
                <span className="recipe-title-text">{recipe.nombre}</span>
                <span className="food-card-arrow">{isOpen ? "Ocultar" : "Ver"}</span>
              </button>

              {isOpen && (
                <div className="food-card-details">
                  <p><strong>Calorías:</strong> {recipe.calorias_totales}</p>
                  <p><strong>Proteínas:</strong> {recipe.proteinas} g</p>
                  <p><strong>Carbos:</strong> {recipe.carbos} g</p>
                  <p><strong>Grasas:</strong> {recipe.grasas} g</p>
                  <p><strong>Tiempo:</strong> {recipe.tiempo_preparacion} min</p>
                  {recipe.tipo_dieta ? (
                    <p><strong>Tipo:</strong> {recipe.tipo_dieta}</p>
                  ) : null}
                  {recipe.ingredientes ? (
                    <p><strong>Descripción:</strong> {recipe.ingredientes}</p>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header page-header-row">
        <div>
          <h2>Recetas</h2>
          <p>Crea tus recetas con alimentos reales y macros calculados automáticamente.</p>
        </div>

        <button className="add-button" type="button" onClick={openModal}>
          +
        </button>
      </div>

      <form
        className="search-form"
        onSubmit={(event) => event.preventDefault()}
      >
        <input
          type="text"
          placeholder="Buscar receta"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button type="button">Buscar</button>
      </form>

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

      {loading || foodsLoading ? <p>Cargando recetas...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {!loading && !foodsLoading && !error && activeTab === "manual" && (
        <section className="recipe-section">
          {renderRecipeCards(
            filteredManualRecipes,
            "No tienes recetas manuales todavía."
          )}
        </section>
      )}

      {!loading && !foodsLoading && !error && activeTab === "scraping" && (
        <section className="recipe-section">
          {renderRecipeCards(
            filteredScrapingRecipes,
            "No hay recetas scrapeadas disponibles."
          )}
        </section>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal-card profile-modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Crear receta</h3>
              <button className="close-button" type="button" onClick={closeModal}>
                ×
              </button>
            </div>

            <form onSubmit={handleCreateRecipe} className="modal-form recipe-builder-form">
              <div className="field-group">
                <label htmlFor="recipe_nombre">Título</label>
                <input
                  id="recipe_nombre"
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleFormChange}
                  placeholder="Ej. Porridge proteico"
                  required
                />
              </div>

              <div className="field-group">
                <label htmlFor="recipe_tiempo">Tiempo de preparación</label>
                <input
                  id="recipe_tiempo"
                  type="number"
                  name="tiempo_preparacion"
                  value={formData.tiempo_preparacion}
                  onChange={handleFormChange}
                  placeholder="Ej. 10"
                  min="0"
                />
              </div>

              <div className="field-group field-group-full">
                <label htmlFor="recipe_tipo_dieta">Tipo de dieta</label>
                <input
                  id="recipe_tipo_dieta"
                  type="text"
                  name="tipo_dieta"
                  value={formData.tipo_dieta}
                  onChange={handleFormChange}
                  placeholder="Ej. alta en proteína"
                />
              </div>

              <div className="field-group field-group-full">
                <label htmlFor="recipe_descripcion">Descripción</label>
                <textarea
                  id="recipe_descripcion"
                  name="ingredientes"
                  value={formData.ingredientes}
                  onChange={handleFormChange}
                  rows="3"
                  placeholder="Describe la receta o añade notas opcionales"
                />
              </div>

              <div className="field-group field-group-full">
                <label>Alimentos de la receta</label>

                <div className="recipe-builder-list">
                  {recipeItems.map((item, index) => (
                    <div key={index} className="recipe-builder-row">
                      <select
                        value={item.food_id}
                        onChange={(event) =>
                          handleRecipeItemChange(index, "food_id", event.target.value)
                        }
                      >
                        <option value="">Selecciona un alimento</option>
                        {foods.map((food) => (
                          <option key={food.id} value={food.id}>
                            {food.nombre}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        step="0.1"
                        placeholder="Gramos"
                        value={item.gramos}
                        onChange={(event) =>
                          handleRecipeItemChange(index, "gramos", event.target.value)
                        }
                      />

                      <button
                        type="button"
                        className="recipe-remove-button"
                        onClick={() => removeRecipeItemRow(index)}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="secondary-action-button"
                  onClick={addRecipeItemRow}
                >
                  Añadir alimento
                </button>
              </div>

              <div className="field-group field-group-full">
                <label>Macros calculados automáticamente</label>
                <div className="recipe-totals-box">
                  <div>
                    <span>Calorías</span>
                    <strong>{computedTotals.calorias.toFixed(1)}</strong>
                  </div>
                  <div>
                    <span>Proteínas</span>
                    <strong>{computedTotals.proteinas.toFixed(1)} g</strong>
                  </div>
                  <div>
                    <span>Carbos</span>
                    <strong>{computedTotals.carbos.toFixed(1)} g</strong>
                  </div>
                  <div>
                    <span>Grasas</span>
                    <strong>{computedTotals.grasas.toFixed(1)} g</strong>
                  </div>
                </div>
              </div>

              <button type="submit" className="submit-button" disabled={savingRecipe}>
                {savingRecipe ? "Guardando receta..." : "Guardar receta"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
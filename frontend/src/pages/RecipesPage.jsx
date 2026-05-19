
import { useEffect, useMemo, useState } from "react";
import {
  cloneRecipeToMyRecipes,
  createRecipeWithItems,
  deleteRecipe,
  fetchFoods,
  fetchRecipes,
  updateRecipeWithItems,
} from "../services/api";
import { fetchChatConversations, sendChatMessage } from "../services/chatApi";

function emptyRecipeItem() {
  return {
    food_id: "",
    gramos: "",
  };
}

function recipeItemsFromRecipe(recipe) {
  if (!Array.isArray(recipe?.items) || recipe.items.length === 0) {
    return [emptyRecipeItem()];
  }

  return recipe.items.map((item) => ({
    food_id: item.food_id ? String(item.food_id) : "",
    gramos: item.gramos ? String(item.gramos) : "",
  }));
}

export default function RecipesPage() {
  const currentUser = JSON.parse(localStorage.getItem("bf_current_user") || "null");
  const userId = currentUser?.id ?? null;

  const [recipes, setRecipes] = useState([]);
  const [foods, setFoods] = useState([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("manual");

  const [loading, setLoading] = useState(true);
  const [foodsLoading, setFoodsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [showRecipeDetail, setShowRecipeDetail] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState(null);
  const [deletingRecipe, setDeletingRecipe] = useState(false);
  const [cloningRecipeId, setCloningRecipeId] = useState(null);
  const [shareRecipe, setShareRecipe] = useState(null);
  const [shareConversations, setShareConversations] = useState([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState("");
  const [sharingConversationId, setSharingConversationId] = useState(null);

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
        fetchRecipes("", "", userId),
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

  function openCreateModal() {
    setShowModal(true);
    setEditingRecipe(null);
    setError("");
    setSuccess("");
    setFormData({
      nombre: "",
      ingredientes: "",
      tiempo_preparacion: "",
      tipo_dieta: "",
    });
    setRecipeItems([emptyRecipeItem()]);
  }

  function openEditModal(recipe) {
    setShowModal(true);
    setEditingRecipe(recipe);
    setError("");
    setSuccess("");
    setFormData({
      nombre: recipe.nombre || "",
      ingredientes: recipe.ingredientes || "",
      tiempo_preparacion: recipe.tiempo_preparacion ? String(recipe.tiempo_preparacion) : "",
      tipo_dieta: recipe.tipo_dieta || "",
    });
    setRecipeItems(recipeItemsFromRecipe(recipe));
  }

  function closeModal() {
    setShowModal(false);
    setSavingRecipe(false);
    setEditingRecipe(null);
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

  async function handleSaveRecipe(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

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
      const payload = {
        nombre: formData.nombre.trim(),
        ingredientes: formData.ingredientes.trim() || "Receta creada desde alimentos",
        tiempo_preparacion: Number(formData.tiempo_preparacion || 0),
        tipo_dieta: formData.tipo_dieta.trim() || null,
        user_id: userId,
        items: validItems,
      };
      const wasEditing = Boolean(editingRecipe);

      if (editingRecipe) {
        await updateRecipeWithItems(editingRecipe.id, payload);
      } else {
        await createRecipeWithItems(payload);
      }

      await loadRecipesAndFoods();
      closeModal();
      setActiveTab("manual");
      setSuccess(wasEditing ? "Receta actualizada correctamente." : "Receta creada correctamente.");
    } catch (err) {
      setError(err.message || "Error al guardar receta");
    } finally {
      setSavingRecipe(false);
    }
  }

  async function handleCloneRecipe(recipe) {
    if (!recipe || !userId) {
      setError("No hay usuario activo para guardar la receta.");
      return;
    }

    try {
      setCloningRecipeId(recipe.id);
      setError("");
      setSuccess("");
      const clonedRecipe = await cloneRecipeToMyRecipes(recipe.id, userId);
      await loadRecipesAndFoods();
      closeRecipeDetail();
      setActiveTab("manual");
      setSuccess(`"${clonedRecipe.nombre}" añadida a Mis recetas.`);
    } catch (err) {
      setError(err.message || "Error al añadir receta a Mis recetas");
    } finally {
      setCloningRecipeId(null);
    }
  }

  function closeRecipeDetail() {
    setShowRecipeDetail(false);
    setSelectedRecipe(null);
  }

  function openRecipeDetail(recipe) {
    setSelectedRecipe(recipe);
    setShowRecipeDetail(true);
  }

  function openDeleteConfirm(recipe) {
    setRecipeToDelete(recipe);
    setShowDeleteConfirm(true);
  }

  async function openShareRecipeModal(recipe) {
    setShareRecipe(recipe);
    setShareError("");
    setShareConversations([]);

    try {
      setShareLoading(true);
      const conversations = await fetchChatConversations(userId);
      setShareConversations(conversations || []);
    } catch (err) {
      setShareError(err.message || "No se pudieron cargar tus chats.");
    } finally {
      setShareLoading(false);
    }
  }

  function closeShareRecipeModal() {
    setShareRecipe(null);
    setShareConversations([]);
    setShareError("");
    setSharingConversationId(null);
  }

  async function handleShareRecipe(conversation) {
    if (!shareRecipe) return;

    try {
      setShareError("");
      setSharingConversationId(conversation.id);
      await sendChatMessage(conversation.id, {
        user_id: userId,
        message_type: "recipe_share",
        recipe_id: shareRecipe.id,
      });
      setSuccess(`"${shareRecipe.nombre}" compartida con ${conversation.other_user.nombre}.`);
      closeShareRecipeModal();
    } catch (err) {
      setShareError(err.message || "No se pudo compartir la receta.");
    } finally {
      setSharingConversationId(null);
    }
  }

  function closeDeleteConfirm() {
    setShowDeleteConfirm(false);
    setRecipeToDelete(null);
  }

  async function handleDeleteRecipe() {
    if (!recipeToDelete) return;

    try {
      setDeletingRecipe(true);
      await deleteRecipe(recipeToDelete.id);
      await loadRecipesAndFoods();
      closeDeleteConfirm();
    } catch (err) {
      setError(err.message || "Error al eliminar receta");
    } finally {
      setDeletingRecipe(false);
    }
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
          return (
            <div key={recipe.id} className="card recipe-title-card">
              <button
                type="button"
                className="recipe-title-trigger"
                onClick={() => openRecipeDetail(recipe)}
              >
                <span className="recipe-title-text">{recipe.nombre}</span>
                <span className="food-card-arrow">Ver</span>
              </button>
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

        <button className="add-button" type="button" onClick={openCreateModal} aria-label="Crear receta">
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
      {success ? <p className="success-text">{success}</p> : null}

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
              <h3>{editingRecipe ? "Editar receta" : "Crear receta"}</h3>
              <button className="close-button" type="button" onClick={closeModal} aria-label="Cerrar modal">
                ×
              </button>
            </div>

            <form onSubmit={handleSaveRecipe} className="modal-form recipe-builder-form">
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
                {savingRecipe
                  ? "Guardando receta..."
                  : editingRecipe
                    ? "Actualizar receta"
                    : "Guardar receta"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showRecipeDetail && selectedRecipe && (
        <div className="modal-overlay" onClick={closeRecipeDetail}>
          <div
            className="modal-card recipe-detail-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{selectedRecipe.nombre}</h3>
              <button
                className="close-button"
                type="button"
                onClick={closeRecipeDetail}
                aria-label="Cerrar detalle de receta"
              >
                ×
              </button>
            </div>

            <div className="recipe-detail-content">
              <div className="recipe-detail-macros">
                <div className="macro-item">
                  <strong>Calorías:</strong>
                  <span>{Number(selectedRecipe.calorias_totales).toFixed(1)} kcal</span>
                </div>
                <div className="macro-item">
                  <strong>Proteínas:</strong>
                  <span>{Number(selectedRecipe.proteinas).toFixed(1)} g</span>
                </div>
                <div className="macro-item">
                  <strong>Carbos:</strong>
                  <span>{Number(selectedRecipe.carbos).toFixed(1)} g</span>
                </div>
                <div className="macro-item">
                  <strong>Grasas:</strong>
                  <span>{Number(selectedRecipe.grasas).toFixed(1)} g</span>
                </div>
              </div>

              {selectedRecipe.tiempo_preparacion ? (
                <p>
                  <strong>Tiempo de preparación:</strong> {selectedRecipe.tiempo_preparacion} minutos
                </p>
              ) : null}

              {selectedRecipe.tipo_dieta ? (
                <p>
                  <strong>Tipo de dieta:</strong> {selectedRecipe.tipo_dieta}
                </p>
              ) : null}

              {selectedRecipe.ingredientes ? (
                <div className="recipe-ingredients">
                  <strong>Descripción/Ingredientes:</strong>
                  <p>{selectedRecipe.ingredientes}</p>
                </div>
              ) : null}

              {selectedRecipe.fuente_url ? (
                <div className="recipe-source-link">
                  <a
                    href={selectedRecipe.fuente_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="source-link-button"
                  >
                    Ver receta completa en la fuente original
                  </a>
                </div>
              ) : null}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="secondary-action-button"
                onClick={closeRecipeDetail}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="secondary-action-button"
                onClick={() => openShareRecipeModal(selectedRecipe)}
              >
                Compartir receta
              </button>
              {selectedRecipe && selectedRecipe.origen === "manual" && (
                <>
                  <button
                    type="button"
                    className="profile-edit-button"
                    onClick={() => {
                      const recipeForEdit = selectedRecipe;
                      closeRecipeDetail();
                      openEditModal(recipeForEdit);
                    }}
                  >
                    Editar receta
                  </button>
                  <button
                    type="button"
                    className="delete-button"
                    onClick={() => {
                      closeRecipeDetail();
                      openDeleteConfirm(selectedRecipe);
                    }}
                  >
                    Eliminar receta
                  </button>
                </>
              )}
              {selectedRecipe && selectedRecipe.origen !== "manual" && (
                <button
                  type="button"
                  className="profile-edit-button"
                  onClick={() => handleCloneRecipe(selectedRecipe)}
                  disabled={cloningRecipeId === selectedRecipe.id}
                >
                  {cloningRecipeId === selectedRecipe.id ? "Añadiendo..." : "Añadir a Mis recetas"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {shareRecipe && (
        <div className="modal-overlay" onClick={closeShareRecipeModal}>
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Compartir receta</h3>
              <button
                className="close-button"
                type="button"
                onClick={closeShareRecipeModal}
                aria-label="Cerrar selector de chats"
              >
                x
              </button>
            </div>

            {shareLoading ? <p>Cargando chats...</p> : null}
            {shareError ? <p className="error-text">{shareError}</p> : null}

            <div className="chat-picker-list">
              {!shareLoading && shareConversations.length === 0 ? (
                <p className="item-note">No tienes conversaciones. Crea una desde Chats.</p>
              ) : null}

              {shareConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className="chat-picker-item"
                  onClick={() => handleShareRecipe(conversation)}
                  disabled={sharingConversationId === conversation.id}
                >
                  <span className="chat-avatar">
                    {(conversation.other_user.nombre || "U").slice(0, 2).toUpperCase()}
                  </span>
                  <span>
                    <strong>{conversation.other_user.nombre}</strong>
                    <small>
                      {sharingConversationId === conversation.id
                        ? "Compartiendo..."
                        : shareRecipe.nombre}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && recipeToDelete && (
        <div className="modal-overlay" onClick={closeDeleteConfirm}>
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Eliminar receta</h3>
              <button
                className="close-button"
                type="button"
                onClick={closeDeleteConfirm}
                disabled={deletingRecipe}
                aria-label="Cerrar confirmación"
              >
                ×
              </button>
            </div>

            <div className="modal-content">
              <p>¿Estás seguro de que quieres eliminar la receta "<strong>{recipeToDelete.nombre}</strong>"? Esta acción no se puede deshacer.</p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="secondary-action-button"
                onClick={closeDeleteConfirm}
                disabled={deletingRecipe}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="delete-button"
                onClick={handleDeleteRecipe}
                disabled={deletingRecipe}
              >
                {deletingRecipe ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

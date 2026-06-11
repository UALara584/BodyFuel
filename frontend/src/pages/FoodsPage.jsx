import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createFood,
  fetchExternalFoods,
  fetchFoods,
  importFoodFromApi,
} from "../services/api";

const FOOD_FAVORITES_STORAGE_PREFIX = "bf_food_favorites";

function getFavoritesStorageKey(userId) {
  return `${FOOD_FAVORITES_STORAGE_PREFIX}_${userId ?? "guest"}`;
}

function readFavoriteFoods(storageKey) {
  try {
    const storedFavorites = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(storedFavorites) ? storedFavorites : [];
  } catch {
    return [];
  }
}

function normalizeFoodName(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

function getFoodFavoriteKey(food, sourceType) {
  if (food.favoriteKey) {
    return food.favoriteKey;
  }

  if (sourceType === "local" && food.id !== undefined && food.id !== null) {
    return `local:${food.id}`;
  }

  if (sourceType === "api" && food.food_id) {
    return `api:${food.food_id}`;
  }

  return `${sourceType}:${normalizeFoodName(food.nombre)}`;
}

function normalizeFavoriteFood(food, sourceType) {
  return {
    favoriteKey: getFoodFavoriteKey(food, sourceType),
    sourceType,
    id: food.id ?? null,
    food_id: food.food_id ?? null,
    nombre: food.nombre || "Alimento sin nombre",
    calorias: Number(food.calorias || 0),
    proteinas: Number(food.proteinas || 0),
    carbos: Number(food.carbos || 0),
    grasas: Number(food.grasas || 0),
    category: food.category || "",
    fuente: food.fuente || (sourceType === "api" ? "api" : "manual"),
  };
}

function FavoriteIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m12 3.8 2.5 5.1 5.6.8-4 3.9.9 5.5-5-2.6-5 2.6.9-5.5-4-3.9 5.6-.8z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default function FoodsPage() {
  const currentUser = JSON.parse(localStorage.getItem("bf_current_user") || "null");
  const userId = currentUser?.id ?? null;
  const favoritesStorageKey = getFavoritesStorageKey(userId);

  const [foods, setFoods] = useState([]);
  const [externalFoods, setExternalFoods] = useState([]);
  const [favoriteFoods, setFavoriteFoods] = useState(() =>
    readFavoriteFoods(favoritesStorageKey)
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [externalLoading, setExternalLoading] = useState(false);
  const [error, setError] = useState("");
  const [externalError, setExternalError] = useState("");
  const [activeTab, setActiveTab] = useState("local");
  const [savingFoodName, setSavingFoodName] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    calorias: "",
    proteinas: "",
    carbos: "",
    grasas: "",
    fuente: "manual",
  });

  const loadFoodsAndApi = useCallback(async (nombre = "") => {
    setLoading(true);
    setExternalLoading(true);
    setError("");
    setExternalError("");

    try {
      const [localData, externalData] = await Promise.allSettled([
        fetchFoods(nombre, userId),
        nombre.trim() ? fetchExternalFoods(nombre) : Promise.resolve([]),
      ]);

      if (localData.status === "fulfilled") {
        setFoods(localData.value || []);
      } else {
        setFoods([]);
        setError(localData.reason?.message || "Error al cargar alimentos de BodyFuel");
      }

      if (externalData.status === "fulfilled") {
        setExternalFoods(externalData.value || []);
      } else {
        setExternalFoods([]);
        setExternalError(
          externalData.reason?.message ||
            "Error al buscar alimentos en el catálogo nutricional"
        );
      }
    } finally {
      setLoading(false);
      setExternalLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      loadFoodsAndApi();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [loadFoodsAndApi]);

  const favoriteKeys = useMemo(
    () => new Set(favoriteFoods.map((food) => food.favoriteKey)),
    [favoriteFoods]
  );

  const filteredFavoriteFoods = useMemo(() => {
    const query = normalizeFoodName(search);

    if (!query) {
      return favoriteFoods;
    }

    return favoriteFoods.filter((food) =>
      normalizeFoodName(food.nombre).includes(query)
    );
  }, [favoriteFoods, search]);

  function handleSearchSubmit(event) {
    event.preventDefault();
    loadFoodsAndApi(search);
  }

  function updateFavoriteFoods(updater) {
    setFavoriteFoods((prevFavorites) => {
      const nextFavorites = updater(prevFavorites);
      localStorage.setItem(favoritesStorageKey, JSON.stringify(nextFavorites));
      return nextFavorites;
    });
  }

  function isFavoriteFood(food, sourceType) {
    return favoriteKeys.has(getFoodFavoriteKey(food, sourceType));
  }

  function handleToggleFavorite(food, sourceType) {
    const favoriteKey = getFoodFavoriteKey(food, sourceType);

    updateFavoriteFoods((prevFavorites) => {
      const alreadyFavorite = prevFavorites.some(
        (favorite) => favorite.favoriteKey === favoriteKey
      );

      if (alreadyFavorite) {
        return prevFavorites.filter(
          (favorite) => favorite.favoriteKey !== favoriteKey
        );
      }

      return [normalizeFavoriteFood(food, sourceType), ...prevFavorites];
    });
  }

  function renderFavoriteButton(food, sourceType) {
    const favorite = isFavoriteFood(food, sourceType);
    const label = favorite
      ? `Quitar ${food.nombre} de favoritos`
      : `A\u00f1adir ${food.nombre} a favoritos`;

    return (
      <button
        type="button"
        className={`favorite-food-button ${favorite ? "favorite-food-button-active" : ""}`}
        onClick={() => handleToggleFavorite(food, sourceType)}
        aria-label={label}
        title={label}
      >
        <FavoriteIcon filled={favorite} />
      </button>
    );
  }

  function renderFoodMacros(food) {
    return (
      <>
        <p><strong>{"Calor\u00edas:"}</strong> {Number(food.calorias || 0).toFixed(1)}</p>
        <p><strong>{"Prote\u00ednas:"}</strong> {Number(food.proteinas || 0).toFixed(1)} g</p>
        <p><strong>Carbos:</strong> {Number(food.carbos || 0).toFixed(1)} g</p>
        <p><strong>Grasas:</strong> {Number(food.grasas || 0).toFixed(1)} g</p>
      </>
    );
  }

  async function handleImportFood(food) {
    setSavingFoodName(food.nombre);
    setExternalError("");

    try {
      await importFoodFromApi({
        nombre: food.nombre,
        calorias: Number(food.calorias || 0),
        proteinas: Number(food.proteinas || 0),
        carbos: Number(food.carbos || 0),
        grasas: Number(food.grasas || 0),
        fuente: "api",
        user_id: userId,
      });

      await loadFoodsAndApi(search);
      setActiveTab("local");
    } catch (err) {
      setExternalError(err.message);
    } finally {
      setSavingFoodName("");
    }
  }

  function openModal() {
    setShowModal(true);
    setError("");
  }

  function closeModal() {
    setShowModal(false);
    setFormData({
      nombre: "",
      calorias: "",
      proteinas: "",
      carbos: "",
      grasas: "",
      fuente: "manual",
    });
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleCreateFood(event) {
    event.preventDefault();
    setError("");

    try {
      await createFood({
        nombre: formData.nombre,
        calorias: Number(formData.calorias),
        proteinas: Number(formData.proteinas),
        carbos: Number(formData.carbos),
        grasas: Number(formData.grasas),
        fuente: formData.fuente,
        user_id: userId,
      });

      await loadFoodsAndApi(search);
      closeModal();
      setActiveTab("local");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header page-header-row">
        <div>
          <h2>Alimentos</h2>
          <p>Busca en BodyFuel y en nuestro catálogo nutricional desde un único buscador.</p>
        </div>

        <button className="add-button" onClick={openModal} type="button" aria-label="Crear alimento">
          +
        </button>
      </div>

      <form onSubmit={handleSearchSubmit} className="search-form">
        <input
          type="text"
          placeholder="Buscar alimento"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit">Buscar</button>
      </form>

      <div className="foods-tabs">
        <button
          type="button"
          className={`foods-tab ${activeTab === "local" ? "active" : ""}`}
          onClick={() => setActiveTab("local")}
        >
          BodyFuel
          <span className="foods-tab-count">{foods.length}</span>
        </button>

        <button
          type="button"
          className={`foods-tab ${activeTab === "api" ? "active" : ""}`}
          onClick={() => setActiveTab("api")}
        >
          Catálogo nutricional
          <span className="foods-tab-count">{externalFoods.length}</span>
        </button>

        <button
          type="button"
          className={`foods-tab ${activeTab === "favorites" ? "active" : ""}`}
          onClick={() => setActiveTab("favorites")}
        >
          Mis favoritos
          <span className="foods-tab-count">{favoriteFoods.length}</span>
        </button>
      </div>

      {activeTab === "local" && (
        <section className="foods-results-section">
          {loading && <p>Cargando alimentos de BodyFuel...</p>}
          {error && <p className="error-text">{error}</p>}

          {!loading && !error && (
            <div className="grid-cards">
              {foods.length === 0 ? (
                <div className="card">
                  <p>No hay alimentos en BodyFuel con esa búsqueda.</p>
                </div>
              ) : (
                foods.map((food) => (
                  <div key={food.id} className="card food-card">
                    <div className="food-card-header">
                      <h3>{food.nombre}</h3>
                      {renderFavoriteButton(food, "local")}
                    </div>
                    {renderFoodMacros(food)}
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      )}

      {activeTab === "api" && (
        <section className="foods-results-section">
          {externalLoading && <p>Cargando el catálogo nutricional...</p>}
          {externalError && <p className="error-text">{externalError}</p>}

          {!externalLoading && !externalError && (
            <div className="grid-cards">
              {externalFoods.length === 0 ? (
                <div className="card">
                  <p>No hay resultados en el catálogo nutricional para esa búsqueda.</p>
                </div>
              ) : (
                externalFoods.map((food, index) => (
                  <div
                    key={`${food.food_id || food.nombre}-${index}`}
                    className="card external-food-card"
                  >
                    <div className="external-food-top">
                      <div>
                        <h3>{food.nombre}</h3>
                        <p className="item-note">
                          {food.category || "Sin categoría"}
                        </p>
                      </div>
                      <div className="external-food-actions">
                        <span className="api-badge">Catálogo</span>
                        {renderFavoriteButton(food, "api")}
                      </div>
                    </div>

                    {renderFoodMacros(food)}

                    <button
                      type="button"
                      className="save-api-food-button"
                      onClick={() => handleImportFood(food)}
                      disabled={savingFoodName === food.nombre}
                    >
                      {savingFoodName === food.nombre
                        ? "Guardando..."
                        : "Guardar en BodyFuel"}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      )}

      {activeTab === "favorites" && (
        <section className="foods-results-section">
          <div className="grid-cards">
            {favoriteFoods.length === 0 ? (
              <div className="card">
                <p>{"Todav\u00eda no tienes alimentos favoritos."}</p>
              </div>
            ) : filteredFavoriteFoods.length === 0 ? (
              <div className="card">
                <p>{"No hay favoritos con esa b\u00fasqueda."}</p>
              </div>
            ) : (
              filteredFavoriteFoods.map((food) => {
                const sourceType = food.sourceType || "local";

                return (
                  <div key={food.favoriteKey} className="card food-card">
                    <div className="food-card-header">
                      <div>
                        <h3>{food.nombre}</h3>
                        {food.category ? (
                          <p className="item-note">{food.category}</p>
                        ) : null}
                      </div>
                      <div className="favorite-card-actions">
                        <span className={sourceType === "api" ? "api-badge" : "bodyfuel-badge"}>
                          {sourceType === "api" ? "Catálogo" : "BodyFuel"}
                        </span>
                        {renderFavoriteButton(food, sourceType)}
                      </div>
                    </div>
                    {renderFoodMacros(food)}
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Crear alimento</h3>
              <button className="close-button" onClick={closeModal} type="button" aria-label="Cerrar modal">
                ×
              </button>
            </div>

            <form onSubmit={handleCreateFood} className="modal-form">
              <div className="field-group">
                <label htmlFor="food_nombre">Nombre</label>
                <input
                  id="food_nombre"
                  type="text"
                  name="nombre"
                  placeholder="Ej. Avena"
                  value={formData.nombre}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="field-group">
                <label htmlFor="food_calorias">Calorías</label>
                <input
                  id="food_calorias"
                  type="number"
                  step="0.1"
                  name="calorias"
                  placeholder="Ej. 389"
                  value={formData.calorias}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="field-group">
                <label htmlFor="food_proteinas">Proteínas</label>
                <input
                  id="food_proteinas"
                  type="number"
                  step="0.1"
                  name="proteinas"
                  placeholder="Ej. 16.9"
                  value={formData.proteinas}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="field-group">
                <label htmlFor="food_carbos">Carbohidratos</label>
                <input
                  id="food_carbos"
                  type="number"
                  step="0.1"
                  name="carbos"
                  placeholder="Ej. 66.3"
                  value={formData.carbos}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="field-group">
                <label htmlFor="food_grasas">Grasas</label>
                <input
                  id="food_grasas"
                  type="number"
                  step="0.1"
                  name="grasas"
                  placeholder="Ej. 6.9"
                  value={formData.grasas}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="field-group">
                <label htmlFor="food_fuente">Fuente</label>
                <select
                  id="food_fuente"
                  name="fuente"
                  value={formData.fuente}
                  onChange={handleChange}
                >
                  <option value="manual">manual</option>
                  <option value="api">api</option>
                  <option value="scraping">scraping</option>
                </select>
              </div>

              <button type="submit" className="submit-button">
                Guardar alimento
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

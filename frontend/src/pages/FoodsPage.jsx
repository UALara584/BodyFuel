import { useEffect, useState } from "react";
import {
  createFood,
  fetchExternalFoods,
  fetchFoods,
  importFoodFromApi,
} from "../services/api";

export default function FoodsPage() {
  const currentUser = JSON.parse(localStorage.getItem("bf_current_user") || "null");
  const userId = currentUser?.id ?? null;

  const [foods, setFoods] = useState([]);
  const [externalFoods, setExternalFoods] = useState([]);
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

  async function loadFoodsAndApi(nombre = "") {
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
          externalData.reason?.message || "Error al buscar alimentos en API externa"
        );
      }
    } finally {
      setLoading(false);
      setExternalLoading(false);
    }
  }

  useEffect(() => {
    loadFoodsAndApi();
  }, [userId]);

  function handleSearchSubmit(event) {
    event.preventDefault();
    loadFoodsAndApi(search);
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
          <p>Busca en BodyFuel y en la API externa desde un único buscador.</p>
        </div>

        <button className="add-button" onClick={openModal} type="button">
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
          API externa
          <span className="foods-tab-count">{externalFoods.length}</span>
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
                  <div key={food.id} className="card">
                    <h3>{food.nombre}</h3>
                    <p><strong>Calorías:</strong> {food.calorias}</p>
                    <p><strong>Proteínas:</strong> {food.proteinas} g</p>
                    <p><strong>Carbos:</strong> {food.carbos} g</p>
                    <p><strong>Grasas:</strong> {food.grasas} g</p>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      )}

      {activeTab === "api" && (
        <section className="foods-results-section">
          {externalLoading && <p>Cargando alimentos de la API...</p>}
          {externalError && <p className="error-text">{externalError}</p>}

          {!externalLoading && !externalError && (
            <div className="grid-cards">
              {externalFoods.length === 0 ? (
                <div className="card">
                  <p>No hay resultados en la API externa para esa búsqueda.</p>
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
                      <span className="api-badge">API</span>
                    </div>

                    <p><strong>Calorías:</strong> {Number(food.calorias || 0).toFixed(1)}</p>
                    <p><strong>Proteínas:</strong> {Number(food.proteinas || 0).toFixed(1)} g</p>
                    <p><strong>Carbos:</strong> {Number(food.carbos || 0).toFixed(1)} g</p>
                    <p><strong>Grasas:</strong> {Number(food.grasas || 0).toFixed(1)} g</p>

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

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Crear alimento</h3>
              <button className="close-button" onClick={closeModal} type="button">
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
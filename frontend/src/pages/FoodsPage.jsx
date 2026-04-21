import { useEffect, useState } from "react";
import { createFood, deleteFood, fetchFoods } from "../services/api";

export default function FoodsPage() {
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedFoodId, setExpandedFoodId] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    calorias: "",
    proteinas: "",
    carbos: "",
    grasas: "",
    fuente: "manual",
  });

  async function loadFoods(nombre = "") {
    setLoading(true);
    setError("");

    try {
      const data = await fetchFoods(nombre);
      setFoods(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFoods();
  }, []);

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
      });

      await loadFoods();
      closeModal();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteFood(foodId, foodName) {
    const confirmed = globalThis.confirm(`¿Seguro que quieres eliminar "${foodName}"?`);

    if (!confirmed) {
      return;
    }

    setError("");

    try {
      await deleteFood(foodId);
      await loadFoods();
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleFoodDetails(foodId) {
    setExpandedFoodId((prev) => (prev === foodId ? null : foodId));
  }

  return (
    <div className="page">
      <div className="page-header page-header-row">
        <div>
          <h2>Alimentos</h2>
          <p>Busca alimentos y revisa sus macros.</p>
        </div>

        <button
          className="add-button"
          onClick={openModal}
          aria-label="Añadir alimento"
          type="button"
        >
          +
        </button>
      </div>

      {loading && <p>Cargando...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && (
        <div className="grid-cards">
          {foods.length === 0 ? (
            <div className="card">
              <p>No hay alimentos para mostrar.</p>
            </div>
          ) : (
            foods.map((food) => (
              <div key={food.id} className="card">
                <button
                  type="button"
                  className="food-card-trigger"
                  onClick={() => toggleFoodDetails(food.id)}
                  aria-expanded={expandedFoodId === food.id}
                >
                  <span className="food-card-name">{food.nombre}</span>
                  <span className="food-card-arrow" aria-hidden="true">
                    {expandedFoodId === food.id ? "▲" : "▼"}
                  </span>
                </button>

                {expandedFoodId === food.id && (
                  <div className="food-card-details">
                    <p>
                      <strong>Calorías:</strong> {food.calorias}
                    </p>
                    <p>
                      <strong>Proteínas:</strong> {food.proteinas} g
                    </p>
                    <p>
                      <strong>Carbos:</strong> {food.carbos} g
                    </p>
                    <p>
                      <strong>Grasas:</strong> {food.grasas} g
                    </p>
                    <p>
                      <strong>Fuente:</strong> {food.fuente}
                    </p>

                    <button
                      type="button"
                      className="delete-button"
                      onClick={() => handleDeleteFood(food.id, food.nombre)}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <button
            type="button"
            className="modal-backdrop"
            onClick={closeModal}
            aria-label="Cerrar ventana de crear alimento"
          />
          <div className="modal-card">
            <div className="modal-header">
              <h3>Crear alimento</h3>
              <button
                className="close-button"
                onClick={closeModal}
                type="button"
                aria-label="Cerrar ventana"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateFood} className="modal-form">
              <div className="field-group">
                <label htmlFor="nombre">Nombre</label>
                <input
                  id="nombre"
                  type="text"
                  name="nombre"
                  placeholder="Ej. Avena"
                  value={formData.nombre}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="field-group">
                <label htmlFor="calorias">Calorías</label>
                <input
                  id="calorias"
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
                <label htmlFor="proteinas">Proteínas</label>
                <input
                  id="proteinas"
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
                <label htmlFor="carbos">Carbohidratos</label>
                <input
                  id="carbos"
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
                <label htmlFor="grasas">Grasas</label>
                <input
                  id="grasas"
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
                <label htmlFor="fuente">Fuente</label>
                <select
                  id="fuente"
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
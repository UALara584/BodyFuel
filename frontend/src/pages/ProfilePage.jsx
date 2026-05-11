import { useEffect, useState } from "react";
import {
  fetchFriends,
  fetchUserById,
  respondFriendInvitation,
  searchUsersForFriends,
  sendFriendInvitation,
  updateUser,
} from "../services/api";

const emptyProfile = {
  email: "",
  nombre: "",
  edad: "",
  fecha_nacimiento: "",
  sexo: "mujer",
  peso: "",
  peso_kg: "",
  altura: "",
  altura_cm: "",
  peso_objetivo_kg: "",
  nivel_actividad: 3,
  objetivo: "",
  tipo_dieta: "",
  intolerancias: [],
  calorias_objetivo: "",
};

const exampleProfile = {
  email: "",
  nombre: "Laura",
  edad: 28,
  fecha_nacimiento: "1998-05-08",
  sexo: "mujer",
  peso_kg: 68,
  altura_cm: 165,
  peso_objetivo_kg: 58,
  nivel_actividad: 3,
  objetivo: "perder",
  tipo_dieta: "Mediterranea",
  intolerancias: ["lactosa"],
};

const activityLevels = {
  1: { label: "Sedentario", factor: 1.2 },
  2: { label: "Ligero", factor: 1.375 },
  3: { label: "Moderado", factor: 1.55 },
  4: { label: "Activo", factor: 1.725 },
  5: { label: "Muy activo", factor: 1.9 },
};

const objectiveLabels = {
  perder: "Perder peso",
  mantener: "Mantener",
  ganar: "Ganar músculo",
};

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeObjective(value, weight, targetWeight) {
  const text = (value || "").toString().trim().toLowerCase();

  if (["perder", "mantener", "ganar"].includes(text)) return text;
  if (text.includes("perder") || text.includes("bajar") || text.includes("defin")) return "perder";
  if (text.includes("ganar") || text.includes("musculo") || text.includes("volumen")) return "ganar";
  if (text.includes("mant")) return "mantener";
  if (targetWeight && weight && targetWeight < weight) return "perder";
  if (targetWeight && weight && targetWeight > weight) return "ganar";
  return "mantener";
}

function normalizeIntolerances(value, fallback = []) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return fallback;
}

function getAgeFromBirthDate(birthDate) {
  if (!birthDate) return null;
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  const birthdayPending = monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate());

  if (birthdayPending) age -= 1;
  return age;
}

function getInitials(name) {
  const parts = (name || "Usuario")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase()).join("") || "U";
}

function createProfileFromUser(user = {}, useExampleDefaults = false) {
  const defaults = useExampleDefaults ? exampleProfile : {};
  const merged = { ...defaults, ...user };
  const fallbackWeight = useExampleDefaults ? exampleProfile.peso_kg : firstDefined(user.peso_kg, user.peso, exampleProfile.peso_kg);
  const weight = toNumber(firstDefined(merged.peso_kg, merged.peso, fallbackWeight), exampleProfile.peso_kg);
  const explicitTarget = firstDefined(merged.peso_objetivo_kg, merged.peso_objetivo, merged.objetivo_peso);
  const objective = normalizeObjective(firstDefined(merged.objetivo, exampleProfile.objetivo), weight, toNumber(explicitTarget, 0));
  const inferredTarget =
    objective === "mantener" ? weight : objective === "ganar" ? weight + 5 : Math.max(weight - 5, 1);
  const targetWeight = toNumber(firstDefined(explicitTarget, useExampleDefaults ? exampleProfile.peso_objetivo_kg : inferredTarget), inferredTarget);
  const birthDate = firstDefined(merged.fecha_nacimiento, merged.fechaNacimiento, "");
  const age = firstDefined(getAgeFromBirthDate(birthDate), merged.edad, exampleProfile.edad);
  const height = toNumber(firstDefined(merged.altura_cm, merged.altura, exampleProfile.altura_cm), exampleProfile.altura_cm);

  return {
    ...emptyProfile,
    email: merged.email || "",
    nombre: merged.nombre || exampleProfile.nombre,
    edad: age?.toString() || "",
    fecha_nacimiento: birthDate || "",
    sexo: merged.sexo === "hombre" ? "hombre" : "mujer",
    peso: weight.toString(),
    peso_kg: weight.toString(),
    altura: height.toString(),
    altura_cm: height.toString(),
    peso_objetivo_kg: targetWeight.toString(),
    nivel_actividad: toNumber(firstDefined(merged.nivel_actividad, exampleProfile.nivel_actividad), exampleProfile.nivel_actividad),
    objetivo: objective,
    tipo_dieta: firstDefined(merged.tipo_dieta, useExampleDefaults ? exampleProfile.tipo_dieta : "General"),
    intolerancias: normalizeIntolerances(
      firstDefined(merged.intolerancias, merged.intolerancia),
      useExampleDefaults ? exampleProfile.intolerancias : []
    ),
    calorias_objetivo: merged.calorias_objetivo?.toString() || "",
  };
}

function getBmiCategory(bmi) {
  if (bmi < 18.5) return { label: "Bajo peso", className: "bmi-low" };
  if (bmi < 25) return { label: "Normal", className: "bmi-normal" };
  if (bmi < 30) return { label: "Sobrepeso", className: "bmi-overweight" };
  return { label: "Obesidad", className: "bmi-obesity" };
}

function calculateNutritionProfile(profile) {
  const weight = toNumber(profile.peso_kg || profile.peso, exampleProfile.peso_kg);
  const height = toNumber(profile.altura_cm || profile.altura, exampleProfile.altura_cm);
  const targetWeight = toNumber(profile.peso_objetivo_kg, weight);
  const age = toNumber(firstDefined(getAgeFromBirthDate(profile.fecha_nacimiento), profile.edad), exampleProfile.edad);
  const heightMeters = height / 100;
  const bmi = weight / (heightMeters * heightMeters);
  const bmiCategory = getBmiCategory(bmi);
  const activity = activityLevels[profile.nivel_actividad] || activityLevels[3];
  const bmr =
    profile.sexo === "hombre"
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;
  const tdee = bmr * activity.factor;
  const objective = normalizeObjective(profile.objetivo, weight, targetWeight);
  const targetCalories = objective === "perder" ? tdee - 500 : objective === "ganar" ? tdee + 300 : tdee;
  const proteinPct = objective === "ganar" ? 35 : 30;
  const carbsPct = objective === "ganar" ? 35 : 40;
  const fatPct = 30;
  const waterLiters = (weight * 35) / 1000;
  const remainingKg = Math.abs(weight - targetWeight);
  const estimatedWeeks =
    objective === "mantener" ? "en mantenimiento" : `${Math.max(1, Math.ceil(remainingKg / 0.5))} semanas`;
  const progressPercent = objective === "mantener" || remainingKg === 0 ? 100 : 8;

  return {
    weight,
    height,
    targetWeight,
    age,
    bmi,
    bmiCategory,
    activity,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories: Math.round(targetCalories),
    waterLiters,
    remainingKg,
    estimatedWeeks,
    progressPercent,
    objective,
    macros: [
      {
        key: "proteinas",
        label: "Proteínas",
        percent: proteinPct,
        grams: Math.round((targetCalories * proteinPct) / 100 / 4),
        className: "macro-protein-fill",
      },
      {
        key: "carbohidratos",
        label: "Carbohidratos",
        percent: carbsPct,
        grams: Math.round((targetCalories * carbsPct) / 100 / 4),
        className: "macro-carb-fill",
      },
      {
        key: "grasas",
        label: "Grasas",
        percent: fatPct,
        grams: Math.round((targetCalories * fatPct) / 100 / 9),
        className: "macro-fat-fill",
      },
    ],
  };
}

export default function ProfilePage() {
  const [profile, setProfile] = useState(emptyProfile);
  const [passwordData, setPasswordData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [userId, setUserId] = useState(null);
  const [friendsData, setFriendsData] = useState({
    friends: [],
    incoming: [],
    outgoing: [],
  });
  const [friendSearchTerm, setFriendSearchTerm] = useState("");
  const [friendSearchResults, setFriendSearchResults] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState("");
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [showProfileSection, setShowProfileSection] = useState(true);
  const [showNutritionSection, setShowNutritionSection] = useState(true);
  const [showFriendsSection, setShowFriendsSection] = useState(true);
  const [activeMetricInfo, setActiveMetricInfo] = useState(null);

  async function loadFriends(currentUserId) {
    try {
      setFriendsLoading(true);
      setFriendsError("");
      const data = await fetchFriends(currentUserId);
      setFriendsData(data);
    } catch (err) {
      const message = err.message || "";
      if (message.includes('{"detail":"Not Found"}')) {
        setFriendsError(
          "El backend activo no tiene el módulo de amigos. Reinicia el backend para habilitarlo."
        );
      } else {
        setFriendsError(message);
      }
    } finally {
      setFriendsLoading(false);
    }
  }

  useEffect(() => {
    async function loadProfileAndFriends() {
      let storedUser = null;

      try {
        storedUser = JSON.parse(localStorage.getItem("bf_current_user") || "null");

        if (!storedUser?.id) {
          setProfile(createProfileFromUser(exampleProfile, true));
          setFriendsLoading(false);
          return;
        }

        setUserId(storedUser.id);

        const freshUser = await fetchUserById(storedUser.id);
        setProfile(createProfileFromUser({ ...storedUser, ...freshUser }));

        // Load friends automatically
        await loadFriends(storedUser.id);
      } catch (err) {
        if (storedUser) {
          setProfile(createProfileFromUser(storedUser));
          setFriendsLoading(false);
        }
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadProfileAndFriends();
  }, []);

  function handleProfileChange(event) {
    const { name, value } = event.target;
    setProfile((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handlePasswordChange(event) {
    const { name, value } = event.target;
    setPasswordData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleFriendSearchInput(event) {
    setFriendSearchTerm(event.target.value);
  }

  async function handleFriendSearch(event) {
    event.preventDefault();
    setFriendsError("");

    const term = friendSearchTerm.trim();
    if (term.length < 2) {
      setFriendsError("Escribe al menos 2 caracteres para buscar.");
      return;
    }

    try {
      setFriendActionLoading(true);
      const results = await searchUsersForFriends(userId, term);
      setFriendSearchResults(results);
    } catch (err) {
      setFriendsError(err.message);
    } finally {
      setFriendActionLoading(false);
    }
  }

  async function handleSendInvitation(targetUserId) {
    try {
      setFriendActionLoading(true);
      setFriendsError("");
      await sendFriendInvitation(userId, targetUserId);
      setFriendSearchResults((prev) => prev.filter((candidate) => candidate.id !== targetUserId));
      await loadFriends(userId);
    } catch (err) {
      setFriendsError(err.message);
    } finally {
      setFriendActionLoading(false);
    }
  }

  async function handleAcceptInvitation(invitationId) {
    try {
      setFriendActionLoading(true);
      setFriendsError("");
      await respondFriendInvitation(invitationId, userId, true);
      await loadFriends(userId);
    } catch (err) {
      setFriendsError(err.message);
    } finally {
      setFriendActionLoading(false);
    }
  }

  function openEditModal() {
    setShowEditModal(true);
    setError("");
    setSuccess("");
  }

  function closeEditModal() {
    setShowEditModal(false);
    setPasswordData({ password: "", confirmPassword: "" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (passwordData.password || passwordData.confirmPassword) {
      if (passwordData.password.length < 6) {
        setError("La contraseña debe tener al menos 6 caracteres.");
        return;
      }

      if (passwordData.password !== passwordData.confirmPassword) {
        setError("Las contraseñas no coinciden.");
        return;
      }
    }

    const payload = {};

    if (profile.email.trim()) payload.email = profile.email.trim();
    if (profile.nombre.trim()) payload.nombre = profile.nombre.trim();
    if (profile.edad.trim()) payload.edad = Number(profile.edad);
    if (profile.peso.trim()) payload.peso = Number(profile.peso);
    if (profile.altura.trim()) payload.altura = Number(profile.altura);
    if (profile.objetivo.trim()) payload.objetivo = profile.objetivo.trim();
    if (profile.calorias_objetivo.trim()) {
      payload.calorias_objetivo = Number(profile.calorias_objetivo);
    }
    if (passwordData.password) payload.password = passwordData.password;

    if (Object.keys(payload).length === 0) {
      setError("Completa al menos un dato para guardar.");
      return;
    }

    try {
      setSaving(true);
      const updatedUser = await updateUser(userId, payload);
      localStorage.setItem("bf_current_user", JSON.stringify(updatedUser));
      setSuccess("Perfil actualizado correctamente.");
      closeEditModal();
      setPasswordData({ password: "", confirmPassword: "" });
      setProfile(
        createProfileFromUser({
          ...profile,
          ...updatedUser,
          peso_kg: updatedUser.peso ?? profile.peso_kg,
          altura_cm: updatedUser.altura ?? profile.altura_cm,
        })
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const nutritionData = calculateNutritionProfile(profile);
  const intoleranceText = profile.intolerancias.length > 0 ? profile.intolerancias.join(", ") : "Ninguna";
  const metricCards = [
    {
      key: "imc",
      label: "IMC",
      value: nutritionData.bmi.toFixed(1),
      detail: nutritionData.bmiCategory.label,
      className: nutritionData.bmiCategory.className,
      explanation:
        "Compara tu peso con tu altura para orientar si estas en un rango bajo, normal o alto. Es una guia general: no distingue musculo, grasa ni otros detalles personales.",
    },
    {
      key: "tmb",
      label: "TMB",
      value: `${nutritionData.bmr} kcal`,
      detail: "Reposo diario",
      explanation:
        "Es la energia que tu cuerpo gastaria en reposo para funciones basicas como respirar, mantener la temperatura y que los organos trabajen.",
    },
    {
      key: "tdee",
      label: "TDEE",
      value: `${nutritionData.tdee} kcal`,
      detail: nutritionData.activity.label,
      explanation:
        "Es tu gasto total diario: suma lo que gastas en reposo y lo que gastas por moverte o entrenar. Ayuda a estimar las calorias para mantener tu peso.",
    },
    {
      key: "targetCalories",
      label: "Objetivo calórico",
      value: `${nutritionData.targetCalories} kcal`,
      detail: objectiveLabels[nutritionData.objective],
      explanation:
        "Son las calorias diarias recomendadas segun tu meta: menos para perder peso, parecidas para mantener o algo mas para ganar musculo.",
    },
    {
      key: "water",
      label: "Agua diaria",
      value: `${nutritionData.waterLiters.toFixed(1)} L`,
      detail: "35 ml por kg",
      explanation:
        "Es una estimacion de agua al dia basada en tu peso. Puede subir si hace calor, entrenas mucho o sudas mas de lo habitual.",
    },
    {
      key: "estimatedWeeks",
      label: "Semanas estimadas",
      value: nutritionData.estimatedWeeks,
      detail: "Ritmo de 0.5 kg/sem",
      explanation:
        "Es un calculo aproximado del tiempo para acercarte a tu peso objetivo con un ritmo moderado. Sirve como referencia, no como fecha exacta.",
    },
  ];
  const selectedMetricInfo = metricCards.find((metric) => metric.key === activeMetricInfo);

  if (loading) {
    return <p>Cargando perfil...</p>;
  }

  return (
    <div className="page profile-page">
      <div className="page-header">
        <h2>Mi perfil</h2>
        <p>Revisa, completa y actualiza tus datos personales.</p>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {success ? <p className="success-text">{success}</p> : null}

      <section className="card profile-summary profile-summary-panel">
        <button
          type="button"
          className="profile-friends-toggle"
          onClick={() => setShowProfileSection((prev) => !prev)}
          aria-expanded={showProfileSection}
        >
          <span>Datos actuales</span>
          <span>{showProfileSection ? "Ocultar" : "Mostrar"}</span>
        </button>

        {showProfileSection ? (
          <>
            <div className="profile-summary-head">
              <div>
                <p>Si algún campo está vacío, puedes completarlo en el editor.</p>
              </div>

              <button type="button" className="profile-edit-button" onClick={openEditModal}>
                Editar perfil
              </button>
            </div>

            <div className="profile-summary-list">
              <div><span>Correo</span><strong>{profile.email || "Sin datos"}</strong></div>
              <div><span>Nombre</span><strong>{profile.nombre || "Sin datos"}</strong></div>
              <div><span>Edad</span><strong>{profile.edad || "Sin datos"}</strong></div>
              <div><span>Peso</span><strong>{profile.peso ? `${profile.peso} kg` : "Sin datos"}</strong></div>
              <div><span>Altura</span><strong>{profile.altura ? `${profile.altura} cm` : "Sin datos"}</strong></div>
              <div><span>Objetivo</span><strong>{profile.objetivo || "Sin datos"}</strong></div>
              <div><span>Calorías objetivo</span><strong>{profile.calorias_objetivo || "Sin datos"}</strong></div>
            </div>
          </>
        ) : null}
      </section>

      <section className="profile-nutrition-panel">
        <button
          type="button"
          className="profile-friends-toggle"
          onClick={() => setShowNutritionSection((prev) => !prev)}
          aria-expanded={showNutritionSection}
        >
          <span>Datos nutricionales</span>
          <span>{showNutritionSection ? "Ocultar" : "Mostrar"}</span>
        </button>

        {showNutritionSection ? (
          <>
        <header className="nutrition-profile-header">
          <div className="nutrition-avatar" aria-hidden="true">
            {getInitials(profile.nombre)}
          </div>

          <div className="nutrition-profile-main">
            <h3>{profile.nombre || "Usuario"}</h3>
            <p>
              {nutritionData.age} años · {profile.sexo === "hombre" ? "Hombre" : "Mujer"}
            </p>
          </div>

          <div className="nutrition-badges">
            <span>{objectiveLabels[nutritionData.objective]}</span>
            <span>{profile.tipo_dieta || "General"}</span>
          </div>
        </header>

        <section className="nutrition-block">
          <h3>Datos personales</h3>
          <div className="nutrition-personal-list">
            <div className="nutrition-personal-row">
              <span className="nutrition-row-icon">kg</span>
              <span>Peso actual</span>
              <strong>{Math.round(nutritionData.weight)} kg</strong>
            </div>
            <div className="nutrition-personal-row">
              <span className="nutrition-row-icon">cm</span>
              <span>Altura</span>
              <strong>{Math.round(nutritionData.height)} cm</strong>
            </div>
            <div className="nutrition-personal-row">
              <span className="nutrition-row-icon">act</span>
              <span>Actividad</span>
              <strong>
                {nutritionData.activity.label} · {nutritionData.activity.factor}
              </strong>
            </div>
            <div className="nutrition-personal-row">
              <span className="nutrition-row-icon">int</span>
              <span>Intolerancias</span>
              <strong>{intoleranceText}</strong>
            </div>
          </div>
        </section>

        <section className="nutrition-block">
          <h3>Calculado automáticamente</h3>
          <div className="nutrition-metrics-grid">
            {metricCards.map((metric) => {
              const isMetricInfoOpen = activeMetricInfo === metric.key;

              return (
                <div key={metric.key} className={`nutrition-metric-card ${metric.className || ""}`}>
                  <button
                    type="button"
                    className="nutrition-metric-label"
                    onClick={() => setActiveMetricInfo(metric.key)}
                    aria-haspopup="dialog"
                    aria-expanded={isMetricInfoOpen}
                  >
                    {metric.label}
                  </button>
                  <strong>{metric.value}</strong>
                  <small>{metric.detail}</small>
                </div>
              );
            })}
          </div>
        </section>

        <section className="nutrition-block">
          <div className="nutrition-section-head">
            <h3>Macronutrientes diarios</h3>
            <strong>{nutritionData.targetCalories} kcal</strong>
          </div>

          <div className="nutrition-macro-list">
            {nutritionData.macros.map((macro) => (
              <div key={macro.key} className="nutrition-macro-row">
                <div className="nutrition-macro-top">
                  <span>{macro.label}</span>
                  <strong>{macro.grams} g</strong>
                </div>
                <div className="nutrition-macro-track" aria-hidden="true">
                  <span
                    className={`nutrition-macro-fill ${macro.className}`}
                    style={{ width: `${macro.percent}%` }}
                  />
                </div>
                <small>{macro.percent}% del objetivo calórico</small>
              </div>
            ))}
          </div>

          <p className="nutrition-macro-summary">
            {nutritionData.macros.map((macro) => `${macro.label} ${macro.percent}%`).join(" · ")} · Total{" "}
            {nutritionData.targetCalories} kcal
          </p>
        </section>

        <section className="nutrition-block">
          <div className="nutrition-section-head">
            <h3>Progreso hacia el objetivo</h3>
            <strong>{Math.round(nutritionData.remainingKg)} kg restantes</strong>
          </div>

          <div
            className="nutrition-weight-progress"
            style={{ "--profile-progress": `${nutritionData.progressPercent}%` }}
          >
            <span className="nutrition-weight-fill" />
          </div>

          <div className="nutrition-progress-labels">
            <span>{Math.round(nutritionData.weight)} kg actual</span>
            <strong>
              {nutritionData.objective === "mantener"
                ? "En mantenimiento"
                : `Semana actual 1 de ${nutritionData.estimatedWeeks.replace(" semanas", "")}`}
            </strong>
            <span>{Math.round(nutritionData.targetWeight)} kg objetivo</span>
          </div>
        </section>
          </>
        ) : null}
      </section>

      <section className="card profile-friends-panel">
        <button
          type="button"
          className="profile-friends-toggle"
          onClick={() => setShowFriendsSection((prev) => !prev)}
          aria-expanded={showFriendsSection}
        >
          <span>Amigos</span>
          <span>{showFriendsSection ? "Ocultar" : "Mostrar"}</span>
        </button>

        {showFriendsSection ? (
          <>
            <div className="profile-summary-head">
              <div>
                <h3>Buscar personas</h3>
                <p>Busca usuarios por nombre o correo para invitarlos a tu red.</p>
              </div>
            </div>

            {friendsError ? <p className="error-text">{friendsError}</p> : null}

            <form className="search-form profile-friends-search" onSubmit={handleFriendSearch}>
              <input
                type="text"
                value={friendSearchTerm}
                onChange={handleFriendSearchInput}
                placeholder="Buscar por nombre o correo"
              />
              <button type="submit" disabled={friendActionLoading || !userId}>
                Buscar
              </button>
            </form>

            {friendSearchResults.length > 0 ? (
              <div className="profile-friends-search-results">
                {friendSearchResults.map((candidate) => (
                  <div key={candidate.id} className="profile-friend-row">
                    <div>
                      <strong>{candidate.nombre}</strong>
                      <p>{candidate.email}</p>
                    </div>
                    <button
                      type="button"
                      className="profile-edit-button"
                      onClick={() => handleSendInvitation(candidate.id)}
                      disabled={friendActionLoading}
                    >
                      Invitar
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <section className="card profile-friends-panel">
              <div className="profile-summary-head">
                <div>
                  <h3>Mis amigos</h3>
                  <p>Personas que ya aceptaron tu invitación o tú aceptaste la suya.</p>
                </div>
                <button
                  type="button"
                  className="profile-edit-button"
                  disabled={!userId || friendActionLoading}
                  onClick={() => loadFriends(userId)}
                >
                  Actualizar
                </button>
              </div>

              {friendsLoading ? (
                <p>Cargando amigos...</p>
              ) : friendsData.friends.length === 0 ? (
                <p className="item-note">Todavía no tienes amigos agregados.</p>
              ) : (
                <div className="profile-friends-search-results">
                  {friendsData.friends.map((friend) => (
                    <div key={friend.id} className="profile-friend-row">
                      <div>
                        <strong>{friend.nombre}</strong>
                        <p>{friend.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card profile-friends-panel">
              <div className="profile-summary-head">
                <div>
                  <h3>Invitaciones recibidas</h3>
                  <p>Acepta solicitudes para añadir nuevos amigos.</p>
                </div>
                <button
                  type="button"
                  className="profile-edit-button"
                  disabled={!userId || friendActionLoading}
                  onClick={() => loadFriends(userId)}
                >
                  Actualizar
                </button>
              </div>

              {friendsLoading ? (
                <p>Cargando invitaciones...</p>
              ) : friendsData.incoming.length === 0 ? (
                <p className="item-note">No tienes invitaciones pendientes.</p>
              ) : (
                <div className="profile-friends-search-results">
                  {friendsData.incoming.map((invitation) => (
                    <div key={invitation.invitation_id} className="profile-friend-row">
                      <div>
                        <strong>{invitation.user.nombre}</strong>
                        <p>{invitation.user.email}</p>
                      </div>
                      <button
                        type="button"
                        className="profile-edit-button"
                        disabled={friendActionLoading}
                        onClick={() => handleAcceptInvitation(invitation.invitation_id)}
                      >
                        Aceptar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </section>

      {selectedMetricInfo ? (
        <div className="modal-overlay">
          <button
            type="button"
            className="modal-backdrop"
            onClick={() => setActiveMetricInfo(null)}
            aria-label="Cerrar pop-up de explicación"
          />

          <div
            className="modal-card profile-metric-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="metric-info-title"
          >
            <div className="modal-header">
              <div>
                <p className="profile-metric-kicker">Dato nutricional</p>
                <h3 id="metric-info-title">{selectedMetricInfo.label}</h3>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setActiveMetricInfo(null)}
                aria-label="Cerrar explicación"
              >
                ×
              </button>
            </div>

            <div className="profile-metric-modal-body">
              <div className="profile-metric-value">
                <strong>{selectedMetricInfo.value}</strong>
                <span>{selectedMetricInfo.detail}</span>
              </div>
              <p>{selectedMetricInfo.explanation}</p>
            </div>
          </div>
        </div>
      ) : null}

      {showEditModal && (
        <div className="modal-overlay">
          <button
            type="button"
            className="modal-backdrop"
            onClick={closeEditModal}
            aria-label="Cerrar editor de perfil"
          />

          <div className="modal-card profile-modal-card">
            <div className="modal-header">
              <h3>Editar perfil</h3>
              <button type="button" className="close-button" onClick={closeEditModal} aria-label="Cerrar ventana">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="profile-form profile-modal-form">
              <div className="field-group">
                <label htmlFor="email">Correo</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={profile.email}
                  onChange={handleProfileChange}
                  placeholder="correo@dominio.com"
                />
              </div>

              <div className="field-group">
                <label htmlFor="nombre">Nombre</label>
                <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  value={profile.nombre}
                  onChange={handleProfileChange}
                  placeholder="Tu nombre"
                />
              </div>

              <div className="field-group">
                <label htmlFor="edad">Edad</label>
                <input
                  id="edad"
                  name="edad"
                  type="number"
                  min="0"
                  value={profile.edad}
                  onChange={handleProfileChange}
                  placeholder="Ej. 28"
                />
              </div>

              <div className="field-group">
                <label htmlFor="peso">Peso (kg)</label>
                <input
                  id="peso"
                  name="peso"
                  type="number"
                  min="0"
                  step="0.1"
                  value={profile.peso}
                  onChange={handleProfileChange}
                  placeholder="Ej. 72.5"
                />
              </div>

              <div className="field-group">
                <label htmlFor="altura">Altura (cm)</label>
                <input
                  id="altura"
                  name="altura"
                  type="number"
                  min="0"
                  step="0.1"
                  value={profile.altura}
                  onChange={handleProfileChange}
                  placeholder="Ej. 175"
                />
              </div>

              <div className="field-group">
                <label htmlFor="objetivo">Objetivo</label>
                <input
                  id="objetivo"
                  name="objetivo"
                  type="text"
                  value={profile.objetivo}
                  onChange={handleProfileChange}
                  placeholder="Ej. Definición"
                />
              </div>

              <div className="field-group">
                <label htmlFor="calorias_objetivo">Calorías objetivo</label>
                <input
                  id="calorias_objetivo"
                  name="calorias_objetivo"
                  type="number"
                  min="0"
                  value={profile.calorias_objetivo}
                  onChange={handleProfileChange}
                  placeholder="Ej. 2200"
                />
              </div>

              <div className="profile-password-box">
                <h4>Cambiar contraseña</h4>
                <p>Si no quieres cambiarla, deja estos campos vacíos.</p>

                <div className="field-group">
                  <label htmlFor="password">Nueva contraseña</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={passwordData.password}
                    onChange={handlePasswordChange}
                    placeholder="Nueva contraseña"
                  />
                </div>

                <div className="field-group">
                  <label htmlFor="confirmPassword">Confirmar contraseña</label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    placeholder="Repite la nueva contraseña"
                  />
                </div>
              </div>

              <button type="submit" className="profile-save-button" disabled={saving}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProfileMenu from "../components/ProfileMenu";
import { UserAvatar } from "../components/UserAvatar";
import { deleteUserAccount, fetchUserById, updateUser } from "../services/api";
import { createAvatarFromFile, PROFILE_AVATARS } from "../utils/avatar";
import {
  clearStoredCurrentUser,
  getStoredCurrentUser,
  storeCurrentUser,
} from "../utils/currentUser";

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
  objetivo: "mantener",
  tipo_dieta: "",
  intolerancias: [],
  calorias_objetivo: "",
  avatar: "initials",
  profile_image: "",
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
  tipo_dieta: "Mediterránea",
  intolerancias: ["lactosa"],
  avatar: "preset:mint",
  profile_image: "",
};

const activityOptions = [
  { value: 1, label: "Sedentario" },
  { value: 2, label: "Ligero" },
  { value: 3, label: "Moderado" },
  { value: 4, label: "Activo" },
  { value: 5, label: "Muy activo" },
];

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

function createProfileFromUser(user = {}, useExampleDefaults = false) {
  const defaults = useExampleDefaults ? exampleProfile : {};
  const merged = { ...defaults, ...user };
  const fallbackWeight = useExampleDefaults ? exampleProfile.peso_kg : firstDefined(user.peso_kg, user.peso);
  const weight = toNumber(firstDefined(merged.peso_kg, merged.peso, fallbackWeight), "");
  const explicitTarget = firstDefined(merged.peso_objetivo_kg, merged.peso_objetivo, merged.objetivo_peso);
  const targetWeight = toNumber(firstDefined(explicitTarget, weight), "");
  const objective = normalizeObjective(
    firstDefined(merged.objetivo, useExampleDefaults ? exampleProfile.objetivo : ""),
    weight,
    targetWeight
  );
  const birthDate = firstDefined(merged.fecha_nacimiento, merged.fechaNacimiento, "");
  const age = firstDefined(getAgeFromBirthDate(birthDate), merged.edad);
  const height = toNumber(firstDefined(merged.altura_cm, merged.altura), "");

  return {
    ...emptyProfile,
    email: merged.email || "",
    nombre: merged.nombre || (useExampleDefaults ? exampleProfile.nombre : ""),
    edad: age?.toString() || "",
    fecha_nacimiento: birthDate || "",
    sexo: merged.sexo === "hombre" ? "hombre" : "mujer",
    peso: weight?.toString() || "",
    peso_kg: weight?.toString() || "",
    altura: height?.toString() || "",
    altura_cm: height?.toString() || "",
    peso_objetivo_kg: targetWeight?.toString() || "",
    nivel_actividad: toNumber(firstDefined(merged.nivel_actividad, exampleProfile.nivel_actividad), 3),
    objetivo: objective,
    tipo_dieta: firstDefined(merged.tipo_dieta, useExampleDefaults ? exampleProfile.tipo_dieta : ""),
    intolerancias: normalizeIntolerances(
      firstDefined(merged.intolerancias, merged.intolerancia),
      useExampleDefaults ? exampleProfile.intolerancias : []
    ),
    calorias_objetivo: merged.calorias_objetivo?.toString() || "",
    avatar: merged.avatar || "initials",
    profile_image:
      merged.profile_image ||
      (typeof merged.avatar === "string" && merged.avatar.startsWith("data:image/") ? merged.avatar : ""),
  };
}

function getBmiCategory(bmi) {
  if (bmi < 18.5) return { label: "Bajo peso", className: "bmi-low" };
  if (bmi < 25) return { label: "Normal", className: "bmi-normal" };
  if (bmi < 30) return { label: "Sobrepeso", className: "bmi-overweight" };
  return { label: "Obesidad", className: "bmi-obesity" };
}

function calculateNutritionProfile(profile) {
  const weight = toNumber(firstDefined(profile.peso_kg, profile.peso, exampleProfile.peso_kg), exampleProfile.peso_kg);
  const height = toNumber(firstDefined(profile.altura_cm, profile.altura, exampleProfile.altura_cm), exampleProfile.altura_cm);
  const targetWeight = toNumber(firstDefined(profile.peso_objetivo_kg, weight), weight);
  const age = toNumber(firstDefined(getAgeFromBirthDate(profile.fecha_nacimiento), profile.edad, exampleProfile.edad), exampleProfile.edad);
  const heightMeters = height > 0 ? height / 100 : exampleProfile.altura_cm / 100;
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

function optionalNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIntolerances(value) {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function persistCurrentUser(user) {
  storeCurrentUser(user);
  window.dispatchEvent(new Event("bf:user-updated"));
}

export default function ProfilePage({ mode = "summary" }) {
  const isEditPage = mode === "edit";
  const navigate = useNavigate();
  const [profile, setProfile] = useState(emptyProfile);
  const [savedProfile, setSavedProfile] = useState(emptyProfile);
  const [passwordData, setPasswordData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [intolerancesText, setIntolerancesText] = useState("");
  const [caloriesEdited, setCaloriesEdited] = useState(false);
  const [activeMetricInfo, setActiveMetricInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [avatarSuccess, setAvatarSuccess] = useState("");
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [userId, setUserId] = useState(null);
  const avatarFileInputRef = useRef(null);

  useEffect(() => {
    async function loadProfile() {
      let storedUser = null;

      try {
        storedUser = getStoredCurrentUser();

        if (!storedUser?.id) {
          const nextProfile = createProfileFromUser(exampleProfile, true);
          setProfile(nextProfile);
          setSavedProfile(nextProfile);
          setIntolerancesText(nextProfile.intolerancias.join(", "));
          setCaloriesEdited(false);
          return;
        }

        setUserId(storedUser.id);
        const freshUser = await fetchUserById(storedUser.id);
        const currentUser = { ...storedUser, ...freshUser };
        persistCurrentUser(currentUser);
        const nextProfile = createProfileFromUser(currentUser);
        setProfile(nextProfile);
        setSavedProfile(nextProfile);
        setIntolerancesText(nextProfile.intolerancias.join(", "));
        setCaloriesEdited(false);
      } catch (err) {
        if (storedUser) {
          const fallbackProfile = createProfileFromUser(storedUser);
          setProfile(fallbackProfile);
          setSavedProfile(fallbackProfile);
          setIntolerancesText(fallbackProfile.intolerancias.join(", "));
          setCaloriesEdited(false);
        }
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  function handleProfileChange(event) {
    const { name, value } = event.target;

    if (name === "calorias_objetivo") {
      setCaloriesEdited(true);
    }

    setProfile((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "peso" ? { peso_kg: value } : {}),
      ...(name === "altura" ? { altura_cm: value } : {}),
    }));
  }

  function handlePasswordChange(event) {
    const { name, value } = event.target;
    setPasswordData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleAvatarSelect(avatarId) {
    setAvatarError("");
    setAvatarSuccess("");
    setProfile((prev) => ({
      ...prev,
      avatar: `preset:${avatarId}`,
    }));
  }

  async function handleAvatarFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setAvatarError("");
    setAvatarSuccess("");

    try {
      const avatar = await createAvatarFromFile(file);
      setProfile((prev) => ({
        ...prev,
        avatar,
        profile_image: avatar,
      }));
    } catch (err) {
      setAvatarError(err.message);
    }
  }

  function handleUseImage() {
    setAvatarError("");
    setAvatarSuccess("");

    if (profile.profile_image) {
      setProfile((prev) => ({ ...prev, avatar: prev.profile_image }));
      return;
    }

    avatarFileInputRef.current?.click();
  }

  async function handleAvatarSave() {
    setAvatarError("");
    setAvatarSuccess("");

    if (!userId) {
      setAvatarError("No hay usuario activo para guardar la foto.");
      return;
    }

    try {
      setAvatarSaving(true);
      const updatedUser = await updateUser(userId, {
        avatar: profile.avatar || "initials",
        profile_image: profile.profile_image || null,
      });
      let freshUser = updatedUser;

      try {
        freshUser = await fetchUserById(userId);
      } catch {
        freshUser = updatedUser;
      }

      const storedUser = getStoredCurrentUser() || {};
      const currentUser = { ...storedUser, ...updatedUser, ...freshUser };
      const savedAvatar = currentUser.avatar || "initials";
      const savedImage = currentUser.profile_image || "";

      persistCurrentUser(currentUser);
      setProfile((prev) => ({
        ...prev,
        avatar: savedAvatar,
        profile_image: savedImage,
      }));
      setSavedProfile((prev) => ({
        ...prev,
        avatar: savedAvatar,
        profile_image: savedImage,
      }));
      setAvatarSuccess("Foto de perfil guardada correctamente.");
    } catch (err) {
      setAvatarError(err.message);
    } finally {
      setAvatarSaving(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!userId) {
      setError("No hay usuario activo para guardar cambios.");
      return;
    }

    if (!profile.email.trim() || !profile.nombre.trim()) {
      setError("El correo y el nombre son obligatorios.");
      return;
    }

    if (!isValidEmail(profile.email.trim())) {
      setError("Introduce un correo válido.");
      return;
    }

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

    const currentIntolerances = parseIntolerances(intolerancesText);
    const weight = optionalNumber(profile.peso);
    const height = optionalNumber(profile.altura);
    const targetWeight = optionalNumber(profile.peso_objetivo_kg);
    const activityLevel = optionalNumber(profile.nivel_actividad);
    const targetCalories = optionalNumber(profile.calorias_objetivo);
    const shouldRecalculateCalories =
      optionalNumber(profile.edad) !== optionalNumber(savedProfile.edad) ||
      (profile.fecha_nacimiento || null) !== (savedProfile.fecha_nacimiento || null) ||
      profile.sexo !== savedProfile.sexo ||
      weight !== optionalNumber(savedProfile.peso) ||
      height !== optionalNumber(savedProfile.altura) ||
      activityLevel !== optionalNumber(savedProfile.nivel_actividad) ||
      profile.objetivo !== savedProfile.objetivo;

    if (weight === null || height === null) {
      setError("El peso y la altura son obligatorios.");
      return;
    }

    const payload = {
      email: profile.email.trim().toLowerCase(),
      nombre: profile.nombre.trim(),
      fecha_nacimiento: profile.fecha_nacimiento || null,
      sexo: profile.sexo,
      edad: optionalNumber(profile.edad),
      peso: weight,
      altura: height,
      peso_objetivo_kg: targetWeight,
      nivel_actividad: activityLevel,
      objetivo: profile.objetivo,
      tipo_dieta: profile.tipo_dieta.trim() || null,
      intolerancias: currentIntolerances,
      avatar: profile.avatar || "initials",
      profile_image: profile.profile_image || null,
    };

    if (profile.calorias_objetivo !== "" && (caloriesEdited || !shouldRecalculateCalories)) {
      payload.calorias_objetivo = targetCalories;
    }

    if (passwordData.password) payload.password = passwordData.password;

    try {
      setSaving(true);
      const updatedUser = await updateUser(userId, payload);
      let freshUser = updatedUser;

      try {
        freshUser = await fetchUserById(userId);
      } catch {
        freshUser = updatedUser;
      }

      const currentUser = { ...updatedUser, ...freshUser };
      persistCurrentUser(currentUser);
      const nextProfile = createProfileFromUser(currentUser);
      setProfile(nextProfile);
      setSavedProfile(nextProfile);
      setIntolerancesText(nextProfile.intolerancias.join(", "));
      setCaloriesEdited(false);
      setPasswordData({ password: "", confirmPassword: "" });
      setSuccess("Perfil actualizado correctamente.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!userId) {
      setError("No hay usuario activo para eliminar la cuenta.");
      return;
    }

    if (!deletePassword) {
      setError("Introduce tu contraseña para eliminar la cuenta.");
      return;
    }

    try {
      setDeletingAccount(true);
      await deleteUserAccount(userId, deletePassword);
      clearStoredCurrentUser();
      window.dispatchEvent(new Event("bf:user-updated"));
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingAccount(false);
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
        "Compara tu peso con tu altura para orientar si estás en un rango bajo, normal o alto. Es una guía general: no distingue músculo, grasa ni otros detalles personales.",
    },
    {
      key: "tmb",
      label: "TMB",
      value: `${nutritionData.bmr} kcal`,
      detail: "Reposo diario",
      explanation:
        "Es la energía que tu cuerpo gastaría en reposo para funciones básicas como respirar, mantener la temperatura y que los órganos trabajen.",
    },
    {
      key: "tdee",
      label: "TDEE",
      value: `${nutritionData.tdee} kcal`,
      detail: nutritionData.activity.label,
      explanation:
        "Es tu gasto total diario: suma lo que gastas en reposo y lo que gastas por moverte o entrenar. Ayuda a estimar las calorías para mantener tu peso.",
    },
    {
      key: "targetCalories",
      label: "Objetivo calórico",
      value: `${nutritionData.targetCalories} kcal`,
      detail: objectiveLabels[nutritionData.objective],
      explanation:
        "Son las calorías diarias recomendadas según tu meta: menos para perder peso, parecidas para mantener o algo más para ganar músculo.",
    },
    {
      key: "water",
      label: "Agua diaria",
      value: `${nutritionData.waterLiters.toFixed(1)} L`,
      detail: "35 ml por kg",
      explanation:
        "Es una estimación de agua al día basada en tu peso. Puede subir si hace calor, entrenas mucho o sudas más de lo habitual.",
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
    <div className="page profile-area-page profile-page">
      <div className="profile-dashboard-layout">
        <section className="profile-main-column">
          <div className="page-header">
            <h2>{isEditPage ? "Editar perfil" : "Mi perfil"}</h2>
            <p>
              {isEditPage
                ? "Actualiza tus datos personales, nutricionales y de seguridad."
                : "Resumen de tus datos, cálculos nutricionales y progreso."}
            </p>
          </div>

          {error ? <p className="error-text">{error}</p> : null}
          {success ? <p className="success-text">{success}</p> : null}

          {!isEditPage ? (
          <section className="profile-nutrition-panel profile-overview-panel">
            <header className="nutrition-profile-header">
              <UserAvatar
                avatar={profile.avatar}
                name={profile.nombre}
                className="nutrition-avatar"
                ariaLabel={`Avatar de ${profile.nombre || "usuario"}`}
              />

              <div className="nutrition-profile-main">
                <h3>{profile.nombre || "Usuario"}</h3>
                <p>
                  {nutritionData.age} años - {profile.sexo === "hombre" ? "Hombre" : "Mujer"}
                </p>
              </div>

              <div className="nutrition-badges">
                <span>{objectiveLabels[nutritionData.objective]}</span>
                <span>{profile.tipo_dieta || "General"}</span>
              </div>
            </header>

            <section className="nutrition-block">
              <h3>Datos actuales</h3>
              <div className="profile-summary-list profile-overview-list">
                <div>
                  <span>Correo</span>
                  <strong>{profile.email || "Sin datos"}</strong>
                </div>
                <div>
                  <span>Edad</span>
                  <strong>{profile.edad || "Sin datos"}</strong>
                </div>
                <div>
                  <span>Peso</span>
                  <strong>{Math.round(nutritionData.weight)} kg</strong>
                </div>
                <div>
                  <span>Altura</span>
                  <strong>{Math.round(nutritionData.height)} cm</strong>
                </div>
                <div>
                  <span>Peso objetivo</span>
                  <strong>{Math.round(nutritionData.targetWeight)} kg</strong>
                </div>
                <div>
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
                {nutritionData.macros.map((macro) => `${macro.label} ${macro.percent}%`).join(" - ")} - Total{" "}
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
          </section>
          ) : (
      <section className="profile-data-panel profile-edit-side-panel profile-edit-page-panel">
              <form onSubmit={handleSubmit} className="profile-side-form" noValidate>
                <section className="profile-form-section profile-avatar-form-section">
                  <div className="profile-section-title">
                    <h3>Foto de perfil</h3>
                  </div>

                  <div className="profile-avatar-editor">
                    <UserAvatar
                      avatar={profile.avatar}
                      name={profile.nombre}
                      className="profile-avatar-preview"
                      ariaLabel="Vista previa de la foto de perfil"
                    />

                    <div className="profile-avatar-editor-copy">
                      <strong>Elige cómo quieres aparecer</strong>
                      <p>
                        Usa uno de los avatares de BodyFuel o sube una foto desde tu dispositivo.
                      </p>
                      <div className="profile-avatar-actions">
                        <button
                          type="button"
                          className={`secondary-action-button ${
                            profile.avatar.startsWith("data:image/") ? "selected" : ""
                          }`}
                          onClick={handleUseImage}
                          aria-pressed={profile.avatar.startsWith("data:image/")}
                        >
                          Utilizar imagen
                        </button>
                        {profile.profile_image ? (
                          <button
                            type="button"
                            className="text-action-button"
                            onClick={() => avatarFileInputRef.current?.click()}
                          >
                            Cambiar imagen
                          </button>
                        ) : null}
                        <input
                          ref={avatarFileInputRef}
                          className="profile-avatar-file-input"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleAvatarFileChange}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="profile-avatar-options" aria-label="Avatares disponibles">
                    {PROFILE_AVATARS.map((avatar) => {
                      const value = `preset:${avatar.id}`;
                      const isSelected = profile.avatar === value;

                      return (
                        <button
                          key={avatar.id}
                          type="button"
                          className={`profile-avatar-option ${isSelected ? "selected" : ""}`}
                          onClick={() => handleAvatarSelect(avatar.id)}
                          aria-pressed={isSelected}
                          aria-label={`Elegir avatar ${avatar.label}`}
                        >
                          <UserAvatar
                            avatar={value}
                            name={profile.nombre}
                            className="profile-avatar-option-image"
                          />
                          <span>{avatar.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="profile-avatar-save-row">
                    <button
                      type="button"
                      className="profile-save-button"
                      onClick={handleAvatarSave}
                      disabled={avatarSaving}
                    >
                      {avatarSaving ? "Guardando foto..." : "Guardar foto de perfil"}
                    </button>
                    {avatarError || avatarSuccess ? (
                      <p className={avatarError ? "error-text" : "success-text"}>
                        {avatarError || avatarSuccess}
                      </p>
                    ) : null}
                  </div>
                </section>

                <section className="profile-form-section">
                  <div className="profile-section-title">
                    <h3>Datos personales</h3>
                  </div>

                  <div className="profile-form-grid">
                    <label className="field-group">
                      <span>Correo</span>
                      <input
                        name="email"
                        type="email"
                        value={profile.email}
                        onChange={handleProfileChange}
                        placeholder="correo@dominio.com"
                      />
                    </label>

                    <label className="field-group">
                      <span>Nombre</span>
                      <input
                        name="nombre"
                        type="text"
                        value={profile.nombre}
                        onChange={handleProfileChange}
                        placeholder="Tu nombre"
                      />
                    </label>

                    <label className="field-group">
                      <span>Fecha de nacimiento</span>
                      <input
                        name="fecha_nacimiento"
                        type="date"
                        value={profile.fecha_nacimiento}
                        onChange={handleProfileChange}
                      />
                    </label>

                    <label className="field-group">
                      <span>Edad</span>
                      <input
                        name="edad"
                        type="number"
                        min="0"
                        value={profile.edad}
                        onChange={handleProfileChange}
                        placeholder="Ej. 28"
                      />
                    </label>

                    <label className="field-group">
                      <span>Género</span>
                      <select name="sexo" value={profile.sexo} onChange={handleProfileChange}>
                        <option value="mujer">Mujer</option>
                        <option value="hombre">Hombre</option>
                      </select>
                    </label>
                  </div>
                </section>

                <section className="profile-form-section">
                  <div className="profile-section-title">
                    <h3>Nutrición</h3>
                  </div>

                  <div className="profile-form-grid">
                    <label className="field-group">
                      <span>Peso actual (kg)</span>
                      <input
                        name="peso"
                        type="number"
                        min="0"
                        step="0.1"
                        value={profile.peso}
                        onChange={handleProfileChange}
                        placeholder="Ej. 72.5"
                      />
                    </label>

                    <label className="field-group">
                      <span>Peso objetivo (kg)</span>
                      <input
                        name="peso_objetivo_kg"
                        type="number"
                        min="0"
                        step="0.1"
                        value={profile.peso_objetivo_kg}
                        onChange={handleProfileChange}
                        placeholder="Ej. 68"
                      />
                    </label>

                    <label className="field-group">
                      <span>Altura (cm)</span>
                      <input
                        name="altura"
                        type="number"
                        min="0"
                        step="0.1"
                        value={profile.altura}
                        onChange={handleProfileChange}
                        placeholder="Ej. 175"
                      />
                    </label>

                    <label className="field-group">
                      <span>Nivel de actividad</span>
                      <select name="nivel_actividad" value={profile.nivel_actividad} onChange={handleProfileChange}>
                        {activityOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field-group">
                      <span>Objetivo</span>
                      <select name="objetivo" value={profile.objetivo} onChange={handleProfileChange}>
                        <option value="perder">Perder peso</option>
                        <option value="mantener">Mantener</option>
                        <option value="ganar">Ganar músculo</option>
                      </select>
                    </label>

                    <label className="field-group">
                      <span>Tipo de dieta</span>
                      <input
                        name="tipo_dieta"
                        type="text"
                        value={profile.tipo_dieta}
                        onChange={handleProfileChange}
                        placeholder="Ej. Mediterránea"
                      />
                    </label>

                    <label className="field-group field-group-full">
                      <span>Intolerancias</span>
                      <input
                        type="text"
                        value={intolerancesText}
                        onChange={(event) => setIntolerancesText(event.target.value)}
                        placeholder="Separadas por comas"
                      />
                    </label>

                    <label className="field-group">
                      <span>Calorías objetivo</span>
                      <input
                        name="calorias_objetivo"
                        type="number"
                        min="0"
                        value={profile.calorias_objetivo}
                        onChange={handleProfileChange}
                        placeholder="Ej. 2200"
                      />
                    </label>
                  </div>
                </section>

                <section className="profile-form-section">
                  <div className="profile-section-title">
                    <h3>Seguridad</h3>
                  </div>

                  <div className="profile-form-grid">
                    <label className="field-group">
                      <span>Nueva contraseña</span>
                      <input
                        name="password"
                        type="password"
                        value={passwordData.password}
                        onChange={handlePasswordChange}
                        placeholder="Opcional"
                      />
                    </label>

                    <label className="field-group">
                      <span>Confirmar contraseña</span>
                      <input
                        name="confirmPassword"
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        placeholder="Opcional"
                      />
                    </label>
                  </div>
                </section>

                <button type="submit" className="profile-save-button" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>

                {error || success ? (
                  <p className={error ? "error-text profile-form-feedback" : "success-text profile-form-feedback"}>
                    {error || success}
                  </p>
                ) : null}
              </form>

              <section className="profile-delete-section">
                <div className="profile-section-title">
                  <h3>Eliminar cuenta</h3>
                  <p>Esta acción borrará tu cuenta y cerrará la sesión.</p>
                </div>

                <form onSubmit={handleDeleteAccount} className="profile-delete-form">
                  <label className="field-group">
                    <span>Contraseña actual</span>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(event) => setDeletePassword(event.target.value)}
                      placeholder="Escribe tu contraseña"
                    />
                  </label>

                  <button type="submit" className="profile-delete-button" disabled={deletingAccount}>
                    {deletingAccount ? "Eliminando..." : "Eliminar cuenta"}
                  </button>
                </form>
              </section>
            </section>
          )}
        </section>

        <aside className="profile-side-column">
          <ProfileMenu />
        </aside>
      </div>

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
                x
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
    </div>
  );
}

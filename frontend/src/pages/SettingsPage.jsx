import { useState } from "react";
import ProfileMenu from "../components/ProfileMenu";
import { getStoredAppSettings, saveAppSettings } from "../utils/appSettings";

export default function SettingsPage() {
  const [settings, setSettings] = useState(() => getStoredAppSettings());
  const [saved, setSaved] = useState(false);

  function updateSettings(nextPartialSettings) {
    const nextSettings = saveAppSettings({
      ...settings,
      ...nextPartialSettings,
    });

    setSettings(nextSettings);
    setSaved(true);
  }

  function handleCheckboxChange(event) {
    const { name, checked } = event.target;
    updateSettings({ [name]: checked });
  }

  function handleSelectChange(event) {
    const { name, value } = event.target;
    updateSettings({ [name]: value });
  }

  return (
    <div className="page profile-area-page settings-page">
      <div className="profile-dashboard-layout">
        <section className="profile-main-column">
          <div className="page-header">
            <h2>Ajustes de la aplicación</h2>
            <p>Configura la experiencia de BodyFuel.</p>
          </div>

          {saved ? <p className="success-text">Ajustes guardados.</p> : null}

          <section className="settings-panel">
            <div className="settings-section-head">
              <h3>Apariencia</h3>
            </div>

            <div className="settings-theme-toggle" role="group" aria-label="Tema de la aplicación">
              <button
                type="button"
                className={settings.theme === "dark" ? "active" : ""}
                onClick={() => updateSettings({ theme: "dark" })}
              >
                Oscuro
              </button>
              <button
                type="button"
                className={settings.theme === "light" ? "active" : ""}
                onClick={() => updateSettings({ theme: "light" })}
              >
                Claro
              </button>
            </div>
          </section>

          <section className="settings-panel">
            <div className="settings-section-head">
              <h3>Preferencias</h3>
            </div>

            <div className="settings-form-grid">
              <label className="field-group">
                <span>Unidades</span>
                <select name="units" value={settings.units} onChange={handleSelectChange}>
                  <option value="metric">Métricas</option>
                  <option value="imperial">Imperiales</option>
                </select>
              </label>

              <label className="settings-switch">
                <input
                  type="checkbox"
                  name="weeklyReminders"
                  checked={settings.weeklyReminders}
                  onChange={handleCheckboxChange}
                />
                <span>Recordatorios semanales</span>
              </label>

              <label className="settings-switch">
                <input
                  type="checkbox"
                  name="assistantPersonalization"
                  checked={settings.assistantPersonalization}
                  onChange={handleCheckboxChange}
                />
                <span>Asistente personalizado</span>
              </label>
            </div>
          </section>
        </section>

        <ProfileMenu />
      </div>
    </div>
  );
}

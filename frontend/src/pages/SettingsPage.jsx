import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!saved) return undefined;

    const timerId = window.setTimeout(() => setSaved(false), 1800);
    return () => window.clearTimeout(timerId);
  }, [saved, settings]);

  function handleCheckboxChange(event) {
    const { name, checked } = event.target;
    updateSettings({ [name]: checked });
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
              <h3>Navegación</h3>
              <p>Decide si quieres ver los mensajes pendientes en el menú.</p>
            </div>

            <div className="settings-form-grid">
              <label className="settings-switch">
                <input
                  type="checkbox"
                  name="chatBadges"
                  checked={settings.chatBadges}
                  onChange={handleCheckboxChange}
                />
                <span className="settings-switch-copy">
                  <strong>Mensajes sin leer</strong>
                  <small>Muestra el número de mensajes sin leer en la navegación.</small>
                </span>
              </label>
            </div>
          </section>
        </section>

        <ProfileMenu />
      </div>
    </div>
  );
}

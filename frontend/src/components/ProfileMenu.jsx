import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

const profileMenuItems = [
  {
    to: "/profile/edit",
    activePaths: ["/profile/edit"],
    label: "Editar perfil",
    description: "Datos personales y nutricion",
  },
  {
    to: "/settings",
    activePaths: ["/settings", "/profile/settings"],
    label: "Ajustes de la aplicacion",
    description: "Tema y preferencias",
  },
  {
    to: "/friends",
    activePaths: ["/friends", "/profile/friends"],
    label: "Amigos",
    description: "Invitaciones y contactos",
  },
];

export default function ProfileMenu() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(true);

  return (
    <aside className="profile-menu-panel">
      <button
        type="button"
        className="profile-menu-trigger"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <span>Menu de perfil</span>
        <span className={`profile-menu-chevron ${isOpen ? "open" : ""}`} aria-hidden="true">
          v
        </span>
      </button>

      {isOpen ? (
        <nav className="profile-menu-list" aria-label="Secciones de perfil">
          {profileMenuItems.map((item) => {
            const isActive = item.activePaths.includes(location.pathname);

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`profile-menu-link ${isActive ? "active" : ""}`}
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}
    </aside>
  );
}

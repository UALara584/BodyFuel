import { PROFILE_AVATARS } from "../utils/avatar";

function getInitials(name) {
  return (name || "Usuario")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function getPreset(avatar) {
  if (!avatar?.startsWith("preset:")) return null;
  const presetId = avatar.slice("preset:".length);
  return PROFILE_AVATARS.find((preset) => preset.id === presetId) || null;
}

function PresetAvatarArt({ preset }) {
  const hairDetails = {
    1: <path d="M19 26c1-11 7-16 14-16 9 0 14 7 13 18-5-5-18-7-27-2Z" fill={preset.hair} />,
    2: (
      <>
        <circle cx="42" cy="13" r="7" fill={preset.hair} />
        <path d="M18 28c0-12 6-18 15-18 8 0 14 7 13 19-8-5-18-6-28-1Z" fill={preset.hair} />
      </>
    ),
    3: (
      <>
        <path d="M18 24c3-10 8-14 16-14 8 0 13 5 14 14Z" fill={preset.hair} />
        <path d="M16 23h34v5H16Z" fill={preset.shirt} />
      </>
    ),
    4: (
      <>
        <path d="M17 27c2-12 8-17 16-17 9 0 14 6 14 18-8-6-21-7-30-1Z" fill={preset.hair} />
        <g fill="none" stroke={preset.hair} strokeWidth="2">
          <circle cx="27" cy="28" r="4" />
          <circle cx="39" cy="28" r="4" />
          <path d="M31 28h4" />
        </g>
      </>
    ),
    5: (
      <>
        {[20, 27, 34, 41, 46].map((cx, index) => (
          <circle key={cx} cx={cx} cy={index % 2 ? 14 : 18} r="7" fill={preset.hair} />
        ))}
      </>
    ),
    6: (
      <>
        <path d="M18 26c1-10 7-16 15-16 9 0 14 6 14 17-9-4-19-5-29-1Z" fill={preset.hair} />
        <path d="M19 22c8-4 18-4 27 0" fill="none" stroke={preset.shirt} strokeWidth="4" />
      </>
    ),
    7: <path d="m18 25 4-12 6 4 5-8 5 8 7-4 3 13c-9-5-21-6-30-1Z" fill={preset.hair} />,
    8: (
      <>
        <path d="M18 24c2-10 7-14 15-14 8 0 13 5 15 15-9-5-21-6-30-1Z" fill={preset.hair} />
        <path d="M18 25c-2 8-1 15 3 21M48 25c2 8 1 15-3 21" fill="none" stroke={preset.hair} strokeWidth="5" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M10 64c2-15 10-22 23-22 12 0 20 7 22 22Z" fill={preset.shirt} />
      <circle cx="33" cy="28" r="15" fill={preset.skin} />
      {hairDetails[preset.variant]}
      <circle cx="27.5" cy="29" r="1.2" fill={preset.hair} />
      <circle cx="38.5" cy="29" r="1.2" fill={preset.hair} />
      <path d="M29 36c2.5 2 5.5 2 8 0" fill="none" stroke={preset.hair} strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

export function UserAvatar({ avatar, name, className = "", ariaLabel }) {
  const preset = getPreset(avatar);
  const isUploadedImage = typeof avatar === "string" && avatar.startsWith("data:image/");
  const accessibilityProps = ariaLabel
    ? { role: "img", "aria-label": ariaLabel }
    : { "aria-hidden": true };

  if (isUploadedImage) {
    return (
      <span className={`user-avatar user-avatar-image ${className}`.trim()} {...accessibilityProps}>
        <img src={avatar} alt="" />
      </span>
    );
  }

  if (preset) {
    return (
      <span
        className={`user-avatar user-avatar-preset ${className}`.trim()}
        style={{ background: preset.background }}
        {...accessibilityProps}
      >
        <PresetAvatarArt preset={preset} />
      </span>
    );
  }

  return (
    <span className={`user-avatar user-avatar-initials ${className}`.trim()} {...accessibilityProps}>
      {getInitials(name)}
    </span>
  );
}

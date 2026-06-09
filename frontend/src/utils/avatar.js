export const PROFILE_AVATARS = [
  {
    id: "mint",
    label: "Menta",
    background: "linear-gradient(145deg, #d7fff0, #75dfb2)",
    hair: "#174b3b",
    skin: "#f2bd94",
    shirt: "#087f5b",
    variant: 1,
  },
  {
    id: "sunset",
    label: "Atardecer",
    background: "linear-gradient(145deg, #ffe7ca, #ff9f7a)",
    hair: "#5d2f2a",
    skin: "#d99062",
    shirt: "#bd4b5d",
    variant: 2,
  },
  {
    id: "ocean",
    label: "Océano",
    background: "linear-gradient(145deg, #d8f3ff, #74b9ef)",
    hair: "#183c61",
    skin: "#f0c7a6",
    shirt: "#2667a8",
    variant: 3,
  },
  {
    id: "lavender",
    label: "Lavanda",
    background: "linear-gradient(145deg, #f0e5ff, #b79cf2)",
    hair: "#3e315c",
    skin: "#a96545",
    shirt: "#7356b6",
    variant: 4,
  },
  {
    id: "lemon",
    label: "Lima",
    background: "linear-gradient(145deg, #f4ffd2, #b9db5a)",
    hair: "#4b421e",
    skin: "#e8ad7d",
    shirt: "#6f8f25",
    variant: 5,
  },
  {
    id: "rose",
    label: "Rosa",
    background: "linear-gradient(145deg, #ffe0eb, #ef89ae)",
    hair: "#672d43",
    skin: "#f1c5a4",
    shirt: "#a93667",
    variant: 6,
  },
  {
    id: "ember",
    label: "Fuego",
    background: "linear-gradient(145deg, #ffe1cb, #ef7958)",
    hair: "#442a24",
    skin: "#8f553a",
    shirt: "#9d352b",
    variant: 7,
  },
  {
    id: "night",
    label: "Noche",
    background: "linear-gradient(145deg, #dfe5ff, #7785cf)",
    hair: "#202544",
    skin: "#d9a57f",
    shirt: "#39458c",
    variant: 8,
  },
];

const MAX_SOURCE_SIZE = 8 * 1024 * 1024;
const MAX_AVATAR_LENGTH = 700_000;

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se ha podido leer la imagen."));
    image.src = source;
  });
}

function renderSquareAvatar(image, size, quality) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Tu navegador no puede procesar esta imagen.");
  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = (image.naturalWidth - sourceSize) / 2;
  const sourceY = (image.naturalHeight - sourceSize) / 2;

  canvas.width = size;
  canvas.height = size;
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
  return canvas.toDataURL("image/webp", quality);
}

export async function createAvatarFromFile(file) {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Elige una imagen JPG, PNG o WebP.");
  }

  if (file.size > MAX_SOURCE_SIZE) {
    throw new Error("La imagen no puede superar los 8 MB.");
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    let avatar = renderSquareAvatar(image, 512, 0.86);

    if (avatar.length > MAX_AVATAR_LENGTH) {
      avatar = renderSquareAvatar(image, 384, 0.76);
    }

    if (avatar.length > MAX_AVATAR_LENGTH) {
      throw new Error("La imagen es demasiado compleja. Prueba con otra foto.");
    }

    return avatar;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

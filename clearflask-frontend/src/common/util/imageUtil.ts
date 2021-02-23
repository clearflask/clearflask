import windowIso from "../windowIso";

function preloadImage(imagePath: string) {
  if (windowIso.isSsr) return;
  const img = new Image();
  img.src = imagePath;
}

export default preloadImage;
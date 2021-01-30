import windowIso from "./windowIso";

export const closeLoadingScreen = () => {
  if (windowIso.isSsr) return;
  const loadingScreen = windowIso.document.getElementById("loadingScreen");
  const mainScreen = windowIso.document.getElementById("mainScreen");
  if (loadingScreen) loadingScreen.className += " hideScreen";
  if (mainScreen) mainScreen.className += " showScreen";
};

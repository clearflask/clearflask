
export const closeLoadingScreen = () => {
  const loadingScreen = document.getElementById("loadingScreen");
  const mainScreen = document.getElementById("mainScreen");
  if (loadingScreen) loadingScreen.className += " hideScreen";
  if (mainScreen) mainScreen.className += " showScreen";
};

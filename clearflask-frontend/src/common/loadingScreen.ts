// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import windowIso from "./windowIso";

var isClosed = false;
export const closeLoadingScreen = () => {
  if (windowIso.isSsr || isClosed) return;
  const loadingScreen = windowIso.document.getElementById("loadingScreen");
  const mainScreen = windowIso.document.getElementById("mainScreen");
  if (loadingScreen) loadingScreen.className += " hideScreen";
  if (mainScreen) mainScreen.className += " showScreen";
  isClosed = true;
};

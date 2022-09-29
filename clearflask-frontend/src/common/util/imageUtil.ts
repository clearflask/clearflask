// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import windowIso from "../windowIso";
import { base64ToBlob } from "./arrayUtil";

export function preloadImage(imagePath: string) {
  if (windowIso.isSsr) return;
  const img = new Image();
  img.src = imagePath;
}

// Assumes imageData is in format: "data:image/gif;base64,R0lGODlhPQBEAP..."
export function dataImageToBlob(imageDataUrl: string): Blob {
  var block = imageDataUrl.split(";");
  var contentType = block[0].split(":")[1];
  var realData = block[1].split(",")[1];
  var blob = base64ToBlob(realData, contentType);
  return blob;
}

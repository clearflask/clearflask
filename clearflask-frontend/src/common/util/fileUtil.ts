// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0

import windowIso from "../windowIso";

export const downloadStringFile = (filename: string, mediaType: string, data: string) => {
  downloadBlobFile(filename, new Blob([data], { type: mediaType }));
}

export const downloadBlobFile = (filename: string, data: Blob) => {
  if (windowIso.isSsr) return;
  if (windowIso.navigator['msSaveBlob']) {
    window.navigator['msSaveBlob'](data, filename);
  } else {
    const elem = windowIso.document.createElement('a');
    elem.href = windowIso.URL.createObjectURL(data);
    elem.download = filename;
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
  }
}

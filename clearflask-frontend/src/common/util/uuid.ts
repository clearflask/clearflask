// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import cryptoIso from 'isomorphic-webcrypto';

// https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
function randomUuid() {
  // Sentry showed cryptoIso is undefined for some reason in some circumstances
  if (!cryptoIso) return randomUuidViaMathRandom();

  return ([1e7] as any + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ cryptoIso.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  )
}

// https://stackoverflow.com/a/8809472
export function randomUuidViaMathRandom() {
  var d = new Date().getTime();
  //Time in microseconds since page-load or 0 if unsupported
  var d2 = ((typeof performance !== 'undefined') && performance.now && (performance.now() * 1000)) || 0;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    //random number between 0 and 16
    var r = Math.random() * 16;
    //Use timestamp until depleted
    if (d > 0) {
      r = (d + r) % 16 | 0;
      d = Math.floor(d / 16);
      //Use microseconds since page-load if supported
    } else {
      r = (d2 + r) % 16 | 0;
      d2 = Math.floor(d2 / 16);
    }
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}


export default randomUuid;
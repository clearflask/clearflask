// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import CryptoJS from 'crypto-js';

/**
 * Warning: changing this method will result in everyone's passwords to change
 */
export function saltHashPassword(password: string): string {
  var hash = CryptoJS.SHA512(password + ":salt:775DFB51571649109DEB70F423AF2B86:salt:");
  var hashStr = hash.toString(CryptoJS.enc.Base64);
  return hashStr;
}
// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
declare var __webpack_public_path__: any;
declare var __webpack_require__: any;
if (!!window['parentDomain'] && window['parentDomain'] !== 'clearflask.com') {
  __webpack_public_path__ = '/'; // eslint-disable-line @typescript-eslint/no-unused-vars
  if (!__webpack_require__) __webpack_require__ = {};
  __webpack_require__.p = '/';
}

// Initialize i18n before any components are rendered
require('./i18n-csr').getI18n();

// Load the client-side rendered entrypoint
require('./index-csr');

export { };

// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only

// As a first thing, we need to set the public path before any imports
declare var __webpack_public_path__: any;
declare var __webpack_require__: any;
if (!!window['parentDomain'] && window['parentDomain'] !== 'clearflask.com') {
  __webpack_public_path__ = '/'; // eslint-disable-line @typescript-eslint/no-unused-vars
  if (!__webpack_require__) __webpack_require__ = {};
  __webpack_require__.p = '/';
}

// Load the client-side rendered entrypoint
require('./index-csr');

export { };

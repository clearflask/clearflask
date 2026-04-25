// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
require('@babel/register')({
  extensions: ['.ts', '.js'],
  presets: [
    ['@babel/preset-env', { targets: { node: '14.15.1' } }],
    '@babel/preset-typescript',
  ],
});
require('./banlist.test');

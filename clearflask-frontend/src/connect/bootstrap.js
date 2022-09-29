// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
require('ignore-styles');
require('@babel/register')({
  ignore: [/node_modules(?!\/emoji-mart)/],
  extensions: [".es6", ".es", ".jsx", ".js", ".mjs", ".tsx", ".ts", ".mts"],
  "presets": [
    ["@babel/preset-env", {
      include: [
        '@babel/plugin-proposal-optional-chaining',
        '@babel/plugin-proposal-nullish-coalescing-operator'
      ],
      targets: {
        "node": "14.15.1"
      }
    }],
    ["@babel/preset-react", { "runtime": "automatic" }], // https://stackoverflow.com/a/64994595
    "@babel/preset-typescript"
  ],
  "plugins": [
    'transform-class-properties',
    "@loadable/babel-plugin",
    [
      "transform-media-imports",
      {
        "baseDir": "./public"
      }
    ],
  ]
});
require('./connect');

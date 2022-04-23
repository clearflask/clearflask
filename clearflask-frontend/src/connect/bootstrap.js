// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
// ClearFlask-connect is bundled using webpack for production.
// However, for testing and local development, here is a way to
// run and compile on the fly.
// Thanks to https://www.vairix.com/tech-blog/server-side-rendering-ssr-of-create-react-app-cra-app-in-2020
require('ignore-styles');
require('@babel/register')({
  ignore: [/node_modules(?!\/emoji-mart)/],
  extensions: [".es6", ".es", ".jsx", ".js", ".mjs", ".tsx", ".ts", ".mts"],
  "presets": [
    ["@babel/preset-env", {
      include: [
        '@babel/plugin-proposal-optional-chaining'
      ],
      targets: {
        "node": "14.15.1"
      }
    }],
    "@babel/preset-react",
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

// Thanks to https://www.vairix.com/tech-blog/server-side-rendering-ssr-of-create-react-app-cra-app-in-2020
require('ignore-styles');
require('@babel/register')({
  extensions: ['.js', '.ts', '.jsx', '.tsx'],
  "presets": [
    ["@babel/preset-env", {
      targets: { "node": 4 }
    }],
    "@babel/preset-react",
    "@babel/preset-typescript"
  ],
  "plugins": [
    "@babel/plugin-transform-runtime",
    "@babel/plugin-transform-modules-commonjs",
    "@babel/plugin-proposal-class-properties",
    [
      "transform-assets",
      {
        "extensions": [
          "css",
          "svg"
        ],
        "name": "static/media/[name].[hash:8].[ext]"
      }
    ]
  ]
});
require('./connect/index');

// Thanks to https://www.vairix.com/tech-blog/server-side-rendering-ssr-of-create-react-app-cra-app-in-2020
require('ignore-styles');
require('@babel/register')({
  ignore: [/node_modules(?!\/emoji-mart)/],
  extensions: [".es6", ".es", ".jsx", ".js", ".mjs", ".tsx", ".ts", ".mts"],
  "presets": [
    ["@babel/preset-env", {
      targets: {
        "node": "14.15.1"
      }
    }],
    "@babel/preset-react",
    "@babel/preset-typescript"
  ],
  "plugins": [
    "@loadable/babel-plugin",
    "babel-plugin-transform-media-imports",
  ]
});
require('./connect');

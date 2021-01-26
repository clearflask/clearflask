// Thanks to https://www.vairix.com/tech-blog/server-side-rendering-ssr-of-create-react-app-cra-app-in-2020
require('ignore-styles');
require('@babel/register')({
  // ignore: [], // Include node_modules
  ignore: [/node_modules(?!\/emoji-mart)/],
  // include: [
  //   "src",
  //   "node_modules/emoji-mart"
  // ],
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
    // "@babel/plugin-transform-runtime",
    // ["@babel/plugin-transform-modules-commonjs", {loose: true}],
    // [
    //   "transform-assets",
    //   {
    //     "extensions": [
    //       "css",
    //       "svg"
    //     ],
    //     "name": "static/media/[name].[hash:8].[ext]"
    //   }
    // ],
    // From https://github.com/facebook/react/blob/master/babel.config.js
    // '@babel/plugin-syntax-jsx',
    // '@babel/plugin-transform-react-jsx',
    // '@babel/plugin-transform-flow-strip-types',
    // ['@babel/plugin-proposal-class-properties', {loose: true}],
    // 'syntax-trailing-function-commas',
    // [
    //   '@babel/plugin-proposal-object-rest-spread',
    //   {loose: true, useBuiltIns: true},
    // ],
    // ['@babel/plugin-transform-template-literals', {loose: true}],
    // '@babel/plugin-transform-literals',
    // '@babel/plugin-transform-arrow-functions',
    // '@babel/plugin-transform-block-scoped-functions',
    // '@babel/plugin-transform-object-super',
    // '@babel/plugin-transform-shorthand-properties',
    // '@babel/plugin-transform-computed-properties',
    // '@babel/plugin-transform-for-of',
    // ['@babel/plugin-transform-spread', {loose: true, useBuiltIns: true}],
    // '@babel/plugin-transform-parameters',
    // ['@babel/plugin-transform-destructuring', {loose: true, useBuiltIns: true}],
    // ['@babel/plugin-transform-block-scoping', {throwIfClosureRequired: false}]
  ]
});
require('./index');

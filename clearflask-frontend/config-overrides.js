// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only

const { useBabelRc, override, removeModuleScopePlugin } = require('customize-cra');
const LoadablePlugin = require('@loadable/webpack-plugin');

module.exports = override(
  useBabelRc(),
  removeModuleScopePlugin(),
  (config, env) => {
    config.plugins.push(new LoadablePlugin());

    // https://github.com/webpack/webpack/issues/6876#issuecomment-376417847
    config.optimization.namedChunks = false;

    // https://medium.com/hackernoon/the-100-correct-way-to-split-your-chunks-with-webpack-f8a9df5b7758
    // config.optimization.splitChunks = {
    //   ...config.optimization.splitChunks,
    //   chunks: 'all',
    //   maxInitialRequests: Infinity,
    //   minSize: 0,
    //   cacheGroups: {
    //     vendor: {
    //       test: /[\\/]node_modules[\\/]/,
    //       name(module) {
    //         // get the name. E.g. node_modules/packageName/not/this/part.js
    //         // or node_modules/packageName
    //         const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];

    //         // npm package names are URL-safe, but some servers don't like @ symbols
    //         return `npm.${packageName.replace('@', '')}`;
    //       },
    //     },
    //   },
    // };

    return config;
  }
);

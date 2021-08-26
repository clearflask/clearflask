// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const PermissionsOutputPlugin = require('webpack-permissions-plugin');

module.exports = {
  entry: path.resolve(__dirname, 'src', 'connect', 'connect.ts'),
  output: {
    path: path.resolve(__dirname, 'target', 'dist'),
    publicPath: '/',
  },
  devtool: 'source-map', // Source maps for stacktraces
  resolve: {
    extensions: ['.es6', '.es', '.jsx', '.js', '.mjs', '.tsx', '.ts', '.mts'],
  },
  target: 'node',
  node: {
    __dirname: false,
    __filename: false,
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        exclude: 'public/static',
      }),
    ],
  },
  plugins: [
    // Since Greenlock performs a runtime import of these modules,
    // We need to tell webpack where to find them.
    // However, if we are running without webpack, the relative paths
    // are resolvable by Greenlock. Did I mention Greenlock is a pain in the ass?
    new webpack.ContextReplacementPlugin(
      /@root[\/\\]greenlock/,
      path.resolve(__dirname, 'src'),
      {
        './src/connect/greenlock/greenlock-manager-clearflask.js': './connect/greenlock/greenlock-manager-clearflask.js',
        '../../../src/connect/greenlock/greenlock-store-clearflask.js': './connect/greenlock/greenlock-store-clearflask.js',
        '../../../src/connect/greenlock/greenlock-store-selfsigned.js': './connect/greenlock/greenlock-store-selfsigned.js',
        '../../../src/connect/greenlock/greenlock-challenge-http-clearflask.js': './connect/greenlock/greenlock-challenge-http-clearflask.js',
        '../../../src/connect/greenlock/greenlock-challenge-dns-clearflask.js': './connect/greenlock/greenlock-challenge-dns-clearflask.js',
      }
    ),
    new CopyPlugin({
      patterns: [
        { from: 'target/public', to: 'public' },
        { from: 'start.sh', to: '.' },
      ],
    }),
    new PermissionsOutputPlugin({
      buildFiles: [
        { fileMode: '755', path: path.resolve(__dirname, 'target', 'dist', 'start.sh') },
      ]
    }),
  ],
  module: {
    rules: [
      {
        test: /\.(css)$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.mjs$/,
        include: /node_modules/,
        type: 'javascript/auto'
      },
      {
        test: /\.(es6|es|jsx|js|mjs|tsx|ts|mts)$/,
        include: path.resolve(__dirname, 'src'),
        exclude: /node_modules(?!\/emoji-mart)/,
        use: {
          loader: 'babel-loader',
          options: {
            configFile: false,
            presets: [
              ['@babel/preset-env', {
                include: [
                  '@babel/plugin-proposal-optional-chaining'
                ],
                targets: {
                  'node': '14.15.1'
                }
              }],
              '@babel/preset-react',
              '@babel/preset-typescript'
            ],
            plugins: [
              'transform-class-properties',
              // If changed also change in .babelrc
              '@loadable/babel-plugin',
              [
                'transform-media-imports',
                {
                  'baseDir': './public'
                }
              ],
            ]
          }
        }
      }
    ]
  },
};

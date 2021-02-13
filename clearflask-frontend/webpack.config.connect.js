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
      new TerserPlugin(),
    ],
  },
  plugins: [
    new webpack.ContextReplacementPlugin(
      /@root[\/\\]greenlock/,
      path.resolve(__dirname, 'src'),
      {
        '/WEBPACK_REPLACE_ME_PLEASE/greenlock-manager-clearflask.js': './connect/greenlock/greenlock-manager-clearflask.js',
        '/WEBPACK_REPLACE_ME_PLEASE/greenlock-store-clearflask.js': './connect/greenlock/greenlock-store-clearflask.js',
        '/WEBPACK_REPLACE_ME_PLEASE/greenlock-challenge-http-clearflask.js': './connect/greenlock/greenlock-challenge-http-clearflask.js',
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

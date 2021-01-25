import React from 'react';
import ReactDOM from 'react-dom';
import './common.css';
import { detectEnv, Environment } from './common/util/detectEnv';
import Main from './Main';

if (detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
  import('./mocker'/* webpackChunkName: "mocker" */)
    .then(mocker => mocker.mock())
    .then(() => ReactDOM.hydrate(<Main />, document.getElementById('mainScreen')));
} else {
  ReactDOM.hydrate(<Main />, document.getElementById('mainScreen'));
}

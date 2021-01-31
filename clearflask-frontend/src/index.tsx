import { loadableReady } from '@loadable/component';
import React from 'react';
import ReactDOM from 'react-dom';
import './common.css';
import { detectEnv, Environment } from './common/util/detectEnv';
import Main from './Main';

console.log(ReactDOM);

loadableReady(() => {
  const rootEl = document.getElementById('mainScreen')!;
  if (detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
    import(/* webpackChunkName: "mocker" */'./mocker')
      .then(mocker => mocker.mock())
      .then(() => ReactDOM.hydrate(<Main />, rootEl));
  } else {
    ReactDOM.hydrate(<Main />, rootEl);
  }
})

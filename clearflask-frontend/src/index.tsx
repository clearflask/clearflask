import { loadableReady } from '@loadable/component';
import React from 'react';
import ReactDOM from 'react-dom';
import { detectEnv, Environment } from './common/util/detectEnv';
import Main from './Main';

if (detectEnv() !== Environment.DEVELOPMENT_FRONTEND) {
  loadableReady(() => {
    ReactDOM.hydrate(<Main />, document.getElementById('mainScreen'));
  })
} else {
  ReactDOM.render(<Main />, document.getElementById('mainScreen'));
}

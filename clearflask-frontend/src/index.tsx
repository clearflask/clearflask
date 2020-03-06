import React from 'react';
import ReactDOM from 'react-dom';
import './common.css';
import { detectEnv, Environment } from './common/util/detectEnv';
import Main from './Main';
import { mock } from './mocker';

if (detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
  mock().then(() => ReactDOM.render(<Main />, document.getElementById('mainScreen')));
} else {
  ReactDOM.render(<Main />, document.getElementById('mainScreen'));
  // TODO switch to createRoot once it comes out:
  // ReactDOM['unstable_createRoot'](document.getElementById('mainScreen')).render(<Main />);
}

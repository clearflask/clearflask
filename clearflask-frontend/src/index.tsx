import { loadableReady } from '@loadable/component';
import React from 'react';
import ReactDOM from 'react-dom';
import Main from './Main';

loadableReady(() => {
  const rootEl = document.getElementById('mainScreen')!;
  ReactDOM.hydrate(<Main />, rootEl);
})

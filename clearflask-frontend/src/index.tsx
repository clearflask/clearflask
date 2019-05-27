import React from 'react';
import ReactDOM from 'react-dom';
import './common.css';
import Main from './Main';

ReactDOM.render(<Main />, document.getElementById('mainScreen'));
// TODO switch to createRoot once it comes out:
// ReactDOM['unstable_createRoot'](document.getElementById('mainScreen')).render(<Main />);

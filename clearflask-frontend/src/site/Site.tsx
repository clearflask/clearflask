import React, { Component } from 'react';
import { match } from 'react-router';
import { History, Location } from 'history';
import LandingPage from './LandingPage';

interface Props {
  // Router matching
  match:match;
  history:History;
  location:Location;
}

export default class Site extends Component<Props> {

  render() {
    return (
      <LandingPage />
    );
  }
}

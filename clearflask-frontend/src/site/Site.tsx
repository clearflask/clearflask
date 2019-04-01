import React, { Component } from 'react';
import { match } from 'react-router';
import { History, Location } from 'history';

interface Props {
  // Router matching
  match:match;
  history:History;
  location:Location;
}

export default class Site extends Component<Props> {

  render() {
    return (
      <div>
        <h1>
          This is suppose to be a landing page
        </h1>
      </div>
    );
  }
}

import React, { Component } from 'react';
import { Typography } from '@material-ui/core';

export default class LandingPage extends Component {

  render() {
    return (
      <div>
        {this.getTitle()}
        {this.getSubTitle()}

        
      </div>
    );
  }

  getTitle() {
    return (
      <Typography variant='h1'>
        Crowdfunded roadmap
      </Typography>
    );
  }
  getSubTitle() {
    return (
      <Typography variant='h2'>
        Customer feedback platform prioritized based on their monetary contributions
      </Typography>
    );
  }
}

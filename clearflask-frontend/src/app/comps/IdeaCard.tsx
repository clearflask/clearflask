import React, { Component } from 'react';
import { Idea } from '../../api/client';
import { Typography } from '@material-ui/core';

interface Props {
  idea?:Idea;
}

export default class IdeaCard extends Component<Props> {
  readonly styles = {
    container: {
      width: '500px',
    },
  };

  render() {
    return (
      <div style={{
        ...this.styles.container
      }}>
        <Typography variant='subtitle2'>{this.props.idea && this.props.idea.title || 'Loading...'}</Typography>
        <Typography variant='body1'>{this.props.idea && this.props.idea.description}</Typography>
      </div>
    );
  }
}

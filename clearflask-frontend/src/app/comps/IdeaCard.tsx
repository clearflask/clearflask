import React, { Component } from 'react';
import { Idea } from '../../api/client';
import { Typography } from '@material-ui/core';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';

const styles = (theme:Theme) => createStyles({
  container: {
    margin: theme.spacing.unit,
  },
});

interface Props extends WithStyles<typeof styles> {
  idea?:Idea;
}

class IdeaCard extends Component<Props> {
  render() {
    return (
      <div className={this.props.classes.container}>
        <Typography variant='subtitle2'>{this.props.idea && this.props.idea.title || 'Loading...'}</Typography>
        <Typography variant='body1'>{this.props.idea && this.props.idea.description}</Typography>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(IdeaCard);

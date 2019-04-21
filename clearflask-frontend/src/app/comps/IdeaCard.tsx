import React, { Component } from 'react';
import { Idea } from '../../api/client';
import { Typography } from '@material-ui/core';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';

const styles = (theme:Theme) => createStyles({
  container: {
    margin: theme.spacing.unit,
    display: 'flex',
  },
  content: {
  },
});

export type IdeaCardVariant = 'title'|'full';

interface Props extends WithStyles<typeof styles> {
  idea?:Idea;
  variant:IdeaCardVariant;
}

class IdeaCard extends Component<Props> {
  render() {
    var expression;
    if(this.props.variant !== 'title' && this.props.idea && this.props.idea.expressions) {
      expression = this.props.idea.expressions.map(expression => (
        <span>
          <span>{expression.display}</span>
          {expression.count > 1 && (<span>{expression.count}</span>)}
        </span>
      ))
    }

    return (
      <div className={this.props.classes.container}>
        <div className={this.props.classes.content}>
          <Typography variant='subtitle2'>{this.props.idea && this.props.idea.title || 'Loading...'}</Typography>
          {expression}
          {this.props.variant !== 'title' && (<Typography variant='body1'>{this.props.idea && this.props.idea.description}</Typography>)}
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(IdeaCard);

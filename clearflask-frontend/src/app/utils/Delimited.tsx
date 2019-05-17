import React, { Component } from 'react';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';

const styles = (theme:Theme) => createStyles({
  separator: {
    '&:before': {
      content: '"·"',
    },
    margin: theme.spacing.unit / 2,
  },
});

interface Props {
  delimiter?:React.ReactNode;
}

class Delimited extends Component<Props&WithStyles<typeof styles, true>> {

  render() {
    if(!Array.isArray(this.props.children)) {
      return this.props.children || null;
    }
    const delimiter = this.props.delimiter || (
      <div className={this.props.classes.separator} />
    );
    const result:React.ReactNode[] = [];
    for (let i = 0; i < this.props.children.length; i++) {
      const el = this.props.children[i];
      if(!el) continue;
      if(i > 0) result.push(delimiter);
      result.push(el);
    }
    return result;
  }
}

export default withStyles(styles, { withTheme: true })(Delimited);

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
    return this.props.children
      .filter(i => !!i)
      .map((val, index) => index === 0
        ? val
        : [delimiter, val]);
  }
}

export default withStyles(styles, { withTheme: true })(Delimited);

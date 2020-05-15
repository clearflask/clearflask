import { Divider } from '@material-ui/core';
import { DividerProps } from '@material-ui/core/Divider';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
  divider: {
    height: '100%',
    width: '1px',
  },
});

interface Props {
  style?: React.CSSProperties;
  className?: string;
  absolute?: boolean;
  component?: React.ReactType<DividerProps>;
  light?: boolean;
  variant?: 'fullWidth';
}

class Delimited extends Component<Props & WithStyles<typeof styles, true>> {

  render() {
    const { classes, ...dividerProps } = this.props;
    return (
      <Divider
        {...dividerProps}
        classes={{
          root: this.props.classes.divider,
        }}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(Delimited);

import React, { Component } from 'react';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { Divider } from '@material-ui/core';
import { DividerProps } from '@material-ui/core/Divider';

const styles = (theme:Theme) => createStyles({
  divider: {
    height: '100%',
    width: '1px',
  },
});

interface Props {
  className?: string;
  absolute?: boolean;
  component?: React.ReactType<DividerProps>;
  light?: boolean;
  variant?:'fullWidth';
}

class Delimited extends Component<Props&WithStyles<typeof styles, true>> {

  render() {
    return (
      <Divider
        {...this.props}
        classes={{
          root: this.props.classes.divider,
        }}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(Delimited);

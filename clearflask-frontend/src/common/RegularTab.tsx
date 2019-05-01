import React, { Component, Key } from 'react';
import { Input, IconButton, Typography, Drawer, Divider, AppBar, Hidden, Select, MenuItem, InputLabel } from '@material-ui/core';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import Tab, { TabProps } from '@material-ui/core/Tab';
import * as Client from '../api/client';

const styles = (theme:Theme) => createStyles({
  select: {
  },
});

interface Props extends TabProps, WithStyles<typeof styles, true> {
  classes; // Conflicted property
}

class RegularTab extends Component<Props> {

  render() {
    return (
      <Tab {...this.props} className={this.props.classes.select} />
    );
  }
}

export default withStyles(styles, { withTheme: true })(RegularTab);

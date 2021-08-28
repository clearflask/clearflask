// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Link as MuiLink } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import windowIso from '../common/windowIso';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    fontSize: '0.9em',
  },
  poweredBy: {
    color: theme.palette.text.secondary,
  },
  name: {
    color: theme.palette.text.primary,
  },
});
class PoweredBy extends Component<WithStyles<typeof styles, true>> {

  render() {
    return (
      <MuiLink underline='none' target="_blank" href={`https://clearflask.com/?utm_source=${windowIso.location.hostname}&utm_medium=pby_footer`}>
        <div className={this.props.classes.container}>
          <div className={this.props.classes.poweredBy}>We run on&nbsp;</div>
          <div className={this.props.classes.name}>ClearFlask</div>
        </div>
      </MuiLink>
    );
  }
}

export default withStyles(styles, { withTheme: true })(PoweredBy);

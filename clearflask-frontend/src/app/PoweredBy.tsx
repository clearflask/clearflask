// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Link as MuiLink } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
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
class PoweredBy extends Component<WithTranslation<'app'> & WithStyles<typeof styles, true>> {

  render() {
    return (
      <MuiLink underline='none' target="_blank" href={`https://clearflask.com/?utm_source=${windowIso.location.hostname}&utm_medium=pby_footer`}>
        <div className={this.props.classes.container}>
          <div className={this.props.classes.poweredBy}>{this.props.t('powered-by')}&nbsp;</div>
          <div className={this.props.classes.name}>ClearFlask</div>
        </div>
      </MuiLink>
    );
  }
}

export default withStyles(styles, { withTheme: true })(withTranslation('app', { withRef: true })(PoweredBy));

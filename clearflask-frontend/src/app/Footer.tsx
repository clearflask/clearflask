// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../api/client';
import { ReduxState } from '../api/server';
import TemplateLiquid from './comps/TemplateLiquid';
import PoweredBy from './PoweredBy';

const styles = (theme: Theme) => createStyles({
  footerSpacing: {
    width: '100%',
    maxWidth: '1024px',
    padding: theme.spacing(0, 4),
    [theme.breakpoints.down('xs')]: {
      padding: theme.spacing(0, 1),
    },
    margin: `0px auto`,
  },
  grow: {
    flexGrow: 1,
  },
  footerWrapper: {
    marginLeft: 'auto',
    marginRight: 'auto',
    width: '85%',
    maxWidth: 250,
  },
  poweredBy: {
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(4),
    display: 'flex',
    justifyContent: 'center',
  },
});
interface Props {
  customPageSlug?: string;
  isFrontPage?: boolean;
}
interface ConnectProps {
  config?: Client.Config;
}
class Footer extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {
  render() {
    var footer;
    if (this.props.config?.style.templates?.footer) {
      footer = (
        <TemplateLiquid
          template={this.props.config.style.templates.footer}
          customPageSlug={this.props.customPageSlug}
        />
      );
    }

    const hidePoweredBy = this.props.config?.style.whitelabel.poweredBy === Client.WhitelabelPoweredByEnum.Hidden
      || (this.props.config?.style.whitelabel.poweredBy === Client.WhitelabelPoweredByEnum.Minimal && !this.props.isFrontPage);

    return (
      <>
        {footer}
        {!hidePoweredBy && (
          <div className={this.props.classes.footerSpacing}>
            <div className={classNames(this.props.classes.footerWrapper, this.props.classes.poweredBy)}>
              <PoweredBy />
            </div>
          </div>
        )}
      </>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props) => {
  return {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
  };
})(withStyles(styles, { withTheme: true })(Footer));

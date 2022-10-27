// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../api/client';
import { ReduxState, Status } from '../api/server';
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
  pageSlug?: string;
}
interface ConnectProps {
  configver?: string;
  config?: Client.Config;
  page?: Client.Page;
}
class Footer extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {
  render() {
    var footerTemplate = (this.props.config?.style.templates?.pageFooters || []).find(p => p.pageId === this.props.page?.pageId)?.template
      || this.props.config?.style.templates?.footer;
    var footer;
    if (footerTemplate) {
      footer = (
        <TemplateLiquid
          template={footerTemplate}
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
  var newProps: ConnectProps = {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
    page: undefined,
  };

  if (!!ownProps.pageSlug && state.conf.status === Status.FULFILLED && !!state.conf.conf) {
    if (ownProps.pageSlug === '') {
      if (state.conf.conf.layout.pages.length > 0) {
        newProps.page = state.conf.conf.layout.pages[0];
      }
    } else {
      newProps.page = state.conf.conf.layout.pages.find(p => p.slug === ownProps.pageSlug);
    }
  }

  return newProps;
})(withStyles(styles, { withTheme: true })(Footer));

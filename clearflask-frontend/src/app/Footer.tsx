import { Divider } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
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
  footerItems: {
    width: '85%',
    display: 'flex',
    alignItems: 'center',
    margin: theme.spacing(1, 1, 4, 1),
  },
  divider: {
    margin: theme.spacing(2, 0, 0, 0),
  },
});
interface Props {
  customPageSlug?: string;
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
    } else {
      footer = (
        <div className={this.props.classes.footerSpacing}>
          <Divider className={this.props.classes.divider} />
        </div>
      );
    }

    return (
      <React.Fragment>
        {footer}
        <div className={this.props.classes.footerSpacing}>
          <div className={this.props.classes.footerItems}>
            <div className={this.props.classes.grow} />
            <PoweredBy />
          </div>
        </div>
      </React.Fragment>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props) => {
  return {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
  };
})(withStyles(styles, { withTheme: true })(Footer));

import { Divider } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { ReactLiquid } from 'react-liquid';
import { connect } from 'react-redux';
import * as Client from '../api/client';
import { ReduxState } from '../api/server';
import PoweredBy from './PoweredBy';

const styles = (theme: Theme) => createStyles({
  footerSpacing: {
    width: '100%',
    maxWidth: '1024px',
    margin: '0px auto',
    padding: theme.spacing(1),
  },
  grow: {
    flexGrow: 1,
  },
  footerItems: {
    display: 'flex',
    alignItems: 'center',
  },
});
interface ConnectProps {
  config?: Client.Config;
}
class Footer extends Component<ConnectProps & WithStyles<typeof styles, true>> {
  render() {
    var footer;
    if (this.props.config?.style.templates?.footer) {
      footer = (
        <ReactLiquid html template={this.props.config.style.templates.footer} data={{
          config: this.props.config,
        }} />
      );
    } else {
      footer = (
        <div className={this.props.classes.footerSpacing}>
          <Divider />
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

export default connect<ConnectProps, {}, {}, ReduxState>((state: ReduxState) => {
  return {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
  };
})(withStyles(styles, { withTheme: true })(Footer));

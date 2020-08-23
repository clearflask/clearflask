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
    margin: `0px auto ${theme.spacing(1)}px auto`,
  },
  grow: {
    flexGrow: 1,
  },
  footerItems: {
    display: 'flex',
    alignItems: 'center',
    margin: theme.spacing(0, 1, 1, 1),
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

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props) => {
  return {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
  };
})(withStyles(styles, { withTheme: true })(Footer));

import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import windowIso from '../common/windowIso';
import { SSO_TOKEN_PARAM_NAME } from './App';
import ErrorPage from './ErrorPage';

const styles = (theme: Theme) => createStyles({
});
interface Props {
  type: 'sso' | 'oauth';
}
class SsoSuccessDemoPage extends Component<Props & RouteComponentProps & WithStyles<typeof styles, true>> {
  render() {
    const token = new URL(windowIso.location.href).searchParams.get(SSO_TOKEN_PARAM_NAME);
    if (token) {
      // Clear token from URL for safety
      this.props.history.replace(this.props.location.pathname);
    }

    return (<ErrorPage msg={`This is a demo success page of ${this.props.type === 'sso' ? 'Single Sign-On' : 'OAuth'}`} variant='success' />);
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(SsoSuccessDemoPage));

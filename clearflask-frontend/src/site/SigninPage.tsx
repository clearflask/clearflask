import { Container, DialogActions, IconButton, InputAdornment, TextField, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Redirect, RouteComponentProps } from 'react-router';
import { Status } from '../api/server';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import { SSO_TOKEN_PARAM_NAME } from '../app/App';
import ErrorPage from '../app/ErrorPage';
import { saltHashPassword } from '../common/util/auth';
import { isProd } from '../common/util/detectEnv';
import SubmitButton from '../common/SubmitButton';

export const ADMIN_LOGIN_REDIRECT_TO = 'ADMIN_LOGIN_REDIRECT_TO';

const styles = (theme: Theme) => createStyles({
  page: {
    margin: theme.spacing(2),
    flex: '1 1 auto',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
});

interface ConnectProps {
  accountStatus?: Status;
  cfJwt?: string;
}
interface State {
  isSubmitting?: boolean;
  email?: string;
  pass?: string;
  revealPassword?: boolean;
}

class SigninPage extends Component<RouteComponentProps & ConnectProps & WithStyles<typeof styles, true>, State> {
  readonly cfReturnUrl?: string;

  constructor(props) {
    super(props);

    try {
      const paramCfr = new URL(window.location.href).searchParams.get('cfr');
      if (paramCfr && new URL(paramCfr).host.endsWith(window.location.host)) {
        this.cfReturnUrl = paramCfr;
      }
    } catch (er) { }

    if (props.accountStatus === undefined) {
      ServerAdmin.get().dispatchAdmin()
        .then(d => d.accountBindAdmin());
    }

    this.state = {};
  }

  render() {
    if (this.props.accountStatus === Status.FULFILLED) {
      if (this.props.cfJwt && this.cfReturnUrl) {
        window.location.href = `${this.cfReturnUrl}?${SSO_TOKEN_PARAM_NAME}=${this.props.cfJwt}`;
        return (<ErrorPage msg='Redirecting you back...' variant='success' />);
      }
      return (<Redirect to={this.props.match.params[ADMIN_LOGIN_REDIRECT_TO] || '/dashboard'} />);
    }

    return (
      <div className={this.props.classes.page}>
        <Container maxWidth='xs'>
          <Typography component="h1" variant="h4" color="textPrimary">Log in</Typography>
          <TextField
            fullWidth
            required
            value={this.state.email || ''}
            onChange={e => this.setState({ email: e.target.value })}
            label='Email'
            type='email'
            margin='normal'
            disabled={this.state.isSubmitting}
          />
          <TextField
            fullWidth
            required
            value={this.state.pass || ''}
            onChange={e => this.setState({ pass: e.target.value })}
            label='Password'
            type={this.state.revealPassword ? 'text' : 'password'}
            InputProps={{
              endAdornment: (
                <InputAdornment position='end'>
                  <IconButton
                    aria-label='Toggle password visibility'
                    onClick={() => this.setState({ revealPassword: !this.state.revealPassword })}
                  >
                    {this.state.revealPassword ? <VisibilityIcon fontSize='small' /> : <VisibilityOffIcon fontSize='small' />}
                  </IconButton>
                </InputAdornment>
              )
            }}
            margin='normal'
            disabled={this.state.isSubmitting}
          />
          <DialogActions>
            {!isProd() && ( // TODO Enable signups
              <SubmitButton
                onClick={() => this.props.history.push('/signup')}
                isSubmitting={this.state.isSubmitting}
              >Or Signup</SubmitButton>
            )}
            <SubmitButton
              color='primary'
              isSubmitting={this.state.isSubmitting}
              disabled={!this.state.email || !this.state.pass}
              onClick={this.onSubmit.bind(this)}
            >Continue</SubmitButton>
          </DialogActions>
        </Container>
      </div>
    );
  }


  onSubmit() {
    this.setState({ isSubmitting: true });
    ServerAdmin.get().dispatchAdmin().then(d => d.accountLoginAdmin({
      accountLogin: {
        email: this.state.email || '',
        password: saltHashPassword(this.state.pass || ''),
      }
    })).then((result) => {
      this.setState({ isSubmitting: false });
    }).catch((e) => {
      this.setState({ isSubmitting: false });
    });
  }
}

export default connect<ConnectProps, {}, {}, ReduxStateAdmin>((state, ownProps) => {
  const connectProps: ConnectProps = {
    accountStatus: state.account.account.status,
    cfJwt: state.account.account.account?.cfJwt,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(SigninPage));

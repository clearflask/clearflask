// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Container, IconButton, InputAdornment, Paper, TextField, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import { Link } from 'react-router-dom';
import { Status } from '../api/server';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import { SSO_TOKEN_PARAM_NAME } from '../app/App';
import ErrorPage from '../app/ErrorPage';
import SubmitButton from '../common/SubmitButton';
import { saltHashPassword } from '../common/util/auth';
import { RedirectIso } from '../common/util/routerUtil';
import windowIso from '../common/windowIso';
import AnimBubble from './landing/AnimBubble';

export const ADMIN_LOGIN_REDIRECT_TO = 'ADMIN_LOGIN_REDIRECT_TO';

const styles = (theme: Theme) => createStyles({
  page: {
    padding: theme.spacing(2),
    flex: '1 1 auto',
    overflow: 'hidden',
  },
  titleClearFlask: {
    color: theme.palette.primary.main,
  },
  signinContainer: {
    textAlign: 'center',
    zIndex: 5,
    position: 'relative',
    boxShadow: '-10px -10px 40px 0 rgba(0,0,0,0.1)',
    padding: theme.spacing(8),
    maxWidth: 250,
    boxSizing: 'content-box',
    margin: theme.spacing(20, 0, 0, 1),
    [theme.breakpoints.only('xs')]: {
      padding: theme.spacing(4),
    },
  },
  submitButton: {
    margin: theme.spacing(2, 0),
    display: 'block',
  },
  welcomeBack: {
    fontWeight: 'bold',
  },
  signUpHere: {
    textDecoration: 'none',
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
      const paramCfr = new URL(windowIso.location.href).searchParams.get('cfr');
      if (paramCfr && new URL(paramCfr).host.endsWith(windowIso.location.host)) {
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
        windowIso.location.href = `${this.cfReturnUrl}?${SSO_TOKEN_PARAM_NAME}=${this.props.cfJwt}`;
        return (<ErrorPage msg='Redirecting you back...' variant='success' />);
      }
      return (<RedirectIso to={this.props.match.params[ADMIN_LOGIN_REDIRECT_TO] || '/dashboard'} />);
    }

    const signinContainer = (
      <Container maxWidth='md' style={{ position: 'relative' }}>
        <AnimBubble delay='0ms' duration='400ms' size={350} x={420} y={70} />
        <AnimBubble delay='20ms' duration='200ms' size={100} x={800} y={130} />
        <AnimBubble delay='40ms' duration='300ms' size={150} x={520} y={470} />
        <AnimBubble delay='100ms' duration='500ms' size={300} x={900} y={700} />
        <AnimBubble delay='100ms' duration='500ms' size={500} x={1300} y={450} />
        <Paper className={this.props.classes.signinContainer}>
          <Typography component='h1' variant='h4' color='textPrimary' className={this.props.classes.welcomeBack}>
            Welcome back
            to <span className={this.props.classes.titleClearFlask}>ClearFlask</span>
          </Typography>
          <TextField
            variant='outlined'
            fullWidth
            required
            value={this.state.email || ''}
            onChange={e => this.setState({ email: e.target.value })}
            placeholder='Email'
            type='email'
            margin='normal'
            disabled={this.state.isSubmitting}
          />
          <TextField
            variant='outlined'
            fullWidth
            required
            value={this.state.pass || ''}
            onChange={e => this.setState({ pass: e.target.value })}
            placeholder='Password'
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
          <SubmitButton
            className={this.props.classes.submitButton}
            color='primary'
            fullWidth
            variant='contained'
            disableElevation
            isSubmitting={this.state.isSubmitting}
            disabled={!this.state.email || !this.state.pass}
            onClick={this.onSubmit.bind(this)}
          >Continue</SubmitButton>
          <Typography component="span" variant="caption" color="textPrimary">
            No account?&nbsp;
          </Typography>
          <Link to='/signup' className={this.props.classes.signUpHere}>
            <Typography component="span" variant="caption" color="primary">
              Sign Up Here!
            </Typography>
          </Link>
        </Paper>
      </Container>
    );

    return (
      <div className={this.props.classes.page}>
        {signinContainer}
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
      if (e && e.status && e.status === 403) {
        this.setState({ isSubmitting: false });
      } else {
        this.setState({ isSubmitting: false });
      }
    });
  }
}

export default connect<ConnectProps, {}, {}, ReduxStateAdmin>((state, ownProps) => {
  const connectProps: ConnectProps = {
    accountStatus: state.account.account.status,
    cfJwt: state.account.account.account?.cfJwt,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(SigninPage)));

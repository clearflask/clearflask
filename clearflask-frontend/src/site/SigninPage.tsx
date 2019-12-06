import React, { Component } from 'react';
import { Typography, Button, Container, TextField, InputAdornment, IconButton } from '@material-ui/core';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import { connect } from 'react-redux';
import { RouteComponentProps, Redirect } from 'react-router';
import { Status } from '../api/server';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import { saltHashPassword } from '../common/util/auth';

export const ADMIN_LOGIN_REDIRECT_TO = 'ADMIN_LOGIN_REDIRECT_TO';

const styles = (theme:Theme) => createStyles({
  page: {
    margin: theme.spacing(2),
  },
});

interface ConnectProps {
  accountStatus?:Status;
}
interface State {
  isSubmitting?:boolean;
  email?:string;
  pass?:string;
  revealPassword?:boolean;
}

class SigninPage extends Component<RouteComponentProps&ConnectProps&WithStyles<typeof styles, true>, State> {

  constructor(props) {
    super(props);

    if(props.accountStatus === undefined) {
      ServerAdmin.get().dispatchAdmin()
      .then(d => d.accountBindAdmin())
      .catch((e) => {
        if(e.status !== 403) {
          throw e;
        }
      });
    }

    this.state = {};
  }

  render() {
    if(this.props.accountStatus === Status.FULFILLED) {
      return (<Redirect to={this.props.match.params[ADMIN_LOGIN_REDIRECT_TO] || '/dashboard'} />);
    }

    return (
      <div className={this.props.classes.page}>
        <Container maxWidth='xs'>
          <Typography component="h1" variant="h4" color="textPrimary">Sign in</Typography>
          <TextField
            fullWidth
            required
            value={this.state.email || ''}
            onChange={e => this.setState({email: e.target.value})}
            label='Email'
            type='email'
            margin='normal'
            disabled={this.state.isSubmitting}
          />
          <TextField
            fullWidth
            required
            value={this.state.pass || ''}
            onChange={e => this.setState({pass: e.target.value})}
            label='Password'
            type={this.state.revealPassword ? 'text' : 'password'}
            InputProps={{ endAdornment: (
              <InputAdornment position='end'>
                <IconButton
                  aria-label='Toggle password visibility'
                  onClick={() => this.setState({revealPassword: !this.state.revealPassword})}
                >
                  {this.state.revealPassword ? <VisibilityIcon fontSize='small' /> : <VisibilityOffIcon fontSize='small' />}
                </IconButton>
              </InputAdornment>
            )}}
            margin='normal'
            disabled={this.state.isSubmitting}
          />
          <Button
            color='primary'
            disabled={this.state.isSubmitting}
            onClick={this.onSubmit.bind(this)}
          >Continue</Button>
        </Container>
      </div>
    );
  }


  onSubmit() {
    this.setState({isSubmitting: true});
    ServerAdmin.get().dispatchAdmin().then(d => d.accountLoginAdmin({accountLogin: {
      email: this.state.email || '',
      password: saltHashPassword(this.state.pass || ''),
    }})).then(() => {
    }).catch((e) => {
      this.setState({isSubmitting: false});
    });
  }
}

export default connect<ConnectProps,{},{},ReduxStateAdmin>((state, ownProps) => {
  const connectProps:ConnectProps = {
    accountStatus: state.account.account.status,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(SigninPage));

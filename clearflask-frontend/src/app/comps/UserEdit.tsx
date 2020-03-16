import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, Grid, IconButton, Switch, TextField } from '@material-ui/core';
import { createStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import React, { Component } from 'react';
import * as Admin from '../../api/admin';
import { Server } from '../../api/server';
import { saltHashPassword } from '../../common/util/auth';
import { WithMediaQuery, withMediaQuery } from '../../common/util/MediaQuery';

const styles = (theme: Theme) => createStyles({
  row: {
    margin: theme.spacing(2),
  },
  passwordRow: {
    display: 'flex',
  },
});

interface Props {
  server: Server;
  user: Admin.UserAdmin;
  open?: boolean;
  onClose: () => void;
  onUpdated: (user: Admin.UserAdmin) => void;
  onDeleted: () => void;
}
interface State {
  deleteDialogOpen?: boolean;
  isSubmitting?: boolean;
  name?: string;
  email?: string;
  password?: string;
  revealPassword?: boolean;
  emailNotify?: boolean;
  iosPush?: boolean;
  androidPush?: boolean;
  browserPush?: boolean;
}
class PostEdit extends Component<Props & WithMediaQuery & WithStyles<typeof styles, true>, State> {
  state: State = {};

  render() {
    const canSubmit = (
      this.state.name !== undefined
      || this.state.email !== undefined
      || this.state.password !== undefined
      || this.state.emailNotify !== undefined
      || this.state.iosPush !== undefined
      || this.state.androidPush !== undefined
      || this.state.browserPush !== undefined
    );

    return (
      <React.Fragment>
        <Dialog
          open={this.props.open || false}
          onClose={this.props.onClose.bind(this)}
          scroll='body'
          fullScreen={this.props.mediaQuery}
          fullWidth
        >
          <DialogTitle>Edit user</DialogTitle>
          <DialogContent>
            <Grid container alignItems='baseline'>
              <Grid item xs={12} className={this.props.classes.row}>
                <TextField
                  disabled={this.state.isSubmitting}
                  label='Name'
                  fullWidth
                  value={this.state.name === undefined ? this.props.user.name : this.state.name}
                  onChange={e => this.setState({ name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} className={this.props.classes.row}>
                <TextField
                  disabled={this.state.isSubmitting}
                  label='Email'
                  fullWidth
                  value={this.state.email === undefined ? this.props.user.email : this.state.email}
                  onChange={e => this.setState({ email: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} className={`${this.props.classes.row} ${this.props.classes.passwordRow}`}>
                <TextField
                  disabled={this.state.isSubmitting}
                  label='Set password'
                  type={this.state.revealPassword ? 'text' : 'password'}
                  fullWidth
                  value={this.state.password === undefined ? '' : this.state.password}
                  onChange={e => this.setState({ password: e.target.value })}
                />
                <IconButton
                  aria-label='Toggle password visibility'
                  onClick={() => this.setState({ revealPassword: !this.state.revealPassword })}
                  disabled={this.state.isSubmitting}
                >
                  {this.state.revealPassword ? <VisibilityIcon fontSize='small' /> : <VisibilityOffIcon fontSize='small' />}
                </IconButton>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  className={this.props.classes.row}
                  disabled={this.state.isSubmitting
                    || this.state.email === ''
                    || (this.state.email === undefined && this.props.user.email === undefined)}
                  control={(
                    <Switch
                      checked={this.state.emailNotify === undefined ? true : this.state.emailNotify}
                      onChange={(e, checked) => this.setState({ emailNotify: checked ? undefined : false })}
                      color='primary'
                    />
                  )}
                  label={`Notify by email`}
                />
              </Grid>
              {this.props.user.iosPush && (
                <Grid item xs={12}>
                  <FormControlLabel
                    className={this.props.classes.row}
                    disabled={this.state.isSubmitting}
                    control={(
                      <Switch
                        checked={this.state.iosPush === undefined ? true : this.state.iosPush}
                        onChange={(e, checked) => this.setState({ iosPush: checked ? undefined : false })}
                        color='primary'
                      />
                    )}
                    label={`Notify by Apple Push`}
                  />
                </Grid>
              )}
              {this.props.user.androidPush && (
                <Grid item xs={12}>
                  <FormControlLabel
                    className={this.props.classes.row}
                    disabled={this.state.isSubmitting}
                    control={(
                      <Switch
                        checked={this.state.androidPush === undefined ? true : this.state.androidPush}
                        onChange={(e, checked) => this.setState({ androidPush: checked ? undefined : false })}
                        color='primary'
                      />
                    )}
                    label={`Notify by Android Push`}
                  />
                </Grid>
              )}
              {this.props.user.browserPush && (
                <Grid item xs={12}>
                  <FormControlLabel
                    className={this.props.classes.row}
                    disabled={this.state.isSubmitting}
                    control={(
                      <Switch
                        checked={this.state.browserPush === undefined ? true : this.state.browserPush}
                        onChange={(e, checked) => this.setState({ browserPush: checked ? undefined : false })}
                        color='primary'
                      />
                    )}
                    label={`Notify by Browser Push`}
                  />
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.props.onClose()}>Close</Button>
            <Button
              disabled={this.state.isSubmitting}
              style={{ color: !this.state.isSubmitting ? this.props.theme.palette.error.main : undefined }}
              onClick={() => this.setState({ deleteDialogOpen: true })}
            >Delete</Button>
            <Button color='primary' disabled={!canSubmit || this.state.isSubmitting} onClick={() => {
              this.setState({ isSubmitting: true });
              this.props.server.dispatchAdmin().then(d => d.userUpdateAdmin({
                projectId: this.props.server.getProjectId(),
                userId: this.props.user.userId,
                userUpdateAdmin: {
                  name: this.state.name,
                  email: this.state.email,
                  password: this.state.password !== undefined ? saltHashPassword(this.state.password) : undefined,
                  emailNotify: this.state.emailNotify,
                  iosPush: this.state.iosPush,
                  androidPush: this.state.androidPush,
                  browserPush: this.state.browserPush,
                },
              }))
                .then(user => {
                  this.setState({
                    isSubmitting: false,
                    name: undefined,
                    email: undefined,
                    password: undefined,
                    revealPassword: undefined,
                    emailNotify: undefined,
                    iosPush: undefined,
                    androidPush: undefined,
                    browserPush: undefined,
                  });
                  this.props.onUpdated(user);
                  this.props.onClose();
                })
                .catch(e => this.setState({ isSubmitting: false }))
            }}>Publish</Button>
          </DialogActions>
        </Dialog>
        <Dialog
          open={!!this.state.deleteDialogOpen}
          onClose={() => this.setState({ deleteDialogOpen: false })}
        >
          <DialogTitle>Delete Post</DialogTitle>
          <DialogContent>
            <DialogContentText>Are you sure you want to permanently delete this post?</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ deleteDialogOpen: false })}>Cancel</Button>
            <Button
              disabled={this.state.isSubmitting}
              style={{ color: !this.state.isSubmitting ? this.props.theme.palette.error.main : undefined }}
              onClick={() => {
                this.setState({ isSubmitting: true });
                this.props.server.dispatchAdmin().then(d => d.userDeleteAdmin({
                  projectId: this.props.server.getProjectId(),
                  userId: this.props.user.userId,
                }))
                  .then(() => {
                    this.setState({ isSubmitting: false });
                    this.props.onDeleted();
                    this.props.onClose();
                  })
                  .catch(e => this.setState({ isSubmitting: false }))
              }}>Delete</Button>
          </DialogActions>
        </Dialog>
      </React.Fragment>
    );
  }
}

export default withStyles(styles, { withTheme: true })(
  withMediaQuery(theme => theme.breakpoints.down('xs'))(PostEdit));

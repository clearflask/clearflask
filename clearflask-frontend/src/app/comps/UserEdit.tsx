// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, Grid, IconButton, InputAdornment, Switch, TextField } from '@material-ui/core';
import { createStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import classNames from 'classnames';
import React, { Component } from 'react';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { Server } from '../../api/server';
import CreditView from '../../common/config/CreditView';
import SubmitButton from '../../common/SubmitButton';
import { saltHashPassword } from '../../common/util/auth';
import { WithMediaQuery, withMediaQuery } from '../../common/util/MediaQuery';
import DividerCorner from '../utils/DividerCorner';

const styles = (theme: Theme) => createStyles({
  row: {
    padding: theme.spacing(2),
    display: 'flex',
  },
  dividerCorner: {
    maxWidth: 600,
  },
});

interface Props {
  className?: string;
  server: Server;
  user: Admin.UserAdmin;
  credits: Client.Credits;
  isMe: boolean;
  isInsideDialog?: boolean;
  onUpdated: (user: Admin.UserAdmin) => void;
  onDeleted: () => void;
  /** If set, shows a close button */
  onClose?: () => void;
}
interface State {
  deleteDialogOpen?: boolean;
  isSubmitting?: boolean;
  name?: string;
  email?: string;
  password?: string;
  revealPassword?: boolean;
  balanceAdjustment?: string;
  balanceDescription?: string;
  emailNotify?: boolean;
  iosPush?: boolean;
  androidPush?: boolean;
  browserPush?: boolean;
  isMod?: boolean;
}
class PostEdit extends Component<Props & WithMediaQuery & WithStyles<typeof styles, true>, State> {
  state: State = {};

  render() {
    const balanceAdjustmentChanged = this.state.balanceAdjustment !== undefined && (+this.state.balanceAdjustment !== 0);
    const balanceAdjustmentHasError = !!this.state.balanceAdjustment && (!parseInt(this.state.balanceAdjustment) || !+this.state.balanceAdjustment || parseInt(this.state.balanceAdjustment) !== parseFloat(this.state.balanceAdjustment));
    const canSubmit =
      !balanceAdjustmentHasError
      && (
        this.state.name !== undefined
        || this.state.email !== undefined
        || this.state.password !== undefined
        || balanceAdjustmentChanged
        || this.state.emailNotify !== undefined
        || this.state.iosPush !== undefined
        || this.state.androidPush !== undefined
        || this.state.browserPush !== undefined
        || this.state.isMod !== undefined
      );

    var editForm = (
      <>
        <DialogContent>
          <Grid container alignItems='baseline'>
            <Grid item xs={8} className={this.props.classes.row}>
              <TextField
                variant='outlined'
                size='small'
                disabled={this.state.isSubmitting}
                label='Name'
                fullWidth
                value={(this.state.name === undefined ? this.props.user.name : this.state.name) || ''}
                onChange={e => this.setState({ name: e.target.value })}
              />
            </Grid>
            <Grid item xs={4} className={this.props.classes.row}>
              <TextField
                variant='outlined'
                size='small'
                disabled={this.state.isSubmitting}
                label='User ID'
                fullWidth
                value={this.props.user.userId}
                InputProps={{
                  readOnly: true,
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                className={this.props.classes.row}
                disabled={this.state.isSubmitting}
                control={(
                  <Switch
                    checked={this.state.isMod === undefined ? this.props.user.isMod : this.state.isMod}
                    onChange={(e, checked) => this.setState({ isMod: checked === this.props.user.isMod ? undefined : checked })}
                    color='primary'
                  />
                )}
                label={`Moderator`}
              />
            </Grid>
            <Grid item xs={12} className={this.props.classes.row}>
              <TextField
                variant='outlined'
                size='small'
                disabled={this.state.isSubmitting || !!this.props.user.isExternal}
                label='Email'
                fullWidth
                helperText={!!this.props.user.isExternal ? 'Cannot be changed' : undefined}
                value={(this.state.email === undefined ? this.props.user.email : this.state.email) || ''}
                onChange={e => this.setState({ email: e.target.value })}
              />
            </Grid>
            {!this.props.user.isExternal && (
              <Grid item xs={12} className={this.props.classes.row}>
                <TextField
                  variant='outlined'
                  size='small'
                  disabled={this.state.isSubmitting}
                  label='Set password'
                  type={this.state.revealPassword ? 'text' : 'password'}
                  fullWidth
                  value={this.state.password || ''}
                  onChange={e => this.setState({ password: e.target.value })}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position='end'>
                        <IconButton
                          aria-label='Toggle password visibility'
                          onClick={() => this.setState({ revealPassword: !this.state.revealPassword })}
                          disabled={this.state.isSubmitting}
                        >
                          {this.state.revealPassword ? <VisibilityIcon fontSize='small' /> : <VisibilityOffIcon fontSize='small' />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <FormControlLabel
                className={this.props.classes.row}
                disabled={this.state.isSubmitting
                  || this.state.email === ''
                  || (this.state.email === undefined && this.props.user.email === undefined)}
                control={(
                  <Switch
                    checked={this.state.emailNotify === undefined ? this.props.user.emailNotify : this.state.emailNotify}
                    onChange={(e, checked) => this.setState({ emailNotify: checked === this.props.user.emailNotify ? undefined : checked })}
                    color='primary'
                  />
                )}
                label={`Notifications sent to email`}
              />
            </Grid>
            {this.props.user.iosPush && (
              <Grid item xs={12}>
                <FormControlLabel
                  className={this.props.classes.row}
                  disabled={this.state.isSubmitting}
                  control={(
                    <Switch
                      checked={this.state.iosPush === undefined ? this.props.user.iosPush : this.state.iosPush}
                      onChange={(e, checked) => this.setState({ iosPush: checked === this.props.user.iosPush ? undefined : checked })}
                      color='primary'
                    />
                  )}
                  label={`Notifications sent to Apple Push`}
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
                      checked={this.state.androidPush === undefined ? this.props.user.androidPush : this.state.androidPush}
                      onChange={(e, checked) => this.setState({ androidPush: checked === this.props.user.androidPush ? undefined : checked })}
                      color='primary'
                    />
                  )}
                  label={`Notifications sent to Android Push`}
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
                      checked={this.state.browserPush === undefined ? this.props.user.browserPush : this.state.browserPush}
                      onChange={(e, checked) => this.setState({ browserPush: checked === this.props.user.browserPush ? undefined : checked })}
                      color='primary'
                    />
                  )}
                  label={`Notifications sent to Browser Push`}
                />
              </Grid>
            )}
            <Grid item xs={6} className={this.props.classes.row}>
              <TextField
                variant='outlined'
                size='small'
                disabled={this.state.isSubmitting}
                label='Balance'
                value={this.state.balanceAdjustment || ''}
                error={balanceAdjustmentHasError}
                helperText={balanceAdjustmentHasError ? 'Invalid number' : (
                  !this.state.balanceAdjustment ? undefined : (
                    <CreditView
                      val={+this.state.balanceAdjustment}
                      credits={this.props.credits}
                    />
                  ))}
                onChange={e => this.setState({ balanceAdjustment: e.target.value })}
              />
            </Grid>
            <Grid item xs={6} className={this.props.classes.row}>
              <TextField
                variant='outlined'
                size='small'
                disabled={this.state.isSubmitting || !this.state.balanceAdjustment}
                label='Reason'
                value={this.state.balanceDescription || ''}
                onChange={e => this.setState({ balanceDescription: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} className={this.props.classes.row}>
              Account balance after adjustment:&nbsp;&nbsp;
                <CreditView
                val={(this.props.user.balance || 0) + (!balanceAdjustmentHasError && balanceAdjustmentChanged && this.state.balanceAdjustment !== undefined ? +this.state.balanceAdjustment : 0)}
                credits={this.props.credits}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          {this.props.onClose && (
            <Button onClick={() => this.props.onClose && this.props.onClose()}>Close</Button>
          )}
          <SubmitButton
            isSubmitting={this.state.isSubmitting}
            style={{ color: !this.state.isSubmitting ? this.props.theme.palette.error.main : undefined }}
            onClick={() => this.setState({ deleteDialogOpen: true })}
          >Delete</SubmitButton>
          <SubmitButton color='primary' isSubmitting={this.state.isSubmitting} disabled={!canSubmit} onClick={() => {
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
                isMod: this.state.isMod,
                transactionCreate: (this.state.balanceAdjustment !== undefined && balanceAdjustmentChanged) ? {
                  amount: +this.state.balanceAdjustment,
                  summary: this.state.balanceDescription,
                } : undefined,
              },
            }, {
              isMe: this.props.isMe,
            }))
              .then(user => {
                this.setState({
                  isSubmitting: false,
                  name: undefined,
                  email: undefined,
                  password: undefined,
                  revealPassword: undefined,
                  balanceAdjustment: undefined,
                  balanceDescription: undefined,
                  emailNotify: undefined,
                  iosPush: undefined,
                  androidPush: undefined,
                  browserPush: undefined,
                  isMod: undefined,
                });
                this.props.onUpdated(user);
              })
              .catch(e => this.setState({ isSubmitting: false }))
          }}>Save</SubmitButton>
        </DialogActions>
        <Dialog
          open={!!this.state.deleteDialogOpen}
          onClose={() => this.setState({ deleteDialogOpen: false })}
        >
          <DialogTitle>Delete Post</DialogTitle>
          <DialogContent>
            <DialogContentText>Are you sure you want to permanently delete this user?</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ deleteDialogOpen: false })}>Cancel</Button>
            <SubmitButton
              isSubmitting={this.state.isSubmitting}
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
                  })
                  .catch(e => this.setState({ isSubmitting: false }))
              }}>Delete</SubmitButton>
          </DialogActions>
        </Dialog>
      </>
    );

    editForm = this.props.isInsideDialog ? (
      <div className={this.props.className}>
        <DialogTitle>Edit user</DialogTitle>
        {editForm}
      </div>
    ) : (
      <DividerCorner title='Edit User' className={classNames(this.props.className, this.props.classes.dividerCorner)}>
        {editForm}
      </DividerCorner>
    );

    return editForm;
  }
}

export default withStyles(styles, { withTheme: true })(
  withMediaQuery(theme => theme.breakpoints.down('xs'))(PostEdit));

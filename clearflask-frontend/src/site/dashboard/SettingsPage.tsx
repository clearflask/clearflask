// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only

import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Grid, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import ServerAdmin, { ReduxStateAdmin } from '../../api/serverAdmin';
import SubmitButton from '../../common/SubmitButton';
import UpdatableField from '../../common/UpdatableField';
import { saltHashPassword } from '../../common/util/auth';
import { ProjectSettingsBase, Section } from './ProjectSettings';

const styles = (theme: Theme) => createStyles({
  item: {
    margin: theme.spacing(4),
  },
});
interface Props {
}
interface ConnectProps {
  account?: Admin.AccountAdmin;
}
interface State {
  name?: string;
  isSubmitting?: boolean;
  showDeleteDialog?: boolean;
}
class SettingsPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = {};

  render() {
    if (!this.props.account) {
      return 'Need to login to see this page';
    }
    return (
      <ProjectSettingsBase title='Profile'>
        <Section
          contentWidth={500}
          content={(
            <>
              <Grid container alignItems='baseline' className={this.props.classes.item}>
                <Grid item xs={12} sm={4}><Typography>Email</Typography></Grid>
                <Grid item xs={12} sm={8}>
                  <Typography>{this.props.account.email}</Typography>
                  {/* TODO Fix bug in email update requires password to be rehashed
              <UpdatableField
                value={this.props.account.email}
                onSave={newEmail => ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
                  accountUpdateAdmin: { email: newEmail }
                }))}
              /> */}
                </Grid>
              </Grid>
              <Grid container alignItems='baseline' className={this.props.classes.item}>
                <Grid item xs={12} sm={4}><Typography>Name</Typography></Grid>
                <Grid item xs={12} sm={8}><UpdatableField
                  value={this.props.account.name}
                  onSave={newName => ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
                    accountUpdateAdmin: { name: newName }
                  }))}
                /></Grid>
              </Grid>
              <Grid container alignItems='baseline' className={this.props.classes.item}>
                <Grid item xs={12} sm={4}><Typography>Password</Typography></Grid>
                <Grid item xs={12} sm={8}><UpdatableField
                  isPassword
                  value=''
                  onSave={newPassword => ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
                    accountUpdateAdmin: { password: saltHashPassword(newPassword) }
                  }))}
                /></Grid>
              </Grid>
              <Grid container alignItems='baseline' className={this.props.classes.item}>
                <Grid item xs={12} sm={4}><Typography>Account deletion</Typography></Grid>
                <Grid item xs={12} sm={8}>
                  <Button
                    disabled={this.state.isSubmitting}
                    style={{ color: !this.state.isSubmitting ? this.props.theme.palette.error.main : undefined }}
                    onClick={() => this.setState({ showDeleteDialog: true })}
                  >Delete</Button>
                  <Dialog
                    open={!!this.state.showDeleteDialog}
                    onClose={() => this.setState({ showDeleteDialog: false })}
                  >
                    <DialogTitle>Delete account</DialogTitle>
                    <DialogContent>
                      <DialogContentText>Are you sure you want to permanently delete your account, all projects, all associated data, and unsubscribe from your plan?</DialogContentText>
                    </DialogContent>
                    <DialogActions>
                      <Button onClick={() => this.setState({ showDeleteDialog: false })}>Cancel</Button>
                      <SubmitButton
                        isSubmitting={this.state.isSubmitting}
                        style={{ color: !this.state.isSubmitting ? this.props.theme.palette.error.main : undefined }}
                        onClick={() => {
                          this.setState({ isSubmitting: true });
                          ServerAdmin.get().dispatchAdmin().then(d => d.accountDeleteAdmin())
                            .then(() => this.setState({
                              isSubmitting: false,
                              showDeleteDialog: false,
                            }))
                            .catch(e => this.setState({ isSubmitting: false }));
                        }}>Delete</SubmitButton>
                    </DialogActions>
                  </Dialog>
                </Grid>
              </Grid>
            </>
          )}
        />
      </ProjectSettingsBase>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxStateAdmin>((state, ownProps) => {
  const connectProps: ConnectProps = {
    account: state.account.account.account,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(SettingsPage));

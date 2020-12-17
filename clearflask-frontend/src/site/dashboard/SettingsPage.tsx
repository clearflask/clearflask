
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Grid, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import ServerAdmin, { ReduxStateAdmin } from '../../api/serverAdmin';
import DividerCorner from '../../app/utils/DividerCorner';
import UpgradeWrapper, { Action as FeatureAction } from '../../common/config/settings/UpgradeWrapper';
import SubmitButton from '../../common/SubmitButton';
import UpdatableField from '../../common/UpdatableField';
import { saltHashPassword } from '../../common/util/auth';

const styles = (theme: Theme) => createStyles({
  details: {
    margin: theme.spacing(1),
    maxWidth: 1000,
  },
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
      <React.Fragment>
        <DividerCorner title='Account details' className={this.props.classes.details}>
          <Grid container alignItems='baseline' className={this.props.classes.item}>
            <Grid item xs={12} sm={6}><Typography>Name</Typography></Grid>
            <Grid item xs={12} sm={6}><UpdatableField
              value={this.props.account.name}
              onSave={newName => ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
                accountUpdateAdmin: { name: newName }
              }))}
            /></Grid>
          </Grid>
          <Grid container alignItems='baseline' className={this.props.classes.item}>
            <Grid item xs={12} sm={6}><Typography>Email</Typography></Grid>
            <Grid item xs={12} sm={6}><UpdatableField
              value={this.props.account.email}
              onSave={newEmail => ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
                accountUpdateAdmin: { email: newEmail }
              }))}
            /></Grid>
          </Grid>
          <Grid container alignItems='baseline' className={this.props.classes.item}>
            <Grid item xs={12} sm={6}><Typography>Password</Typography></Grid>
            <Grid item xs={12} sm={6}><UpdatableField
              isPassword
              value=''
              onSave={newPassword => ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
                accountUpdateAdmin: { password: saltHashPassword(newPassword) }
              }))}
            /></Grid>
          </Grid>
          <Grid container alignItems='baseline' className={this.props.classes.item}>
            <Grid item xs={12} sm={6}><Typography>Account sign out</Typography></Grid>
            <Grid item xs={12} sm={6}>
              <Button
                disabled={this.state.isSubmitting}
                // style={{ color: !this.state.isSubmitting ? this.props.theme.palette.error.main : undefined }}
                onClick={() => ServerAdmin.get().dispatchAdmin().then(d => d.accountLogoutAdmin())}
              >Sign out</Button>
            </Grid>
          </Grid>
          <Grid container alignItems='baseline' className={this.props.classes.item}>
            <Grid item xs={12} sm={6}><Typography>Account deletion</Typography></Grid>
            <Grid item xs={12} sm={6}>
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
                  <DialogContentText>Are you sure you want to permanently delete your account including all projects and unsubscribe from your plan?</DialogContentText>
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
        </DividerCorner>
        <DividerCorner title='Developer API' className={this.props.classes.details}>
          <UpgradeWrapper action={FeatureAction.API_KEY}>
            <Grid container alignItems='baseline' className={this.props.classes.item}>
              <Grid item xs={12} sm={6}><Typography>Programmatically access and make changes or use Zapier to integrate with your workflow.</Typography></Grid>
            </Grid>
            <Grid container alignItems='baseline' className={this.props.classes.item}>
              <Grid item xs={12} sm={6}><Typography>API Token</Typography></Grid>
              <Grid item xs={12} sm={6}><UpdatableField
                isToken
                value={this.props.account.apiKey}
                onSave={newApiKey => ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
                  accountUpdateAdmin: { apiKey: newApiKey }
                }))}
                helperText='Resetting a token invalidates all previous tokens'
              /></Grid>
            </Grid>
            <Grid container alignItems='baseline' className={this.props.classes.item}>
              <Grid item xs={12} sm={6}><Typography>Account ID</Typography></Grid>
              <Grid item xs={12} sm={6}>{this.props.account.accountId}</Grid>
            </Grid>
          </UpgradeWrapper>
        </DividerCorner>
      </React.Fragment>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxStateAdmin>((state, ownProps) => {
  const connectProps: ConnectProps = {
    account: state.account.account.account,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(SettingsPage));

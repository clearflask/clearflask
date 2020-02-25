
import React, { Component } from 'react';
import IdeaExplorer from '../../app/comps/IdeaExplorer';
import { Server } from '../../api/server';
import DividerCorner from '../../app/utils/DividerCorner';
import { Grid, TextField, Button, Typography } from '@material-ui/core';
import ServerAdmin, { ReduxStateAdmin } from '../../api/serverAdmin';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import UpdatableField from '../../common/UpdatableField';
import { saltHashPassword } from '../../common/util/auth';

const styles = (theme:Theme) => createStyles({
  details: {
    margin: theme.spacing(1),
    maxWidth: 1000,
  },
  item: {
    margin: theme.spacing(4),
  },
});

interface ConnectProps {
  account?:Admin.AccountAdmin;
}

interface State {
  name?:string;
}

class SettingsPage extends Component<ConnectProps&WithStyles<typeof styles, true>, State> {
  state:State = {};

  render() {
    if(!this.props.account) {
      return 'Need to login to see this page';
    }
    return (
      <DividerCorner title='Account details' className={this.props.classes.details}>
        <Grid container alignItems='baseline' className={this.props.classes.item}>
          <Grid item xs={12} sm={6}><Typography>Name</Typography></Grid>
          <Grid item xs={12} sm={6}><UpdatableField
              value={this.props.account.name}
              onSave={newName => ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
                accountUpdateAdmin: {name: newName}}))}
          /></Grid>
        </Grid>
        <Grid container alignItems='baseline' className={this.props.classes.item}>
          <Grid item xs={12} sm={6}><Typography>Email</Typography></Grid>
          <Grid item xs={12} sm={6}><UpdatableField
              value={this.props.account.email}
              onSave={newEmail => ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
                accountUpdateAdmin: {email: newEmail}}))}
          /></Grid>
        </Grid>
        <Grid container alignItems='baseline' className={this.props.classes.item}>
          <Grid item xs={12} sm={6}><Typography>Password</Typography></Grid>
          <Grid item xs={12} sm={6}><UpdatableField
              isPassword
              value=''
              onSave={newPassword => ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
                accountUpdateAdmin: {password: saltHashPassword(newPassword)}}))}
          /></Grid>
        </Grid>
      </DividerCorner>
    );
  }
}

export default connect<ConnectProps,{},{},ReduxStateAdmin>((state, ownProps) => {
  const connectProps:ConnectProps = {
    account: state.account.account.account,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(SettingsPage));

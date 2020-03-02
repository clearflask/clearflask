import React, { Component } from 'react';
import * as Client from '../api/client';
import { Typography, Grid, Avatar, Tabs, Tab, Button, Hidden, Divider, Badge, IconButton, Select, MenuItem, Input, Link } from '@material-ui/core';
import BalanceIcon from '@material-ui/icons/AccountBalance';
import NotificationsIcon from '@material-ui/icons/Notifications';
import AccountIcon from '@material-ui/icons/AccountCircle';
import { Server, ReduxState, Status } from '../api/server';
import DropdownTab from '../common/DropdownTab';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import { contentScrollApplyStyles, Side } from '../common/ContentScroll';
import { withRouter, RouteComponentProps } from 'react-router';
import NotificationBadge from './NotificationBadge';
import PoweredBy from './PoweredBy';

const styles = (theme:Theme) => createStyles({
  footer: {
    width: '100%',
    maxWidth: '1024px',
    margin: '0px auto',
    padding: theme.spacing(1),
  },
  grow: {
    flexGrow: 1,
  },
  footerItems: {
    display: 'flex',
    alignItems: 'center',
  },
});

class Footer extends Component<WithStyles<typeof styles, true>> {
  render() {
    return (
      <div className={this.props.classes.footer}>
        <Divider />
        <div className={this.props.classes.footerItems}>
          <div className={this.props.classes.grow} />
          <PoweredBy />
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(Footer);
 
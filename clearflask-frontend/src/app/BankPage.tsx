import React, { Component } from 'react';
import Message from './comps/Message';
import { connect } from 'react-redux';
import { ReduxState, Server, Status } from '../api/server';
import * as Client from '../api/client';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { withRouter, RouteComponentProps, matchPath } from 'react-router';
import TransactionList from './comps/TransactionList';
import ErrorPage from './ErrorPage';
import DividerCorner from './utils/DividerCorner';
import CreditView from '../common/config/CreditView';
import { Typography } from '@material-ui/core';
import FundingControl from './comps/FundingControl';

const styles = (theme:Theme) => createStyles({
  page: {
    margin: theme.spacing.unit,
  },
  spacing: {
    margin: theme.spacing.unit * 2,
  },
});

interface Props {
  server:Server;
}

interface ConnectProps {
  isLoggedIn:boolean;
  balance?:number;
  credits?:Client.Credits;
}

class BankPage extends Component<Props&ConnectProps&WithStyles<typeof styles, true>> {

  render() {
  if(!this.props.isLoggedIn) {
      return (<ErrorPage msg='You need to log in to see your balance' variant='info' />);
    }
    return (
      <div className={this.props.classes.page}>
        <DividerCorner title='Balance'>
          {this.props.balance !== undefined && this.props.credits && (
            <Typography className={this.props.classes.spacing} variant='subtitle1' component='div'>
              <CreditView val={this.props.balance} credits={this.props.credits} />
            </Typography>
          )}
        </DividerCorner>
        <DividerCorner title='Funding'>
          <FundingControl server={this.props.server} className={this.props.classes.spacing} />
        </DividerCorner>
        <TransactionList server={this.props.server} />
      </div>
    );
  }
}

export default connect<ConnectProps,{},Props,ReduxState>((state, ownProps) => {
  const userId = state.users.loggedIn.user ? state.users.loggedIn.user.userId : undefined;
  const connectProps:ConnectProps = {
    isLoggedIn: !!userId,
    balance: state.credits.myBalance.balance,
    credits: state.conf.conf ? state.conf.conf.credits : undefined,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(BankPage));

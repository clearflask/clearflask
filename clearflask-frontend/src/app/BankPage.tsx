import { Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../api/client';
import { ReduxState, Server } from '../api/server';
import CreditView from '../common/config/CreditView';
import FundingControl from './comps/FundingControl';
import TransactionList from './comps/TransactionList';
import ErrorPage from './ErrorPage';
import DividerCorner from './utils/DividerCorner';
import setTitle from '../common/util/titleUtil';

const styles = (theme: Theme) => createStyles({
  page: {
    margin: theme.spacing(1),
  },
  spacing: {
    margin: theme.spacing(2),
  },
  balanceAndFundingContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-star',
  },
});

interface Props {
  server: Server;
}

interface ConnectProps {
  isLoggedIn: boolean;
  balance?: number;
  credits?: Client.Credits;
}

class BankPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {

  render() {
    setTitle('Bank', true);

    if (!this.props.isLoggedIn) {
      return (<ErrorPage msg='You need to log in to see your balance' variant='info' />);
    }
    return (
      <div className={this.props.classes.page}>
        <div className={this.props.classes.balanceAndFundingContainer}>
          <DividerCorner title='Balance'>
            {this.props.balance !== undefined && this.props.credits && (
              <Typography className={this.props.classes.spacing} variant='subtitle1' component='div'>
                <CreditView val={this.props.balance} credits={this.props.credits} />
              </Typography>
            )}
          </DividerCorner>
          <div className={this.props.classes.spacing} />
          <DividerCorner title='Funding'>
            <FundingControl server={this.props.server} className={this.props.classes.spacing} />
          </DividerCorner>
        </div>
        <TransactionList server={this.props.server} />
      </div>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const userId = state.users.loggedIn.user ? state.users.loggedIn.user.userId : undefined;
  const connectProps: ConnectProps = {
    isLoggedIn: !!userId,
    balance: state.credits.myBalance.balance,
    credits: state.conf.conf ? state.conf.conf.users.credits : undefined,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(BankPage));

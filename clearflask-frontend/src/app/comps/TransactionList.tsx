// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@material-ui/core';
import { Theme, WithStyles, createStyles, withStyles } from '@material-ui/core/styles';
import { Component } from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import * as Client from '../../api/client';
import { ReduxState, Server, getSearchKey } from '../../api/server';
import { Orientation, contentScrollApplyStyles } from '../../common/ContentScroll';
import CreditView from '../../common/config/CreditView';
import { preserveEmbed } from '../../common/util/historyUtil';
import ErrorMsg from '../ErrorMsg';
import TimeAgoI18n from '../utils/TimeAgoI18n';
import { PanelTitle } from './Panel';

const styles = (theme: Theme) => createStyles({
  transactionsTable: {
    whiteSpace: 'nowrap',
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Horizontal }),
  },
});

interface Props {
  className?: string;
  server: Server;
  filterTransactionTypes?: Client.TransactionType[];
  filterAmountMin?: number;
  filterAmountMax?: number;
  filterCreatedStart?: Date;
  filterCreatedEnd?: Date;
}

interface ConnectProps {
  callOnMount?: () => void,
  isLoggedIn: boolean;
  configver?: string;
  credits?: Client.Credits;
  transactions?: Client.Transaction[];
  balance?: number;
  getNextTransactions?: () => void;
}

class TransactionList extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {

  constructor(props) {
    super(props);

    props.callOnMount?.();
  }

  render() {
    if (!this.props.isLoggedIn) {
      return (<ErrorMsg msg='You need to log in to see your balance' variant='info' />);
    }

    if (!this.props.transactions?.length) return null;

    var cumulativeBalance = this.props.balance || 0;
    return (
      <div className={this.props.className}>
        <PanelTitle text='Transaction history' />
        <div className={this.props.classes.transactionsTable}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell key='date'>Date</TableCell>
                <TableCell key='type'>Type</TableCell>
                <TableCell key='description'>Description</TableCell>
                <TableCell key='amount' align='right'>Amount</TableCell>
                <TableCell key='balance' align='right'>Account balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {this.props.credits !== undefined && this.props.balance !== undefined && this.props.transactions !== undefined && this.props.transactions.map(transaction => {
                const transactionBalance = cumulativeBalance;
                cumulativeBalance += transaction.amount;
                return (
                  <TableRow key={transaction.transactionId}>
                    <TableCell key='date'>
                      <Typography><TimeAgoI18n date={transaction.created} /></Typography>
                    </TableCell>
                    <TableCell key='type'>
                      <Typography>{transaction.transactionType}</Typography>
                    </TableCell>
                    <TableCell key='description'>
                      {transaction.summary}
                      {transaction.transactionType === Client.TransactionType.Vote && transaction.targetId && (
                        <Button
                          component={Link}
                          to={preserveEmbed(`/post/${transaction.targetId}`)}
                        >
                          View
                        </Button>
                      )}
                    </TableCell>
                    <TableCell key='amount'>
                      <CreditView val={transaction.amount} credits={this.props.credits!} />
                    </TableCell>
                    <TableCell key='balance'>
                      <CreditView val={transactionBalance} credits={this.props.credits!} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        {this.props.getNextTransactions && (
          <Button style={{ margin: 'auto', display: 'block' }} onClick={() => this.props.getNextTransactions && this.props.getNextTransactions()}>
            Show more
          </Button>
        )}
      </div>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const userId = state.users.loggedIn.user ? state.users.loggedIn.user.userId : undefined;
  const search: Client.TransactionSearch = {
    filterTransactionTypes: ownProps.filterTransactionTypes,
    filterAmountMin: ownProps.filterAmountMin,
    filterAmountMax: ownProps.filterAmountMax,
    filterCreatedStart: ownProps.filterCreatedStart,
    filterCreatedEnd: ownProps.filterCreatedEnd,
  };
  const searchKey: string = getSearchKey(search);
  var getNextTransactions;
  var callOnMount;
  if (userId && (state.credits.transactionSearch.status === undefined || state.credits.transactionSearch.searchKey !== searchKey)) {
    callOnMount = () => {
      ownProps.server.dispatch().then(d => d.transactionSearch({
        projectId: ownProps.server.getProjectId(),
        userId: userId,
        transactionSearch: search,
      }));
    };
  } else if (userId && state.credits.transactionSearch.cursor && state.credits.transactionSearch.searchKey === searchKey) {
    getNextTransactions = () => ownProps.server.dispatch().then(d => d.transactionSearch({
      projectId: ownProps.server.getProjectId(),
      userId: userId,
      transactionSearch: search,
      cursor: state.credits.transactionSearch.cursor,
    }));
  }
  const connectProps: ConnectProps = {
    callOnMount,
    configver: state.conf.ver, // force rerender on config change
    isLoggedIn: !!userId,
    transactions: state.credits.transactionSearch.transactions,
    balance: state.credits.myBalance.balance,
    credits: state.conf.conf?.users.credits,
    getNextTransactions: getNextTransactions,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(TransactionList));

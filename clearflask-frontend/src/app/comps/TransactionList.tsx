import { Button, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import TimeAgo from 'react-timeago';
import * as Client from '../../api/client';
import { getTransactionSearchKey, ReduxState, Server } from '../../api/server';
import CreditView from '../../common/config/CreditView';
import { contentScrollApplyStyles } from '../../common/ContentScroll';
import { preserveEmbed } from '../../common/util/historyUtil';
import ErrorMsg from '../ErrorMsg';
import DividerCorner from '../utils/DividerCorner';

const styles = (theme: Theme) => createStyles({
  transactionsTable: {
    whiteSpace: 'nowrap',
    ...(contentScrollApplyStyles(theme)),
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
  isLoggedIn: boolean;
  configver?: string;
  credits?: Client.Credits;
  transactions?: Client.Transaction[];
  balance?: number;
  getNextTransactions?: () => void;
}

class TransactionList extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & RouteComponentProps> {

  render() {
    if (!this.props.isLoggedIn) {
      return (<ErrorMsg msg='You need to log in to see your balance' variant='info' />);
    }
    var cumulativeBalance = this.props.balance || 0;
    return (
      <div className={this.props.className}>
        <DividerCorner title='Transaction history' height='100%'>
          <div className={this.props.classes.transactionsTable}>
            <Table size='small'>
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
                        <Typography><TimeAgo date={transaction.created} /></Typography>
                      </TableCell>
                      <TableCell key='type'>
                        <Typography>{transaction.transactionType}</Typography>
                      </TableCell>
                      <TableCell key='description'>
                        {transaction.summary}
                        {transaction.transactionType === Client.TransactionType.Vote && transaction.targetId && (
                          <Button onClick={() => this.props.history.push(preserveEmbed(`/post/${transaction.targetId}`, this.props.location))}>
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
        </DividerCorner>
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
  const searchKey: string = getTransactionSearchKey(search);
  var getNextTransactions;
  if (userId && (state.credits.transactionSearch.status === undefined || state.credits.transactionSearch.searchKey !== searchKey)) {
    ownProps.server.dispatch().transactionSearch({
      projectId: ownProps.server.getProjectId(),
      userId: userId,
      transactionSearch: search,
    });
  } else if (userId && state.credits.transactionSearch.cursor && state.credits.transactionSearch.searchKey === searchKey) {
    getNextTransactions = () => ownProps.server.dispatch().transactionSearch({
      projectId: ownProps.server.getProjectId(),
      userId: userId,
      transactionSearch: search,
      cursor: state.credits.transactionSearch.cursor,
    });
  }
  const connectProps: ConnectProps = {
    configver: state.conf.ver, // force rerender on config change
    isLoggedIn: !!userId,
    transactions: state.credits.transactionSearch.transactions,
    balance: state.credits.myBalance.balance,
    credits: state.conf.conf?.users.credits,
    getNextTransactions: getNextTransactions,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(TransactionList)));

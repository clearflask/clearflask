import React, { Component } from 'react';
import Message from '../comps/Message';
import { connect } from 'react-redux';
import { ReduxState, Server, Status, getTransactionSearchKey } from '../../api/server';
import * as Client from '../../api/client';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { withRouter, RouteComponentProps } from 'react-router';
import ErrorPage from '../ErrorPage';
import { Table, TableBody, TableRow, TableCell, TableHead, Button, Typography } from '@material-ui/core';
import CreditView from '../../common/config/CreditView';
import TimeAgo from 'react-timeago'
import { contentScrollApplyStyles } from '../../common/ContentScroll';
import DividerCorner from '../utils/DividerCorner';

const styles = (theme:Theme) => createStyles({
  transactionsTable: {
    whiteSpace: 'nowrap',
    ...(contentScrollApplyStyles(theme)),
  },
});

interface Props {
  className?:string;
  server:Server;
  filterTransactionTypes?:Client.TransactionType[];
  filterAmountMin?:number;
  filterAmountMax?:number;
  filterCreatedStart?:Date;
  filterCreatedEnd?:Date;
}

interface ConnectProps {
  isLoggedIn:boolean;
  configver?:string;
  credits?:Client.Credits;
  transactions?:Client.Transaction[];
  getNextTransactions?:()=>void;
}

class TransactionList extends Component<Props&ConnectProps&WithStyles<typeof styles, true>&RouteComponentProps> {

  render() {
    if(!this.props.isLoggedIn) {
      return (<ErrorPage msg='You need to log in to see your balance' variant='info' />);
    }
    return (
      <div className={this.props.className}>
        <DividerCorner title='Transaction history' height='100%'>
          <div className={this.props.classes.transactionsTable}>
            <Table padding='dense'>
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
                {this.props.credits && this.props.transactions && this.props.transactions.map(transaction => (
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
                      <Button onClick={() => this.props.history.push(`/${this.props.server.getProjectId()}/post/${transaction.targetId}`)}>
                        View
                      </Button>
                    )}
                  </TableCell>
                  <TableCell key='amount'>
                    <CreditView val={transaction.amount} credits={this.props.credits!} />
                  </TableCell>
                  <TableCell key='balance'>
                    <CreditView val={transaction.balance} credits={this.props.credits!} />
                  </TableCell>
                </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DividerCorner>
        {this.props.getNextTransactions && (
          <Button style={{margin: 'auto', display: 'block'}} onClick={() => this.props.getNextTransactions && this.props.getNextTransactions()}>
            Show more
          </Button>
        )}
      </div>
    );
  }
}

export default connect<ConnectProps,{},Props,ReduxState>((state, ownProps) => {
  const userId = state.users.loggedIn.user ? state.users.loggedIn.user.userId : undefined;
  const search:Client.TransactionSearch = {
    filterTransactionTypes: ownProps.filterTransactionTypes,
    filterAmountMin: ownProps.filterAmountMin,
    filterAmountMax: ownProps.filterAmountMax,
    filterCreatedStart: ownProps.filterCreatedStart,
    filterCreatedEnd: ownProps.filterCreatedEnd,
  };
  const searchKey:string = getTransactionSearchKey(search);
  var getNextTransactions;
  if(userId && (state.credits.transactionSearch.status === undefined || state.credits.transactionSearch.searchKey !== searchKey)) {
    ownProps.server.dispatch().transactionSearch({
      projectId: ownProps.server.getProjectId(),
      userId: userId,
      search: search,
    });
  } else if(userId && state.credits.transactionSearch.cursor && state.credits.transactionSearch.searchKey === searchKey) {
    getNextTransactions = () => ownProps.server.dispatch().transactionSearch({
      projectId: ownProps.server.getProjectId(),
      userId: userId,
      search: search,
      cursor: state.credits.transactionSearch.cursor,
    });
  }
  const connectProps:ConnectProps = {
    configver: state.conf.ver, // force rerender on config change
    isLoggedIn: !!userId,
    transactions: state.credits.transactionSearch.transactions,
    credits: state.conf.conf ? state.conf.conf.credits : undefined,
    getNextTransactions: getNextTransactions,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(TransactionList)));

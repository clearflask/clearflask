
import { Grid, Typography, Button, Slide, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Container } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import { Status } from '../../api/server';
import ServerAdmin, { ReduxStateAdmin } from '../../api/serverAdmin';
import DividerCorner from '../../app/utils/DividerCorner';
import PricingPlan from '../PricingPlan';
import StripeCreditCard from '../../common/StripeCreditCard';
import CreditCard from '../../common/CreditCard';
import AcceptTerms from '../../common/AcceptTerms';
import ErrorMsg from '../../app/ErrorMsg';
import ActiveIcon from '@material-ui/icons/Check';
import PausedIcon from '@material-ui/icons/Pause';
import NoneIcon from '@material-ui/icons/PriorityHigh';
import classNames from 'classnames';
import TimeAgo from 'react-timeago';
import BillingChangePlanDialog from './BillingChangePlanDialog';

const styles = (theme: Theme) => createStyles({
  plan: {
    margin: theme.spacing(2, 6, 2),
    alignSelf: 'flex-start',
  },
  spacing: {
    margin: theme.spacing(2),
  },
  creditCard: {
    margin: theme.spacing(2, 6, 2),
    alignSelf: 'flex-start',
  },
  sectionContainer: {
    display: 'inline-flex',
    flexDirection: 'column',
  },
  sectionButtons: {
    alignSelf: 'flex-end',
  },
  blurry: {
    color: 'transparent',
    textShadow: '0px 0px 6px rgba(0,0,0,0.8)',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
});
interface ConnectProps {
  accountStatus?: Status;
  account?: Admin.AccountAdmin;
}
interface State {
  isSubmitting?: boolean;
  showAddPayment?: boolean;
  showPlanChange?: boolean;
}
class BillingPage extends Component<ConnectProps & WithStyles<typeof styles, true>, State> {
  state:State = {};
  render() {
    if (!this.props.account) {
      return 'Need to login to see this page';
    }
    return (
      <React.Fragment>
        <DividerCorner title='Payment' height='90%'>
          {/* NOTE: Our terms refer to this page for renewal date info, cancellation instructions  */}
          <Container maxWidth='sm' className={classNames(this.props.classes.sectionContainer, this.props.classes.spacing)}>
            <CreditCard
              className={this.props.classes.creditCard}
              brand={this.props.account.hasPayment ? (
                this.props.account.renewAutomatically ?
                ( <ActiveIcon color='primary' /> ) : ( <PausedIcon style={{color: this.props.theme.palette.warning.main}} /> )) : ( <NoneIcon color='error' /> )}
              numberInput={(<span className={this.props.classes.blurry}>HEYT HISI SPRI VATE</span>)}
              expiryInput={(<span className={this.props.classes.blurry}>DO / NT</span>)}
              cvcInput={(<span className={this.props.classes.blurry}>LUK</span>)}
            />
            {this.props.account.hasPayment ? (
              this.props.account.renewAutomatically ? (
                <React.Fragment>
                  <Typography variant='h6' component='div'>Automatic renewal is active</Typography>
                  <Typography>You will be automatically billed at the next cycle and your plan will be renewed.</Typography>
                  <div className={this.props.classes.sectionButtons}>
                    <Button disabled={this.state.isSubmitting || this.state.showAddPayment} onClick={() => this.setState({showAddPayment: true})}>Update payment</Button>
                    <Button disabled={this.state.isSubmitting} style={{ color: !this.state.isSubmitting ? this.props.theme.palette.warning.dark : undefined }} onClick={() => {
                      this.setState({isSubmitting: true});
                      ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
                        accountUpdateAdmin: {
                          renewAutomatically: false,
                        },
                      }))
                      .then(() => this.setState({isSubmitting: false}))
                      .catch(er => this.setState({isSubmitting: false}));
                    }}>Pause renewal</Button>
                  </div>
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <Typography variant='h6' component='div'>Automatic renewal is NOT active</Typography>
                  <Typography>You will not be billed at the next cycle. Resume payments to activate automatic renewal to prevent expiration. Expired accounts have limited functionality and are pending deletion.</Typography>
                  <div className={this.props.classes.sectionButtons}>
                    <Button disabled={this.state.isSubmitting} style={{ color: !this.state.isSubmitting ? this.props.theme.palette.error.dark : undefined }} onClick={() => {
                      this.setState({isSubmitting: true});
                      ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
                        accountUpdateAdmin: {
                          paymentToken: '',
                          renewAutomatically: false,
                        },
                      }))
                      .then(() => this.setState({isSubmitting: false}))
                      .catch(er => this.setState({isSubmitting: false}));
                    }}>Remove payment method</Button>
                    <Button disabled={this.state.isSubmitting} color='primary' onClick={() => ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
                      accountUpdateAdmin: {
                        renewAutomatically: true,
                      },
                    }))}>Resume renewal</Button>
                  </div>
                </React.Fragment>
              )
            ) : (
              <React.Fragment>
                <Typography variant='h6' component='div'>Automatic renewal is NOT active</Typography>
                <Typography>Add a payment method to activate automatic renewal to prevent expiration. Expired accounts have limited functionality and are pending deletion.</Typography>
                <div className={this.props.classes.sectionButtons}>
                  <Button disabled={this.state.isSubmitting || this.state.showAddPayment} color='primary' onClick={() => this.setState({showAddPayment: true})
                  }>Add payment method</Button>
                </div>
              </React.Fragment>
            ) }
          </Container>
          <Dialog
            open={!!this.state.showAddPayment}
            keepMounted
            onClose={() => this.setState({showAddPayment: undefined})}
          >
            <DialogTitle>Activate Automatic Renewal</DialogTitle>
            <DialogContent className={this.props.classes.center}>
              <StripeCreditCard />
            </DialogContent>
            <AcceptTerms />
            <DialogActions>
              <Button onClick={() => this.setState({showAddPayment: undefined})}>
                Cancel
              </Button>
              <Button color="primary" onClick={() => {
                this.setState({isSubmitting: true});
                ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
                  accountUpdateAdmin: {
                    paymentToken: 'TODO', // TODO add stripe token
                    renewAutomatically: true,
                  },
                }))
                .then(() => this.setState({isSubmitting: false, showAddPayment: undefined}))
                .catch(er => this.setState({isSubmitting: false}));
              }}>Activate</Button>
            </DialogActions>
          </Dialog>
        </DividerCorner>
        <DividerCorner title='Plan' height='90%'>
          <Container maxWidth='sm' className={classNames(this.props.classes.sectionContainer, this.props.classes.spacing)}>
            <PricingPlan
              selected
              className={this.props.classes.plan}
              plan={this.props.account.plan}
              // hidePerks
            />
            {this.props.account.planExpiry ? (
              (this.props.account.hasPayment && this.props.account.renewAutomatically) ? (
                <React.Fragment>
                  <Typography variant='h6' component='div'>Your plan is active</Typography>
                  <Typography>You have full access to your {this.props.account.plan.title} plan. At the end of the cycle, your plan will automatically renew. If you switch plans, balance will be prorated accordingly.</Typography>
                  <div className={this.props.classes.sectionButtons}>
                    <Button disabled={this.state.isSubmitting || this.state.showPlanChange} onClick={() => this.setState({showPlanChange: true})}>Switch plan</Button>
                  </div>
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <Typography variant='h6' component='div'>Your plan will expire in <TimeAgo date={this.props.account.planExpiry} /></Typography>
                  <Typography>You have full access to your {this.props.account.plan.title} plan until expiration. Expired accounts have limited functionality and are pending deletion. Enable automatic renewal to change plans.</Typography>
                </React.Fragment>
              )
            ) : (
              <React.Fragment>
                <Typography variant='h6' component='div'>Your plan is NOT active</Typography>
                <Typography>You have limited access to functionality and your account is pending deletion. Enable automatic renewal to activate plan and be able to switch plans.</Typography>
              </React.Fragment>
            )}
          </Container>
          <BillingChangePlanDialog
            open={!!this.state.showPlanChange}
            onClose={() => this.setState({showPlanChange: undefined})}
            onSubmit={planid => {
              this.setState({isSubmitting: true});
              ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
                accountUpdateAdmin: {
                  planid,
                },
              }))
              .then(() => this.setState({isSubmitting: false, showPlanChange: undefined}))
              .catch(er => this.setState({isSubmitting: false}));
            }}
            isSubmitting={!!this.state.isSubmitting}
          />
        </DividerCorner>
      </React.Fragment>
    );
  }
}

export default connect<ConnectProps, {}, {}, ReduxStateAdmin>((state, ownProps) => {
  const connectProps: ConnectProps = {
    accountStatus: state.account.account.status,
    account: state.account.account.account,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(BillingPage));

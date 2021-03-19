import { Box, Button, CardActions, CardHeader, Checkbox, Container, FormControlLabel, Grid, Paper, TextField, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Route, RouteComponentProps, withRouter } from 'react-router';
import { Link } from 'react-router-dom';
import { Status } from '../api/server';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import Message from '../common/Message';
import MuiAnimatedSwitch from '../common/MuiAnimatedSwitch';
import Promised from '../common/Promised';
import SubmitButton from '../common/SubmitButton';
import preloadImage from '../common/util/imageUtil';

// If changed, also change in SupportResource.java
const TYPE = 'type';
// If changed, also change in SupportResource.java
const IMPORTANT = 'important';
// If changed, also change in SupportResource.java
const CONTACT = 'contact';

const styles = (theme: Theme) => createStyles({
  page: {
    margin: theme.spacing(6),
    display: 'flex',
    justifyContent: 'center',
  },
  field: {
    margin: theme.spacing(2, 2, 0),
  },
  submitButton: {
    margin: theme.spacing(1, 5),
    display: 'flex',
    justifyContent: 'flex-end',
  },
  box: {
    border: '1px solid ' + theme.palette.grey[300],
  },
  growAndFlex: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  imageForm: {
    padding: theme.spacing(4),
    width: '100%',
    maxWidth: 600,
  },
  image: {
    padding: theme.spacing(0, 0, 8, 0),
    width: '100%',
    margin: 'auto',
    maxHeight: theme.vh(40),
  },
});

interface ContactForm {
  type: string;
  title: string;
  subtitle: string;
  submitTitle: string;
  hideFromMainPage?: boolean;
  imagePath?: string;
  fields: {
    attrName: string;
    title?: string;
    helperText?: string;
    fillWithAccountEmail?: boolean;
    placeholder?: string;
    type?: 'text' | 'multiline' | 'checkbox' | 'datetime';
    required?: boolean;
  }[];
}

const forms: ContactForm[] = [
  {
    type: 'demo',
    title: 'Product walkthrough',
    subtitle: 'Our experts will work with you to find the right solution',
    submitTitle: 'Schedule a demo',
    imagePath: '/img/support/tour.svg',
    hideFromMainPage: true,
    fields: [
      { attrName: 'details', type: 'multiline', title: 'What are you looking for?', required: false },
      { attrName: 'appointment', type: 'datetime', title: 'When are you available?', required: false },
      { attrName: CONTACT, title: 'Email', placeholder: 'name@company.com', required: true, fillWithAccountEmail: true },
    ],
  },
  {
    type: 'sales',
    title: 'Talk to sales',
    subtitle: 'Our experts will work with you to find the right solution',
    submitTitle: 'Contact',
    imagePath: '/img/support/sales.svg',
    fields: [
      { attrName: 'details', type: 'multiline', title: 'What can we help you with?', required: true },
      { attrName: 'company', title: 'Company/Product name', placeholder: 'Sirius Cybernetics', required: false },
      { attrName: CONTACT, title: 'Email', placeholder: 'name@company.com', required: true, fillWithAccountEmail: true },
    ],
  },
  {
    type: 'support',
    title: 'Customer support',
    submitTitle: 'Get support',
    subtitle: 'Need help? Found an issue?',
    imagePath: '/img/support/support.svg',
    fields: [
      { attrName: 'issue', type: 'multiline', title: 'Issue', required: true },
      { attrName: CONTACT, title: 'Contact', placeholder: 'name@example.com', required: true, fillWithAccountEmail: true },
      { attrName: IMPORTANT, type: 'checkbox', title: 'Requires immediate attention' },
    ],
  },
  {
    type: 'general',
    title: 'Other inquiry',
    subtitle: 'Have a question for our team?',
    submitTitle: 'Contact us',
    imagePath: '/img/support/question.svg',
    fields: [
      { attrName: 'message', type: 'multiline', title: 'Inquiry', required: true },
      { attrName: CONTACT, title: 'Contact', placeholder: 'name@example.com', required: true, fillWithAccountEmail: true },
    ],
  },
];

interface Props {
}
interface ConnectProps {
  accountStatus?: Status;
  accountEmail?: string;
}
interface State {
  isSubmitting?: boolean;
  // Also includes dynamic fields not covered by this interface
}
class ContactPage extends Component<Props & RouteComponentProps & ConnectProps & WithStyles<typeof styles, true>, State> {

  constructor(props) {
    super(props);

    this.state = {};

    if (props.accountStatus === undefined) {
      ServerAdmin.get().dispatchAdmin()
        .then(d => d.accountBindAdmin({}));
    }

    forms.forEach(form => form.imagePath && preloadImage(form.imagePath));
  }

  render() {
    const prefixMatch = this.props.match.url.replace(/\/$/, '');
    return (
      <MuiAnimatedSwitch>
        <Route exact key='success' path={`${prefixMatch}/success`} render={props => (
          <div className={classNames(this.props.classes.page, this.props.classes.growAndFlex)}>
            <Box display='flex' justifyContent='center'>
              <Message variant='success' message='Your message has been sent!' />
            </Box>
          </div>
        )} />
        {forms.map(form => (
          <Route exact key={form.type} path={`${prefixMatch}/${form.type}`} render={props => (
            <div className={classNames(this.props.classes.page, this.props.classes.growAndFlex)}>
              <Container maxWidth='md'>
                <Grid container spacing={10} alignItems='center'>
                  <Grid item xs={12} md={6} lg={7}>
                    <Typography component="h1" variant="h3" color="textPrimary">{form.title}</Typography>
                    <Typography component="h2" variant="h5" color="textSecondary">{form.subtitle}</Typography>
                    {form.imagePath && (
                      <img
                        alt=''
                        className={this.props.classes.imageForm}
                        src={form.imagePath}
                      />
                    )}
                  </Grid>
                  <Grid item xs={12} sm={8} md={6} lg={5}>
                    <Paper variant='outlined'>
                      <Box display='flex' flexDirection='column'>
                        {form.fields.map(field => field.type === 'checkbox' ? (
                          <FormControlLabel
                            className={this.props.classes.field}
                            disabled={this.state.isSubmitting}
                            control={(
                              <Checkbox
                                color='primary'
                                checked={this.state[`field_${form.type}_${field.attrName}`] && true || false}
                                onChange={e => this.setState({ [`field_${form.type}_${field.attrName}`]: !this.state[`field_${form.type}_${field.attrName}`] })}
                              />
                            )}
                            label={field.title}
                          />
                        ) : (field.type === 'datetime' ? (
                          <Promised
                            promise={Promise.all<unknown, unknown, unknown, unknown>([
                              import(/* webpackChunkName: "DateTimePicker", webpackPrefetch: true */'@material-ui/pickers/DateTimePicker'),
                              import(/* webpackChunkName: "MuiPickersUtilsProvider", webpackPrefetch: true */'@material-ui/pickers/MuiPickersUtilsProvider'),
                              import(/* webpackChunkName: "moment", webpackPrefetch: true */'@date-io/moment'),
                              /** Add timezone to dates */
                              import(/* webpackChunkName: "moment-timezone", webpackPrefetch: true */'moment-timezone'),
                            ])}
                            render={(libs: any) => {
                              const DateTimePicker = libs[0].DateTimePicker;
                              const MuiPickersUtilsProvider = libs[1].default;
                              const MomentUtils = libs[2].default;
                              const moment = libs[3].default;

                              const cutoff = new Date();
                              cutoff.setDate(cutoff.getDate() + 2);

                              return (
                                <MuiPickersUtilsProvider utils={MomentUtils} locale='en'>
                                  <DateTimePicker
                                    disablePast
                                    variant='inline'
                                    inputVariant='outlined'
                                    size='small'
                                    views={['date', 'hours']}
                                    ampm={false}
                                    disableToolbar
                                    format='MMMM Do H:mm'
                                    autoOk
                                    initialFocusedDate={new Date()}
                                    className={this.props.classes.field}
                                    disabled={this.state.isSubmitting}
                                    label={field.title}
                                    emptyLabel={field.placeholder}
                                    shouldDisableDate={(date) => {
                                      if (!date) return true;
                                      if (date.isBefore(cutoff)) return true;
                                      const weekday = date.format('dddd');
                                      if (weekday === 'Saturday' || weekday === 'Sunday') return true;
                                      return false
                                    }}
                                    helperText={field.helperText}
                                    value={this.state[`field_${form.type}_${field.attrName}`] || null}
                                    onChange={val => {
                                      val.tz(moment.tz.guess())
                                      val = val ? val.minutes(0).seconds(0) : val;
                                      return this.setState({ [`field_${form.type}_${field.attrName}`]: val })
                                    }}
                                  />
                                </MuiPickersUtilsProvider>
                              )
                            }}
                          />
                        ) : (
                          <TextField
                            variant='outlined'
                            size='small'
                            className={this.props.classes.field}
                            disabled={this.state.isSubmitting}
                            label={field.title}
                            placeholder={field.placeholder}
                            helperText={field.helperText}
                            value={this.state[`field_${form.type}_${field.attrName}`] || (field.fillWithAccountEmail && this.props.accountEmail) || ''}
                            onChange={e => this.setState({ [`field_${form.type}_${field.attrName}`]: e.target.value })}
                            required={field.required}
                            multiline={field.type === 'multiline'}
                            rowsMax={field.type === 'multiline' ? 10 : undefined}
                          />
                        )))}
                        <SubmitButton
                          wrapperClassName={this.props.classes.submitButton}
                          color='primary'
                          isSubmitting={this.state.isSubmitting}
                          disabled={form.fields.some(field => field.required
                            && !this.state[`field_${form.type}_${field.attrName}`]
                            && (!field.fillWithAccountEmail || !this.props.accountEmail))}
                          onClick={() => {
                            this.setState({ isSubmitting: true });
                            const content = {};
                            form.fields.forEach(field => {
                              if (field.type === 'datetime') {
                                content[field.attrName] = this.state[`field_${form.type}_${field.attrName}`]?.format('MMMM Do H:mm zz') || '';
                              } else {
                                content[field.attrName] = this.state[`field_${form.type}_${field.attrName}`] || (field.fillWithAccountEmail && this.props.accountEmail) || ''
                              }
                            });
                            ServerAdmin.get().dispatchAdmin().then(d => d.supportMessage({
                              supportMessage: {
                                content: {
                                  ...content,
                                  [TYPE]: form.type,
                                }
                              }
                            }))
                              .then(() => {
                                this.setState({ isSubmitting: false });
                                this.props.history.push(`${prefixMatch}/success`);
                              })
                              .catch(() => this.setState({ isSubmitting: false }));
                          }}
                          style={{
                            alignSelf: 'flex-end',
                          }}
                        >
                          {form.submitTitle}
                        </SubmitButton>
                      </Box>
                    </Paper>
                  </Grid>
                </Grid>
              </Container>
            </div>
          )} />
        ))}
        <Route key='default' path={prefixMatch} render={props => (
          <div className={classNames(this.props.classes.page, this.props.classes.growAndFlex)}>
            <Container maxWidth='md'>
              <Grid container spacing={5} alignItems='stretch' alignContent='stretch'>
                <Grid item xs={12}>
                  <img
                    alt=''
                    className={this.props.classes.image}
                    src='/img/support/main.svg'
                  />
                  <Typography component="h1" variant="h2" color="textPrimary">How can we help?</Typography>
                </Grid>
                {forms.filter(form => !form.hideFromMainPage).map(form => (
                  <Grid key={form.title} item xs={12} sm={6} md={4} className={this.props.classes.growAndFlex}>
                    <CardHeader
                      title={form.title}
                      subheader={form.subtitle}
                      style={{ flexGrow: 1 }}
                    />
                    <CardActions style={{ justifyContent: 'flex-end' }}>
                      <Button
                        component={Link}
                        to={`${prefixMatch}/${form.type}`}
                      >
                        {form.submitTitle}
                      </Button>
                    </CardActions>
                  </Grid>
                ))}
              </Grid>
            </Container>
          </div>
        )} />
      </MuiAnimatedSwitch>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxStateAdmin>((state, ownProps) => {
  const connectProps: ConnectProps = {
    accountStatus: state.account.account.status,
    accountEmail: state.account.account.account?.email,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(ContactPage)));

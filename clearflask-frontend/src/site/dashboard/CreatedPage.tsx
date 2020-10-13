import { Container, Grid, Link as MuiLink, Step, StepContent, StepLabel, Stepper, TextField, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import OpenIcon from '@material-ui/icons/OpenInNew';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import ServerAdmin from '../../api/serverAdmin';
import RichEditor from '../../common/RichEditor';
import SubmitButton from '../../common/SubmitButton';
import { vh } from '../../common/util/vhUtil';

export const CreatedImagePath = '/img/dashboard/created.svg';

const styles = (theme: Theme) => createStyles({
  page: {
    margin: theme.spacing(6),
    display: 'flex',
    justifyContent: 'center',
  },
  field: {
    margin: theme.spacing(1, 2),
  },
  button: {
    margin: theme.spacing(1, 2),
  },
  projectLink: {
    margin: theme.spacing(2),
    display: 'flex',
    alignItems: 'center',
  },
  box: {
    border: '1px solid ' + theme.palette.grey[300],
  },
  growAndFlex: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  imageCreated: {
    padding: theme.spacing(4),
    width: '100%',
    maxWidth: 400,
  },
  image: {
    padding: theme.spacing(0, 0, 8, 0),
    width: '100%',
    margin: 'auto',
    maxHeight: vh(40),
  },
});
interface Props {
  server: Server;
}
interface ConnectProps {
  loggedInUser?: Client.User;
  slug?: string;
  ideaCategoryId?: string;
}
interface State {
  activeStep?: number;
  isSubmitting?: boolean;
  newModName?: string;
  newModEmail?: string;
  newItemTitle?: string;
  newItemDescription?: string;
  newItemSubmitted?: boolean;
  linkClicked?: boolean;
}
class CreatedPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {

  constructor(props) {
    super(props);

    const account = ServerAdmin.get().getStore().getState().account.account.account;
    this.state = {
      newModName: account?.name,
      newModEmail: account?.email,
      // newItemTitle: 'Add dark mode',
      // newItemDescription: textToRaw('To reduce eye-strain, please add a low-light option'),
    };
  }

  render() {
    // Expanded prop is missing in typescript, will be added in mui core 4.9.5
    // https://github.com/mui-org/material-ui/pull/19873
    const expandedProp = (isExpanded: boolean) => ({ expanded: isExpanded });
    const isLoggedIn = !!this.props.loggedInUser;
    const slug = this.props.slug || this.props.server.getProjectId();
    const projectUrl = `${window.location.protocol}//${slug}.${window.location.host}`;
    return (
      <div className={classNames(this.props.classes.page, this.props.classes.growAndFlex)}>
        <Container maxWidth='md'>
          <Grid container spacing={10} alignItems='center'>
            <Grid item xs={12} md={6} lg={5}>
              <Typography component="h1" variant="h3" color="textPrimary">Success!</Typography>
              <Typography component="h2" variant="h5" color="textSecondary">You've created {this.props.server.store.getState().conf.conf?.name || 'your project'}</Typography>
              <img
                alt='Project created'
                className={this.props.classes.imageCreated}
                src={CreatedImagePath}
              />
            </Grid>
            <Grid item xs={12} md={6} lg={7}>
              <Stepper activeStep={this.state.activeStep} orientation='vertical'>
                <Step completed={isLoggedIn} {...expandedProp(!isLoggedIn)}>
                  <StepLabel>Add yourself as a moderator</StepLabel>
                  <StepContent>
                    <TextField
                      disabled={this.state.isSubmitting}
                      className={this.props.classes.field}
                      placeholder='Name'
                      value={this.state.newModName || ''}
                      onChange={e => this.setState({ newModName: e.target.value })}
                    />
                    <TextField
                      disabled={this.state.isSubmitting}
                      className={this.props.classes.field}
                      placeholder='Email'
                      value={this.state.newModEmail || ''}
                      onChange={e => this.setState({ newModEmail: e.target.value })}
                    />
                    <SubmitButton
                      className={this.props.classes.button}
                      color='primary'
                      isSubmitting={this.state.isSubmitting}
                      onClick={e => {
                        this.setState({ isSubmitting: true });
                        this.props.server.dispatchAdmin().then(d => d.userCreateAdmin({
                          projectId: this.props.server.getProjectId(),
                          userCreateAdmin: {
                            name: this.state.newModName,
                            email: this.state.newModEmail,
                            isMod: true,
                          },
                        })
                          .then(user => d.userLoginAdmin({
                            projectId: this.props.server.getProjectId(),
                            userId: user.userId,
                          }))
                          .then(() => this.setState({
                            isSubmitting: false,
                            activeStep: 1,
                          }))
                          .catch(() => this.setState({ isSubmitting: false })));
                      }}
                    >Add</SubmitButton>
                  </StepContent>
                </Step>
                <Step completed={!!this.state.newItemSubmitted} {...expandedProp(!this.state.newItemSubmitted)}>
                  <StepLabel>Create your first idea</StepLabel>
                  <StepContent>
                    <TextField
                      disabled={this.state.isSubmitting}
                      className={this.props.classes.field}
                      placeholder='Title'
                      value={this.state.newItemTitle || ''}
                      onChange={e => this.setState({ newItemTitle: e.target.value })}
                    />
                    <RichEditor
                      disabled={this.state.isSubmitting}
                      className={this.props.classes.field}
                      placeholder='Description'
                      value={this.state.newItemDescription || ''}
                      onChange={e => this.setState({ newItemDescription: e.target.value })}
                      multiline
                      rows={1}
                      rowsMax={5}
                    />
                    <SubmitButton
                      className={this.props.classes.button}
                      color='primary'
                      isSubmitting={this.state.isSubmitting}
                      disabled={!isLoggedIn || !this.state.newItemTitle}
                      onClick={e => {
                        this.setState({ isSubmitting: true });
                        this.props.server.dispatch().ideaCreate({
                          projectId: this.props.server.getProjectId(),
                          ideaCreate: {
                            authorUserId: this.props.loggedInUser!.userId,
                            title: this.state.newItemTitle!,
                            description: this.state.newItemDescription,
                            categoryId: this.props.ideaCategoryId!,
                            tagIds: [],
                          },
                        })
                          .then(() => this.setState({
                            isSubmitting: false,
                            newItemSubmitted: true,
                            activeStep: 2,
                          }))
                          .catch(() => this.setState({ isSubmitting: false }));
                      }}
                    >Post</SubmitButton>
                  </StepContent>
                </Step>
                <Step completed={!!this.state.linkClicked} {...expandedProp(true)}>
                  <StepLabel>Share it with your users</StepLabel>
                  <StepContent>
                    <MuiLink
                      className={this.props.classes.projectLink}
                      target="_blank"
                      href={projectUrl}
                      onClick={() => this.setState({ linkClicked: true })}
                    >
                      {projectUrl}
                      &nbsp;
                      <OpenIcon fontSize='inherit' />
                    </MuiLink>
                  </StepContent>
                </Step>
              </Stepper>
            </Grid>
          </Grid >
        </Container >
      </div >
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props): ConnectProps => {
  const connectProps: ConnectProps = {
    loggedInUser: state.users.loggedIn.user,
    slug: state.conf.conf?.slug,
    ideaCategoryId: state.conf.conf?.content.categories[0]?.categoryId,
  };
  return connectProps;
})(withStyles(styles, { withTheme: true })(CreatedPage));

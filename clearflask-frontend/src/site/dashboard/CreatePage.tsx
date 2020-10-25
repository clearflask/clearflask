import { Box, Button, Card, CardActions, CardContent, CardHeader, Checkbox, Collapse, FormControlLabel, Grid, Link, Step, StepContent, StepLabel, Stepper, TextField, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { ToggleButton, ToggleButtonGroup } from '@material-ui/lab';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import DataMock from '../../api/dataMock';
import ServerAdmin, { DemoUpdateDelay, ReduxStateAdmin } from '../../api/serverAdmin';
import ServerMock from '../../api/serverMock';
import * as ConfigEditor from '../../common/config/configEditor';
import Templater, { CreateTemplateOptions, createTemplateOptionsDefault } from '../../common/config/configTemplater';
import { RestrictedProperties, UpgradeAlert } from '../../common/config/settings/UpgradeWrapper';
import { Device } from '../../common/DeviceContainer';
import SubmitButton from '../../common/SubmitButton';
import debounce from '../../common/util/debounce';
import preloadImage from '../../common/util/imageUtil';
import { Project } from '../DemoApp';
import Demo from '../landing/Demo';
import OnboardingDemo from '../landing/OnboardingDemo';
import { CreatedImagePath } from './CreatedPage';

const styles = (theme: Theme) => createStyles({
  item: {
    margin: theme.spacing(2),
  },
  link: {
    cursor: 'pointer',
    textDecoration: 'none!important',
    color: theme.palette.text.primary,
  },
  box: {
    transition: theme.transitions.create(['border', 'opacity']),
    border: '1px solid ' + theme.palette.grey[300],
  },
  boxSelected: {
    borderColor: theme.palette.primary.main,
  },
  disabled: {
    opacity: 0.5,
  },
  extraControls: {
    display: 'flex',
    flexDirection: 'column',
    margin: theme.spacing(1),
  },
  visibilityButtonGroup: {
    margin: theme.spacing(2),
  },
  visibilityButton: {
    flexDirection: 'column',
    textTransform: 'none',
  },
  onboardOptions: {
    display: 'flex',
    flexDirection: 'column',
  },
  onboardOption: {
    margin: theme.spacing(0.5, 1),
  },
  inlineTextField: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  flexBreak: {
    width: '100%',
  },
});
interface Props {
  previewProject: Project;
  projectCreated: (projectId: string) => void;
}
interface ConnectProps {
  accountPlanId?: string;
}
interface State extends CreateTemplateOptions {
  step: number;
  isSubmitting?: boolean;
  inviteSpecificPeople?: string;
}
class CreatePage extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  readonly updatePreview: () => void;
  onboardingDemoRef: React.RefObject<any> = React.createRef();

  constructor(props) {
    super(props);

    this.state = {
      ...createTemplateOptionsDefault,
      step: 0,
    };

    this.updatePreview = debounce(async () => {
      const config = this.createConfig();
      await this.mockData(config)
      this.props.previewProject.editor.setConfig(config);
      await this.props.previewProject.server.dispatch().userBind({
        projectId: config.projectId,
      });
    }, DemoUpdateDelay);
    this.updatePreview();

    preloadImage(CreatedImagePath);
  }

  render() {
    const visibilityRequiresUpgrade = this.props.accountPlanId && RestrictedProperties[this.props.accountPlanId]?.some(restrictedPath =>
      ConfigEditor.pathEquals(restrictedPath, ['users', 'onboarding', 'visibility']))
    const ssoRequiresUpgrade = this.props.accountPlanId && RestrictedProperties[this.props.accountPlanId]?.some(restrictedPath =>
      ConfigEditor.pathEquals(restrictedPath, ['users', 'onboarding', 'notificationMethods', 'sso']))
    const upgradeRequired = !!visibilityRequiresUpgrade && !!this.state.projectPrivate
      || !!ssoRequiresUpgrade && !!this.state.ssoAllowed;

    const supportButtonGroupVal: string[] = [];
    this.state.fundingAllowed && supportButtonGroupVal.push('funding');
    this.state.votingAllowed && supportButtonGroupVal.push('voting');
    this.state.expressionAllowed && supportButtonGroupVal.push('expression');

    return (
      <React.Fragment>
        <Typography variant='h4' component='h1'>Create a new project</Typography>
        <Typography variant='body1' component='p'>Each project has separate settings, content, and users.</Typography>
        <Stepper activeStep={this.state.step} orientation='vertical'>
          <Step key='plan' completed={false}>
            <StepLabel>
              <Link onClick={() => !this.state.isSubmitting && this.setState({ step: 0 })} className={this.props.classes.link}>
                Template Selection
              </Link>
            </StepLabel>
            <StepContent TransitionProps={{ mountOnEnter: true, unmountOnExit: false }}>
              <Grid container spacing={4} alignItems='flex-start' className={this.props.classes.item}>
                <TemplateCard
                  title='Feedback'
                  content='Collect feedback from customers.'
                  checked={!!this.state.templateFeedback}
                  onChange={() => this.setStateAndPreview({ templateFeedback: !this.state.templateFeedback })}
                />
                <TemplateCard
                  title='Roadmap'
                  disabled={!this.state.templateFeedback}
                  content='Show a roadmap to your users'
                  checked={!!this.state.templateRoadmap && !!this.state.templateFeedback}
                  onChange={() => this.setStateAndPreview({ templateRoadmap: !this.state.templateRoadmap })}
                />
                <div className={this.props.classes.flexBreak} />
                <TemplateCard
                  title='Changelog'
                  content='Update your users with new changes to your product.'
                  checked={!!this.state.templateChangelog}
                  onChange={() => this.setStateAndPreview({ templateChangelog: !this.state.templateChangelog })}
                />
                <TemplateCard
                  title='Knowledge Base'
                  content='Helpful articles around your product.'
                  checked={!!this.state.templateKnowledgeBase}
                  onChange={() => this.setStateAndPreview({ templateKnowledgeBase: !this.state.templateKnowledgeBase })}
                />
                {/* TODO <TemplateCard
                  title='Community forum'
                  content='Let your users discuss questions'
                  checked={!!this.state.templateFeedback}
                  onChange={() => this.setStateAndPreview({templateFeedback: !this.state.templateFeedback})}
                /> */}
                {/* <TemplateCard
                  title='Blog'
                  content='Add articles for your users'
                  checked={!!this.state.templateBlog}
                  onChange={() => this.setStateAndPreview({ templateBlog: !this.state.templateBlog })}
                /> */}
              </Grid>
              <Typography variant='caption'>You can customize and add additional templates later.</Typography>
              <Box display='flex' className={this.props.classes.item}>
                <Button onClick={() => this.setState({ step: this.state.step + 1 })} color='primary'>Next</Button>
              </Box>
            </StepContent>
          </Step>
          <Step key='onboarding' completed={false}>
            <StepLabel>
              <Link onClick={() => !this.state.isSubmitting && this.setState({ step: 1 })} className={this.props.classes.link}>
                Onboarding
               </Link>
            </StepLabel>
            <StepContent TransitionProps={{ mountOnEnter: true, unmountOnExit: false }}>
              <Box display='flex' flexDirection='column' alignItems='flex-start' className={this.props.classes.item}>
                <ToggleButtonGroup
                  className={this.props.classes.visibilityButtonGroup}
                  size='large'
                  exclusive
                  value={!!this.state.projectPrivate ? 'private' : 'public'}
                  onChange={(e, val) => (val === 'private' || val === 'public') && this.setStateAndPreview({
                    projectPrivate: val === 'private',
                    anonAllowed: undefined,
                    webPushAllowed: undefined,
                    emailAllowed: undefined,
                    emailDomainAllowed: undefined,
                    ssoAllowed: undefined,
                    inviteSpecificPeople: undefined,
                  })}
                >
                  <ToggleButton value='public' classes={{ label: this.props.classes.visibilityButton }}>
                    PUBLIC
                    <Typography variant='caption' display='block'>Anyone can see</Typography>
                  </ToggleButton>
                  <ToggleButton value='private' classes={{ label: this.props.classes.visibilityButton }}>
                    PRIVATE
                    <Typography variant='caption' display='block'>Restricted access</Typography>
                  </ToggleButton>
                </ToggleButtonGroup>
                <Collapse in={upgradeRequired} classes={{ wrapperInner: this.props.classes.onboardOptions }}>
                  <UpgradeAlert />
                </Collapse>
                <Collapse in={!!this.state.projectPrivate} classes={{ wrapperInner: this.props.classes.onboardOptions }}>
                  <FormControlLabel
                    label={this.checkboxLabel('Single Sign-On', 'Allow users to authenticate seamlessly between your service and ClearFlask')}
                    className={this.props.classes.onboardOption}
                    control={(
                      <Checkbox
                        color='primary'
                        checked={!!this.state.ssoAllowed}
                        onChange={e => this.setStateAndPreview({ ssoAllowed: !this.state.ssoAllowed })}
                      />
                    )}
                  />
                  <FormControlLabel
                    label={(
                      <span className={this.props.classes.inlineTextField}>
                        Email from&nbsp;@
                        <TextField
                          style={{ width: 100 }}
                          placeholder='company.com'
                          required
                          error={!!this.state.emailAllowed && !this.state.emailDomainAllowed}
                          value={this.state.emailDomainAllowed || ''}
                          onChange={e => this.setStateAndPreview({ emailDomainAllowed: e.target.value })}
                        />
                        &nbsp;domain
                      </span>
                    )}
                    className={this.props.classes.onboardOption}
                    control={(
                      <Checkbox
                        color='primary'
                        checked={!!this.state.emailAllowed}
                        onChange={e => this.setStateAndPreview({ emailAllowed: !this.state.emailAllowed })}
                      />
                    )}
                  />
                  <div className={classNames(this.props.classes.onboardOption, this.props.classes.inlineTextField)}>
                    &nbsp;&nbsp;&nbsp;
                    <Typography variant='body1' component='span'>Invite specific people:</Typography>
                    &nbsp;
                    <TextField
                      style={{ width: 216 }}
                      placeholder='olivia@abc.com, joe@xyz.com'
                      required
                      value={this.state.inviteSpecificPeople || ''}
                      onChange={e => this.setState({ inviteSpecificPeople: e.target.value })}
                    />
                  </div>
                </Collapse>
                <Collapse in={!this.state.projectPrivate} classes={{ wrapperInner: this.props.classes.onboardOptions }}>
                  <FormControlLabel
                    label={this.checkboxLabel('Anonymous', 'Allow users to sign up with no contact information')}
                    className={this.props.classes.onboardOption}
                    control={(
                      <Checkbox
                        color='primary'
                        checked={!!this.state.anonAllowed}
                        onChange={e => this.setStateAndPreview({ anonAllowed: !this.state.anonAllowed })}
                      />
                    )}
                  />
                  <FormControlLabel
                    label={this.checkboxLabel('Browser Push', 'Allow users to sign up by receiving push messages directly in their browser')}
                    className={this.props.classes.onboardOption}
                    control={(
                      <Checkbox
                        color='primary'
                        checked={!!this.state.webPushAllowed}
                        onChange={e => this.setStateAndPreview({ webPushAllowed: !this.state.webPushAllowed })}
                      />
                    )}
                  />
                  <FormControlLabel
                    label={this.checkboxLabel('Email', 'Allow users to sign up with their email')}
                    className={this.props.classes.onboardOption}
                    control={(
                      <Checkbox
                        color='primary'
                        checked={!!this.state.emailAllowed}
                        onChange={e => this.setStateAndPreview({ emailAllowed: !this.state.emailAllowed })}
                      />
                    )}
                  />
                </Collapse>
                <Demo
                  variant='content'
                  type='column'
                  demoProject={Promise.resolve(this.props.previewProject)}
                  initialSubPath='/embed/demo'
                  demoFixedWidth={420}
                  demo={project => (<OnboardingDemo defaultDevice={Device.Desktop} innerRef={this.onboardingDemoRef} server={project.server} />)}
                />
              </Box>
              <Typography variant='caption'>You can customize with more detail later.</Typography>
              <Box display='flex' className={this.props.classes.item}>
                <Button onClick={() => this.setState({ step: this.state.step + 1 })} color='primary'>Next</Button>
              </Box>
            </StepContent>
          </Step>
          <Step key='info' completed={false}>
            <StepLabel>
              <Link onClick={() => !this.state.isSubmitting && this.setState({ step: 2 })} className={this.props.classes.link}>
                Info
               </Link>
            </StepLabel>
            <StepContent TransitionProps={{ mountOnEnter: true, unmountOnExit: false }}>
              <Box display='flex' flexDirection='column' alignItems='flex-start' className={this.props.classes.item}>
                <TextField
                  className={this.props.classes.item}
                  id='website'
                  label={this.props.previewProject.editor.getProperty(['website']).name}
                  helperText={this.props.previewProject.editor.getProperty(['website']).description}
                  disabled={!!this.state.isSubmitting}
                  value={this.state.infoWebsite || ''}
                  onChange={e => {
                    const nameMatch = e.target.value.match(/^(https?:\/\/)?([^./]+).*$/);
                    var slug: string | undefined = undefined;
                    var name: string | undefined = undefined;
                    if (nameMatch && nameMatch[2]) {
                      slug = nameMatch[2].toLowerCase();
                      name = slug.charAt(0).toUpperCase() + slug.slice(1);
                    }
                    const logoMatch = e.target.value.match(/^(https?:\/\/)?([^/]+).*$/);
                    var logo: string | undefined = undefined;
                    if (logoMatch && logoMatch[2]) {
                      logo = `${logoMatch[1] || 'https://'}${logoMatch[2]}/favicon.ico`;
                    }
                    this.setStateAndPreview({
                      infoWebsite: e.target.value,
                      ...(!!logo ? { infoLogo: logo } : {}),
                      ...(!!slug ? { infoSlug: slug } : {}),
                      ...(!!name ? { infoName: name } : {}),
                    })
                  }}
                />
                <TextField
                  className={this.props.classes.item}
                  id='name'
                  label={this.props.previewProject.editor.getProperty(['name']).name}
                  helperText={this.props.previewProject.editor.getProperty(['name']).description}
                  required
                  disabled={!!this.state.isSubmitting}
                  value={this.state.infoName || ''}
                  onChange={e => this.setStateAndPreview({
                    infoName: e.target.value,
                    infoSlug: e.target.value.toLowerCase(),
                  })}
                />
                <TextField
                  className={this.props.classes.item}
                  id='slug'
                  label={this.props.previewProject.editor.getProperty(['slug']).name}
                  helperText={this.props.previewProject.editor.getProperty(['slug']).description}
                  required
                  disabled={!!this.state.isSubmitting}
                  value={this.state.infoSlug || ''}
                  onChange={e => this.setStateAndPreview({ infoSlug: e.target.value })}
                />
                <TextField
                  className={this.props.classes.item}
                  id='logo'
                  label={this.props.previewProject.editor.getProperty(['logoUrl']).name}
                  helperText={this.props.previewProject.editor.getProperty(['logoUrl']).description}
                  disabled={!!this.state.isSubmitting}
                  value={this.state.infoLogo || ''}
                  onChange={e => this.setStateAndPreview({ infoLogo: e.target.value })}
                />
                <SubmitButton
                  isSubmitting={this.state.isSubmitting}
                  disabled={!this.state.infoName || !this.state.infoSlug || upgradeRequired}
                  onClick={() => this.onCreate()} color='primary'>Create</SubmitButton>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </React.Fragment>
    );
  }

  checkboxLabel(primary: string, secondary: string): React.ReactNode {
    return (
      <div>
        <Typography variant='body1' component='p'>{primary}</Typography>
        <Typography variant='caption' component='p'>{secondary}</Typography>
      </div>
    );
  }

  createConfig(): Admin.ConfigAdmin {
    const editor = new ConfigEditor.EditorImpl();
    const templater = Templater.get(editor);
    templater.createTemplate(this.state);
    return editor.getConfig();
  }

  async mockData(config: Admin.ConfigAdmin): Promise<void> {
    const mocker = DataMock.get(config.projectId);
    ServerMock.get().deleteProject(config.projectId);
    ServerMock.get().getProject(config.projectId).config.config = config;

    await mocker.templateMock(this.state);
    if (this.state.step >= 2) {
      await mocker.mockLoggedIn();
    }
  }

  setStateAndPreview<K extends keyof State>(stateUpdate: Pick<State, K>) {
    this.setState(stateUpdate, this.updatePreview.bind(this));
  }

  async onCreate() {
    const inviteUserEmails = this.parseInvites(this.state.inviteSpecificPeople);
    this.setState({ isSubmitting: true });
    try {
      const d = await ServerAdmin.get().dispatchAdmin();
      const newProject = await d.projectCreateAdmin({
        configAdmin: this.createConfig(),
      });
      this.setState({ isSubmitting: false });
      this.props.projectCreated(newProject.projectId);
      inviteUserEmails.forEach(inviteUserEmail => d.userCreateAdmin({
        projectId: newProject.projectId,
        userCreateAdmin: {
          email: inviteUserEmail,
        },
      }));
    } catch (e) {
      this.setState({ isSubmitting: false });
      return;
    }
  }

  parseInvites(input?: string): string[] {
    if (!input) return [];
    return input.split(',')
      .map(e => e.trim())
      .filter(e => !!e)
  }
}

interface TemplateCardProps {
  title: string;
  content: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}

const TemplateCard = withStyles(styles, { withTheme: true })((props: TemplateCardProps & WithStyles<typeof styles, true>) => (
  <Grid item key='feedback' xs={12} sm={6} md={12} lg={4}>
    <Card elevation={0} className={classNames(props.classes.box, props.checked && props.classes.boxSelected, props.disabled && props.classes.disabled)}>
      <CardHeader
        title={props.title}
        titleTypographyProps={{ align: 'center' }}
        subheaderTypographyProps={{ align: 'center' }}
      />
      <CardContent>{props.content}</CardContent>
      <CardActions>
        <FormControlLabel
          control={(
            <Checkbox color="primary"
              checked={props.checked}
              onChange={props.onChange}
              disabled={props.disabled}
            />
          )}
          label={props.checked ? 'Selected' : 'Select'}
        />
      </CardActions>
    </Card>
  </Grid>
))

export default connect<ConnectProps, {}, Props, ReduxStateAdmin>((state, ownProps) => {
  return {
    accountPlanId: state.account.account.account?.plan.planid,
  };
})(withStyles(styles, { withTheme: true })(CreatePage));

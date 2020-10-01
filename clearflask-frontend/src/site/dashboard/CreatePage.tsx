import { Box, Button, Card, CardActions, CardContent, CardHeader, Checkbox, Collapse, FormControlLabel, FormHelperText, Grid, Link, Radio, RadioGroup, Step, StepContent, StepLabel, Stepper, Switch, TextField, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { ToggleButton, ToggleButtonGroup } from '@material-ui/lab';
import classNames from 'classnames';
import React, { Component } from 'react';
import * as Admin from '../../api/admin';
import DataMock from '../../api/dataMock';
import ServerAdmin from '../../api/serverAdmin';
import ServerMock from '../../api/serverMock';
import * as ConfigEditor from '../../common/config/configEditor';
import Templater, { CreateTemplateOptions, createTemplateOptionsDefault } from '../../common/config/configTemplater';
import SubmitButton from '../../common/SubmitButton';
import debounce from '../../common/util/debounce';
import { Project } from '../DemoApp';

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
    transition: theme.transitions.create('border'),
    border: '1px solid ' + theme.palette.grey[300],
  },
  boxSelected: {
    borderColor: theme.palette.primary.main,
  },
  extraControls: {
    display: 'flex',
    flexDirection: 'column',
    margin: theme.spacing(1),
  },
});

interface Props {
  previewProject: Project;
  projectCreated: (projectId: string) => void;
}

interface State extends CreateTemplateOptions {
  step: number;
  isSubmitting?: boolean;
}

class CreatePage extends Component<Props & WithStyles<typeof styles, true>, State> {
  readonly updatePreview: () => void;

  constructor(props) {
    super(props);

    this.state = {
      ...createTemplateOptionsDefault,
      step: 0,
    };

    this.updatePreview = debounce(() => {
      const config = this.createConfig();
      this.mockData(config).then(() => this.props.previewProject.editor.setConfig(config));
    }, 200);
    this.updatePreview();
  }

  render() {
    const supportButtonGroupVal: string[] = [];
    this.state.fundingAllowed && supportButtonGroupVal.push('funding');
    this.state.votingAllowed && supportButtonGroupVal.push('voting');
    this.state.expressionAllowed && supportButtonGroupVal.push('expression');
    return (
      <React.Fragment>
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
                  content='Collect feedback from user. Comes with a "Feature" and "Bug" category.'
                  checked={!!this.state.templateFeedback}
                  onChange={() => this.setStateAndPreview({ templateFeedback: !this.state.templateFeedback })}
                />
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
              <Typography variant='caption'>You can add additional templates later.</Typography>
              <Box display='flex' className={this.props.classes.item}>
                <Button onClick={() => this.setState({ step: this.state.step + 1 })} color='primary'>Next</Button>
              </Box>
            </StepContent>
          </Step>
          {!!this.state.templateFeedback && (
            <Step key='prioritization' completed={false}>
              <StepLabel>
                <Link onClick={() => !this.state.isSubmitting && this.setState({ step: 1 })} className={this.props.classes.link}>
                  Feedback
                </Link>
              </StepLabel>
              <StepContent TransitionProps={{ mountOnEnter: true, unmountOnExit: false }}>
                <ToggleButtonGroup
                  {...{ size: 'small' }}
                  value={supportButtonGroupVal}
                  style={{ display: 'inline-block' }}
                  onChange={(e, val) => this.setStateAndPreview({
                    fundingAllowed: val.includes('funding'),
                    expressionAllowed: val.includes('expression'),
                    votingAllowed: val.includes('voting'),
                  })}
                >
                  <ToggleButton value='funding'>Fund</ToggleButton>
                  <ToggleButton value='voting'>Vote</ToggleButton>
                  <ToggleButton value='expression'>Express</ToggleButton>
                </ToggleButtonGroup>
                <div className={this.props.classes.extraControls}>
                  <Collapse in={this.state.fundingAllowed}><div className={this.props.classes.extraControls}>
                    <RadioGroup
                      value={this.state.fundingType}
                      onChange={(e, val) => this.setStateAndPreview({ fundingType: val as any })}
                    >
                      <FormControlLabel value='currency' control={<Radio color='primary' />} label='Currency' />
                      <FormControlLabel value='time' control={<Radio color='primary' />} label='Development time' />
                      <FormControlLabel value='beer' control={<Radio color='primary' />} label="Custom" />
                    </RadioGroup>
                  </div></Collapse>
                  <Collapse in={this.state.votingAllowed}><div className={this.props.classes.extraControls}>
                    <FormControlLabel
                      control={(
                        <Switch
                          color='primary'
                          checked={!!this.state.votingEnableDownvote}
                          onChange={(e, enableDownvote) => this.setStateAndPreview({ votingEnableDownvote: enableDownvote })}
                        />
                      )}
                      label={<FormHelperText component='span'>Downvoting</FormHelperText>}
                    />
                  </div></Collapse>
                  <Collapse in={this.state.expressionAllowed}><div className={this.props.classes.extraControls}>
                    <FormControlLabel
                      control={(
                        <Switch
                          color='primary'
                          checked={!!this.state.expressionsLimitEmojis}
                          onChange={(e, limitEmojis) => this.setStateAndPreview({ expressionsLimitEmojis: limitEmojis })}
                        />
                      )}
                      label={<FormHelperText component='span'>Limit available emojis</FormHelperText>}
                    />
                    <FormControlLabel
                      control={(
                        <Switch
                          color='primary'
                          checked={!!this.state.expressionsAllowMultiple}
                          onChange={(e, allowMultiple) => this.setStateAndPreview({ expressionsAllowMultiple: allowMultiple })}
                        />
                      )}
                      label={<FormHelperText component='span'>Allow selecting multiple emojis</FormHelperText>}
                    />
                  </div></Collapse>
                </div>
                <Typography variant='caption'>You can customize this in more detail later.</Typography>
                <Box display='flex' className={this.props.classes.item}>
                  <Button onClick={() => this.setState({ step: this.state.step + 1 })} color='primary'>Next</Button>
                </Box>
              </StepContent>
            </Step>
          )}
          <Step key='info' completed={false}>
            <StepLabel>
              <Link onClick={() => !this.state.isSubmitting && this.setState({ step: 1 + (!!this.state.templateFeedback ? 1 : 0) })} className={this.props.classes.link}>
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
                  disabled={!this.state.infoName || !this.state.infoSlug}
                  onClick={() => this.onCreate()} color='primary'>Create</SubmitButton>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </React.Fragment>
    );
  }

  createConfig(): Admin.ConfigAdmin {
    const editor = new ConfigEditor.EditorImpl();
    const templater = Templater.get(editor);
    templater.createTemplate(this.state);
    return editor.getConfig();
  }

  mockData(config: Admin.ConfigAdmin): Promise<void> {
    const mocker = DataMock.get(config.projectId);
    ServerMock.get().deleteProject(config.projectId);
    ServerMock.get().getProject(config.projectId).config.config = config;

    return mocker.templateMock(this.state);
  }

  setStateAndPreview<K extends keyof State>(stateUpdate: Pick<State, K>) {
    this.setState(stateUpdate, this.updatePreview.bind(this));
  }

  onCreate() {
    this.setState({ isSubmitting: true });
    ServerAdmin.get().dispatchAdmin().then(d => d
      .projectCreateAdmin({
        projectId: this.state.infoSlug!,
        configAdmin: this.createConfig(),
      }))
      .then(newProject => {
        this.setState({ isSubmitting: false });
        this.props.projectCreated(newProject.projectId)
      })
      .catch(e => {
        this.setState({ isSubmitting: false });
      });
  }
}

interface TemplateCardProps {
  title: string;
  content: string;
  checked: boolean;
  onChange: () => void;
}

const TemplateCard = withStyles(styles, { withTheme: true })((props: TemplateCardProps & WithStyles<typeof styles, true>) => (
  <Grid item key='feedback' xs={12} sm={6} md={12} lg={4}>
    <Card elevation={0} className={classNames(props.classes.box, props.checked && props.classes.boxSelected)}>
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
            />
          )}
          label={props.checked ? 'Selected' : 'Select'}
        />
      </CardActions>
    </Card>
  </Grid>
))

export default withStyles(styles, { withTheme: true })(CreatePage);

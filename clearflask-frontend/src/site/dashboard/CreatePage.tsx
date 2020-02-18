import React, { Component } from 'react';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { Stepper, Step, StepLabel, Link, StepContent, Grid, Card, CardHeader, CardContent, Checkbox, CardActions, FormControlLabel, Box, Button, TextField, Typography, Collapse, FormHelperText, Switch, RadioGroup, Radio } from '@material-ui/core';
import ServerAdmin from '../../api/serverAdmin';
import { Project } from '../DemoApp';
import Templater from '../../common/config/configTemplater';
import * as ConfigEditor from '../../common/config/configEditor';
import * as Admin from '../../api/admin';
import { ToggleButtonGroup, ToggleButton } from '@material-ui/lab';
import debounce from '../../common/util/debounce';
import DataMock from '../../api/dataMock';
import ServerMock from '../../api/serverMock';

const styles = (theme:Theme) => createStyles({
  item: {
    margin: theme.spacing(2),
  },
  link: {
    cursor: 'pointer',
    textDecoration: 'none!important',
    color: theme.palette.text.primary,
  },
  box: {
    border: '1px solid ' + theme.palette.grey[300],
  },
  boxSelected: {
    border: '1px solid ' + theme.palette.primary.main,
  },
  extraControls: {
    minHeight: 200,
    margin: theme.spacing(1),
  },
});

interface Props {
  previewProject:Project;
  pageClicked:(path:string, subPath?:ConfigEditor.Path)=>void;
}

interface State {
  step:number;
  isSubmitting?:boolean;
  
  templateFeedback?:boolean;
  templateChangelog?:boolean;
  templateKnowledgeBase?:boolean;
  templateFaq?:boolean;
  templateBlog?:boolean;

  fundingAllowed:boolean;
  votingAllowed:boolean;
  expressionAllowed:boolean;
  fundingType:'currency'|'time'|'beer';
  votingEnableDownvote?:boolean;
  expressionsLimitEmojis?:boolean;
  expressionsAllowMultiple?:boolean;

  infoWebsite?:string;
  infoName?:string;
  infoSlug?:string;
  infoLogo?:string;
}

class CreatePage extends Component<Props&WithStyles<typeof styles, true>, State> {
  readonly updatePreview:()=>void;

  constructor(props) {
    super(props);

    this.state = {
      step: 0,
      templateFeedback: true,
      fundingAllowed: true,
      votingAllowed: true,
      expressionAllowed: false,
      fundingType: 'currency',
    };

    this.updatePreview = debounce(() => {
      const config = this.createConfig();
      this.mockData(config).then(() => this.props.previewProject.editor.setConfig(config));
    }, 200);
    this.updatePreview();
  }

  render() {
    const supportButtonGroupVal:string[] = [];
    this.state.fundingAllowed && supportButtonGroupVal.push('funding');
    this.state.votingAllowed && supportButtonGroupVal.push('voting');
    this.state.expressionAllowed && supportButtonGroupVal .push('expression');
    return (
      <React.Fragment>
        <Stepper activeStep={this.state.step} orientation='vertical'>
          <Step key='plan' completed={false}>
            <StepLabel>
              <Link onClick={() => !this.state.isSubmitting && this.setState({step: 0})} className={this.props.classes.link}>
                Template Selection
              </Link>
            </StepLabel>
            <StepContent TransitionProps={{mountOnEnter: true, unmountOnExit: false}}>
              <Grid container spacing={4} alignItems='flex-start' className={this.props.classes.item}>
                <TemplateCard
                  title='Feedback'
                  content='Collect feedback from user. Comes with a "Feature" and "Bug" category.'
                  checked={!!this.state.templateFeedback}
                  onChange={() => this.setStateAndPreview({templateFeedback: !this.state.templateFeedback})}
                />
                <TemplateCard
                  title='Changelog'
                  content='Update your users with new changes to your product.'
                  checked={!!this.state.templateChangelog}
                  onChange={() => this.setStateAndPreview({templateChangelog: !this.state.templateChangelog})}
                />
                <TemplateCard
                  title='Knowledge Base'
                  content='Document your product.'
                  checked={!!this.state.templateKnowledgeBase}
                  onChange={() => this.setStateAndPreview({templateKnowledgeBase: !this.state.templateKnowledgeBase})}
                />
                {/* TODO combine into knowledge base */}
                <TemplateCard
                  title='Frequently Asked Questions'
                  content='Display a list of frequently asked questions'
                  checked={!!this.state.templateFaq}
                  onChange={() => this.setStateAndPreview({templateFaq: !this.state.templateFaq})}
                />
                {/* TODO <TemplateCard
                  title='Community forum'
                  content='Let your users discuss questions'
                  checked={!!this.state.templateFeedback}
                  onChange={() => this.setStateAndPreview({templateFeedback: !this.state.templateFeedback})}
                /> */}
                <TemplateCard
                  title='Blog'
                  content=''
                  checked={!!this.state.templateBlog}
                  onChange={() => this.setStateAndPreview({templateBlog: !this.state.templateBlog})}
                />
              </Grid>
              <Typography variant='body1'>You can add additional templates later.</Typography>
              <Box display='flex' className={this.props.classes.item}>
                <Button onClick={() => this.setState({step: this.state.step + 1})} color='primary'>Next</Button>
              </Box>
            </StepContent>
          </Step>
          {!!this.state.templateFeedback && (
            <Step key='prioritization' completed={false}>
              <StepLabel>
                <Link onClick={() => !this.state.isSubmitting && this.setState({step: 1})} className={this.props.classes.link}>
                  Feedback prioritization
                </Link>
              </StepLabel>
              <StepContent TransitionProps={{mountOnEnter: true, unmountOnExit: false}}>
                <ToggleButtonGroup
                  {...{size:'small'}}
                  value={supportButtonGroupVal}
                  style={{display: 'inline-block'}}
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
                  {this.state.fundingAllowed && (
                    <RadioGroup
                      value={this.state.fundingType}
                      onChange={(e, val) => this.setStateAndPreview({fundingType: val as any})}
                    >
                      <FormControlLabel value='currency' control={<Radio color='primary' />} label='Currency' />
                      <FormControlLabel value='time' control={<Radio color='primary' />} label='Development time' />
                      <FormControlLabel value='beer' control={<Radio color='primary' />} label="Customizable" />
                    </RadioGroup>
                  )}
                  {this.state.votingAllowed && (
                    <FormControlLabel
                      control={(
                        <Switch
                          color='primary'
                          checked={!!this.state.votingEnableDownvote}
                          onChange={(e, enableDownvote) => this.setStateAndPreview({votingEnableDownvote: enableDownvote})}
                        />
                      )}
                      label={<FormHelperText component='span'>Enable downvoting</FormHelperText>}
                    />
                  )}
                  {this.state.expressionAllowed && (
                    <FormControlLabel
                      control={(
                        <Switch
                          color='primary'
                          checked={!!this.state.expressionsLimitEmojis}
                          onChange={(e, limitEmojis) => this.setStateAndPreview({expressionsLimitEmojis: limitEmojis})}
                        />
                      )}
                      label={<FormHelperText component='span'>Limit available emojis</FormHelperText>}
                    />
                  )}
                  {this.state.votingAllowed && (
                    <FormControlLabel
                      control={(
                        <Switch
                          color='primary'
                          checked={!!this.state.expressionsAllowMultiple}
                          onChange={(e, allowMultiple) => this.setStateAndPreview({expressionsAllowMultiple: allowMultiple})}
                        />
                      )}
                      label={<FormHelperText component='span'>Allow selecting multiple emojis</FormHelperText>}
                    />
                  )}
                </div>
                <Typography variant='body1'>You can also switch credits later.</Typography>
                <Box display='flex' className={this.props.classes.item}>
                  <Button onClick={() => this.setState({step: this.state.step + 1})} color='primary'>Next</Button>
                </Box>
              </StepContent>
            </Step>
          )}
          <Step key='info' completed={false}>
            <StepLabel>
              <Link onClick={() => !this.state.isSubmitting && this.setState({step: 1 + (!!this.state.templateFeedback ? 1 : 0)})} className={this.props.classes.link}>
                Info
               </Link>
            </StepLabel>
            <StepContent TransitionProps={{mountOnEnter: true, unmountOnExit: false}}>
              <Box display='flex' flexDirection='column' alignItems='flex-start' className={this.props.classes.item}>
                <TextField
                  className={this.props.classes.item}
                  id='website'
                  label={this.props.previewProject.editor.getProperty(['website']).name}
                  helperText={this.props.previewProject.editor.getProperty(['website']).description}
                  disabled={!!this.state.isSubmitting}
                  value={this.state.infoWebsite || ''}
                  onChange={e => {
                    const nameMatch = e.target.value.match(/^(https?:\/\/)?([^\.\/]+).*$/);
                    var slug:string|undefined = undefined;
                    var name:string|undefined = undefined;
                    if(nameMatch && nameMatch[2]) {
                      slug = nameMatch[2].toLowerCase();
                      name = slug.charAt(0).toUpperCase() + slug.slice(1);
                    }
                    const logoMatch = e.target.value.match(/^(https?:\/\/)?([^\/]+).*$/);
                    var logo:string|undefined = undefined;
                    if(logoMatch && logoMatch[2]) {
                      logo = `${logoMatch[1] || 'https://'}${logoMatch[2]}/favicon.ico`;
                    }
                    this.setStateAndPreview({
                      infoWebsite: e.target.value,
                      ...(!!logo ? {infoLogo: logo} : {}),
                      ...(!!slug ? {infoSlug: slug} : {}),
                      ...(!!name ? {infoName: name} : {}),
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
                <Button
                  disabled={!!this.state.isSubmitting || !this.state.infoName || !this.state.infoSlug}
                  onClick={() => this.onCreate()} color='primary'>Create</Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </React.Fragment>
    );
  }

  createConfig():Admin.ConfigAdmin {
    const editor = new ConfigEditor.EditorImpl();
    if(!!this.state.infoSlug) editor.getProperty<ConfigEditor.StringProperty>(['projectId']).set(this.state.infoSlug);
    if(!!this.state.infoName) editor.getProperty<ConfigEditor.StringProperty>(['name']).set(this.state.infoName);
    if(!!this.state.infoSlug) editor.getProperty<ConfigEditor.StringProperty>(['slug']).set(this.state.infoSlug);
    if(!!this.state.infoWebsite) editor.getProperty<ConfigEditor.StringProperty>(['website']).set(this.state.infoWebsite);
    if(!!this.state.infoLogo) editor.getProperty<ConfigEditor.StringProperty>(['logoUrl']).set(this.state.infoLogo);
    const templater = Templater.get(editor);
    templater.templateBase();
    if(this.state.templateFeedback) {
      templater.templateFeedback(this.state.fundingAllowed, this.state.expressionAllowed || this.state.votingAllowed);
      const ideaCategoryIndex = 0;
      if(this.state.votingAllowed) {
        templater.supportVoting(ideaCategoryIndex, this.state.votingEnableDownvote);
      }
      if(this.state.expressionAllowed) {
        if(this.state.expressionsLimitEmojis) {
          templater.supportExpressingFacebookStyle(ideaCategoryIndex, !this.state.expressionsAllowMultiple);
        } else {
          templater.supportExpressingAllEmojis(ideaCategoryIndex, !this.state.expressionsAllowMultiple);
        }
        templater.supportExpressingLimitEmojiPerIdea(ideaCategoryIndex, !this.state.expressionsAllowMultiple);
      }
      if(this.state.fundingAllowed) {
        templater.supportFunding(ideaCategoryIndex);
        switch(this.state.fundingType) {
          case 'currency':
            templater.creditsCurrency();
            break;
          case 'time':
            templater.creditsTime();
            break;
          case 'beer':
            templater.creditsBeer();
            break;
        }
      }

      const bugCategoryIndex = 1;
      if(this.state.votingAllowed) {
        templater.supportVoting(bugCategoryIndex, this.state.votingEnableDownvote);
      } else if(this.state.expressionAllowed) {
        if(this.state.expressionsLimitEmojis) {
          templater.supportExpressingFacebookStyle(bugCategoryIndex, !this.state.expressionsAllowMultiple);
        } else {
          templater.supportExpressingAllEmojis(bugCategoryIndex, !this.state.expressionsAllowMultiple);
        }
        templater.supportExpressingLimitEmojiPerIdea(bugCategoryIndex, !this.state.expressionsAllowMultiple);
      } else if(this.state.fundingAllowed) {
        templater.supportFunding(bugCategoryIndex);
        switch(this.state.fundingType) {
          case 'currency':
            templater.creditsCurrency();
            break;
          case 'time':
            templater.creditsTime();
            break;
          case 'beer':
            templater.creditsBeer();
            break;
        }
      }
    }
    if(this.state.templateBlog) templater.templateBlog();
    if(this.state.templateChangelog) templater.templateChangelog();
    if(this.state.templateFaq) templater.templateFaq();
    if(this.state.templateKnowledgeBase) templater.templateKnowledgeBase();
    return editor.getConfig();
  }

  async mockData(config:Admin.ConfigAdmin):Promise<void> {
    const mocker = DataMock.get(config.projectId);
    ServerMock.get().deleteProject(config.projectId);
    ServerMock.get().getProject(config.projectId)
      .config.config = config;

    const user1 = await mocker.mockUser('Emily');
    const user2 = await mocker.mockUser('Jacob');
    const user3 = await mocker.mockUser('Sophie');
    const user4 = await mocker.mockUser('Harry');
    if(this.state.templateFeedback) {
      const ideaCategory = config.content.categories.find(c => c.name.match(/Idea/))!;
      const bugCategory = config.content.categories.find(c => c.name.match(/Bug/))!;
      await this.mockItem(
        config.projectId, ideaCategory.categoryId, user1,
        'ERP system integration',
        'I would like to synchronize my data with our ERP system automatically.',
        undefined,
        this.state.fundingAllowed ? 3500 : undefined, this.state.fundingAllowed ? 6000 : undefined,
        this.state.votingAllowed ? 7 : undefined,
        this.state.expressionAllowed ? mocker.fakeExpressions(ideaCategory, 5) : undefined,
        (ideaCategory.workflow.statuses.find(s => s.name.match(/Funding/))
        || ideaCategory.workflow.statuses.find(s => s.name.match(/Planned/)))!.statusId,
        undefined
      );
      await this.mockItem(
        config.projectId, ideaCategory.categoryId, user1,
        'Customize order of options',
        'I want to be able to re-order the options we have in the main settings page.',
        undefined,
        this.state.fundingAllowed ? 1200 : undefined, this.state.fundingAllowed ? 1000 : undefined,
        this.state.votingAllowed ? 7 : undefined,
        this.state.expressionAllowed ? mocker.fakeExpressions(ideaCategory, 5) : undefined,
        ideaCategory.workflow.statuses.find(s => s.name.match(/Planned/))!.statusId,
        undefined
      );
      await this.mockItem(
        config.projectId, ideaCategory.categoryId, user2,
        'Dark mode',
        'The app burns my eyes at night and it would be great if you can make a dark mode option.',
        undefined, undefined, undefined,
        this.state.votingAllowed ? 4 : undefined,
        this.state.expressionAllowed ? mocker.fakeExpressions(ideaCategory, 4) : undefined,
        ideaCategory.workflow.statuses.find(s => s.name.match(/Under review/))!.statusId,
        undefined
      );
      await this.mockItem(
        config.projectId, bugCategory.categoryId, user3,
        'Buttons on mobile too small',
        'In the settings page, all the buttons are too small on my phone, I always click the wrong option.',
        'Fixed in the next update',
        undefined, undefined,
        this.state.votingAllowed ? 2 : undefined,
        this.state.expressionAllowed ? mocker.fakeExpressions(ideaCategory, 2) : undefined,
        ideaCategory.workflow.statuses.find(s => s.name.match(/In progress/))!.statusId,
        undefined
      );
      await this.mockItem(
        config.projectId, bugCategory.categoryId, user3,
        'Finance page typo',
        "You accidentally spelt the word your as you're on the finance page under my finances tab",
        undefined, undefined, undefined,
        this.state.votingAllowed ? 1 : undefined,
        undefined,
        ideaCategory.workflow.statuses.find(s => s.name.match(/Completed/))!.statusId,
        undefined
      );
    }
  }

  mockItem(
    projectId:string,
    categoryId:string,
    user: Admin.UserAdmin,
    title:string,
    description:string,
    response:string|undefined,
    funded:number|undefined,
    fundGoal:number|undefined,
    voteValue:number|undefined,
    expressions:{[key:string]:number;}|undefined,
    statusId:string|undefined,
    tagIds:string[]|undefined,
  ):Promise<Admin.Idea> {
    return ServerMock.get().ideaCreateAdmin({
      projectId: projectId,
      ideaCreateAdmin: {
        fundGoal: fundGoal,
        ...{funded: funded || 0},
        ...{fundersCount: funded ? Math.round(Math.random() * 5) + 1 : 0},
        ...{voteValue: voteValue || 0},
        ...{votersCount: voteValue ? Math.round(Math.random() * voteValue) + 1 : 0},
        ...{expressions: expressions},
        authorUserId: user.userId,
        title: title,
        description: description,
        response: response,
        categoryId: categoryId,
        tagIds: tagIds || [],
        statusId: statusId,
      },
    });
  }

  setStateAndPreview<K extends keyof State>(stateUpdate:Pick<State, K>) {
    this.setState(stateUpdate, this.updatePreview.bind(this));
  }

  onCreate() {
    this.setState({isSubmitting: true});
    ServerAdmin.get().dispatchAdmin().then(d => d
      .projectCreateAdmin({
        projectId: this.state.infoSlug!,
        configAdmin: this.createConfig(),
      }))
      .then(newProject => {
        this.setState({isSubmitting: false});
        this.props.pageClicked(newProject.projectId)
      })
      .catch(e => {
        this.setState({isSubmitting: false});
      });
  }
}

interface TemplateCardProps {
  title:string;
  content:string;
  checked:boolean;
  onChange:()=>void;
}

const TemplateCard = withStyles(styles, { withTheme: true })((props:TemplateCardProps&WithStyles<typeof styles, true>) => (
  <Grid item key='feedback' xs={12} sm={6} md={12} lg={4}>
    <Card elevation={0} className={props.checked ? props.classes.boxSelected : props.classes.box}>
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
          label={props.checked ? 'Selected' : 'Not selected'}
        />
      </CardActions>
    </Card>
  </Grid>
))

export default withStyles(styles, { withTheme: true })(CreatePage);

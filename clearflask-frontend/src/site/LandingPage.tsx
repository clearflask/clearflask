import { Container, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import PaymentIcon from '@material-ui/icons/AccountBalance';
import ApiIcon from '@material-ui/icons/Code';
import BlogIcon from '@material-ui/icons/Description';
import RoadmapIcon from '@material-ui/icons/EqualizerRounded';
/** Alternative: FreeBreakfast */
import DonationIcon from '@material-ui/icons/FavoriteBorder';
import FeedbackIcon from '@material-ui/icons/Feedback';
import KnowledgeIcon from '@material-ui/icons/Help';
import MoreIcon from '@material-ui/icons/MoreHoriz';
import NotificationIcon from '@material-ui/icons/Notifications';
import CommunityIcon from '@material-ui/icons/People';
import QuestionIcon from '@material-ui/icons/QuestionAnswer';
import VisibilityIcon from '@material-ui/icons/RecordVoiceOver';
import RespondIcon from '@material-ui/icons/ReplyAll';
import AnalyticsIcon from '@material-ui/icons/ShowChart';
import VoteIcon from '@material-ui/icons/ThumbsUpDown';
import WidgetIcon from '@material-ui/icons/Widgets';
import classNames from 'classnames';
import React, { Component, Suspense } from 'react';
import { Provider } from 'react-redux';
import * as Client from '../api/client';
import AppThemeProvider from '../app/AppThemeProvider';
import CommentList from '../app/comps/CommentList';
import PostStatusIframe from '../app/PostStatusIframe';
import Loading from '../app/utils/Loading';
import ScrollAnchor from '../common/util/ScrollAnchor';
import { importFailed, importSuccess } from '../Main';
import Block from './landing/Block';
import BlockContent from './landing/BlockContent';
import Demo from './landing/Demo';
import Hero from './landing/Hero';
import HorizontalPanels from './landing/HorizontalPanels';
import PrioritizationControlsCredits from './landing/PrioritizationControlsCredits';
import PrioritizationControlsExpressions from './landing/PrioritizationControlsExpressions';
import PrioritizationControlsVoting from './landing/PrioritizationControlsVoting';
import RoadmapControls from './landing/RoadmapControls';
import TemplateDemoWithControls from './landing/TemplateDemo';
import PricingPage, { TrialInfoText } from './PricingPage';

const WorkflowPreview = React.lazy(() => import('../common/config/settings/injects/WorkflowPreview' /* webpackChunkName: "WorkflowPreview" */).then(importSuccess).catch(importFailed));

const styles = (theme: Theme) => createStyles({
  marker: {
    color: theme.palette.text.secondary,
  },
  pointsContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    width: '100%',
  },
  pointsContainerMinor: {
    color: theme.palette.text.secondary,
  },
  point: {
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
    margin: theme.spacing(2),
  },
  pointSmall: {
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
    margin: theme.spacing(1),
    fontSize: '1em',
  },
  pointIcon: {
    fontSize: '2em',
    margin: theme.spacing(0, 4, 0, 0),
  },
  pointIconSmall: {
    fontSize: '1.5em',
    margin: theme.spacing(0, 3, 0, 0),
  },
  overlapContainer: {
    position: 'relative',
    overflow: 'clip',
    margin: theme.spacing(4, 0),
  },
  textCircleContainer: {
    margin: 'auto',
    maxWidth: '100%',
    width: 900,
    height: 900,
    maxHeight: 900,
    position: 'relative',
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  textCircleItemContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  textCircleItemThreeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  textCircleItem: {
    width: 400,
    maxWidth: 280,
    margin: theme.spacing(0, 3),
  },
  textCircleItemOne: {
    alignSelf: 'flex-start',
    justifyContent: 'end',
  },
  textCircleItemTwo: {
    alignSelf: 'flex-end',
    justifyContent: 'center',
  },
  textCircleItemThree: {
    alignSelf: 'center',
    justifyContent: 'flex-end',
  },
  circleContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  },
  circle: {
    display: 'inline-block',
    boxSizing: 'border-box',
    width: 700,
    height: 700,
    maxWidth: 700,
    maxHeight: 700,
    margin: 100,
    borderRadius: '50%',
    borderStyle: 'solid',
    borderWidth: 100,
    borderColor: theme.palette.text.primary,
    opacity: 0.03,
  },
  tagButton: {
    padding: `3px ${theme.spacing(0.5)}px`,
    whiteSpace: 'nowrap',
    minWidth: 'unset',
    textTransform: 'unset',
  },
  demo: {
    width: '100%',
    maxWidth: 1025,
    margin: 'auto',
    marginBottom: theme.spacing(24),
  },
});
interface State {
  scrollTo?: string;
}
class LandingPage extends Component<WithStyles<typeof styles, true>, State> {
  state: State = {};

  render() {
    return (
      <React.Fragment>
        {this.renderHero()}
        {this.renderDemo()}
        {this.renderLoop()}
        {this.renderCollectFeedback()}
        {this.renderPrioritization()}
        {this.renderEngagement()}
        {/* {this.renderCaseStudies()} */}
        {this.renderCustomize()}
        {this.renderPricing()}
        {this.renderSales()}
      </React.Fragment>
    );
  }

  renderHero() {
    return (
      <Hero
        title='Listen to your users during product development'
        description='Customer feedback platform with voting or crowd-funding to prioritize your roadmap'
        imagePath='/img/landing/hero.svg'
        mirror
        buttonTitle='Get started'
        buttonLink='/signup'
        buttonRemark={(
          <TrialInfoText />
        )}
      />
    );
  }

  renderDemo() {
    return (
      <div className={this.props.classes.demo}>
        <TemplateDemoWithControls />
      </div>
    );
  }

  renderLoop() {
    return (
      <div className={this.props.classes.overlapContainer}>
        <div className={this.props.classes.textCircleContainer}>
          <div className={this.props.classes.textCircleItemContainer}>
            <BlockContent
              className={classNames(this.props.classes.textCircleItemOne, this.props.classes.textCircleItem)}
              variant='content'
              titleCmpt='div'
              title='Collect feedback'
              description={(
                <div className={classNames(this.props.classes.pointsContainer, this.props.classes.pointsContainerMinor)}>
                  <div>Ask your customer to influence your product decisions.</div>
                  <div className={this.props.classes.point}>
                    <WidgetIcon fontSize='inherit' className={this.props.classes.pointIconSmall} />
                    <div>Seamless integration with your product</div>
                  </div>
                  <div className={this.props.classes.point}>
                    <AnalyticsIcon fontSize='inherit' className={this.props.classes.pointIconSmall} />
                    <div>Customer segmentation and Analytics</div>
                  </div>
                </div>
              )}
            // buttonTitle='Learn more'
            // buttonOnClick={() => this.setState({ scrollTo: 'collect' })}
            />
          </div>
          <div className={this.props.classes.textCircleItemContainer}>
            <BlockContent
              className={classNames(this.props.classes.textCircleItemTwo, this.props.classes.textCircleItem)}
              variant='content'
              titleCmpt='div'
              title='Give a proportionate voice'
              description={(
                <div className={classNames(this.props.classes.pointsContainer, this.props.classes.pointsContainerMinor)}>
                  <div>Prioritize your roadmap based on customer's value</div>
                  <div className={this.props.classes.point}>
                    <VoteIcon fontSize='inherit' className={this.props.classes.pointIconSmall} />
                    <div>User vote</div>
                  </div>
                  <div className={this.props.classes.point}>
                    <PaymentIcon fontSize='inherit' className={this.props.classes.pointIconSmall} />
                    <div>Credit System</div>
                  </div>
                </div>
              )}
            // buttonTitle='Learn more'
            // buttonOnClick={() => this.setState({ scrollTo: 'prioritize' })}
            />
          </div>
          <div className={classNames(this.props.classes.textCircleItemContainer, this.props.classes.textCircleItemThreeContainer)}>
            <BlockContent
              className={classNames(this.props.classes.textCircleItemThree, this.props.classes.textCircleItem)}
              variant='content'
              titleCmpt='div'
              title='Engage your customer'
              description={(
                <div className={classNames(this.props.classes.pointsContainer, this.props.classes.pointsContainerMinor)}>
                  <div>Build a community around your product development</div>
                  <div className={this.props.classes.point}>
                    <RoadmapIcon fontSize='inherit' className={this.props.classes.pointIconSmall} style={{ transform: 'rotate(180deg)' }} />
                    <div>Show off your Product Roadmap</div>
                  </div>
                  <div className={this.props.classes.point}>
                    <NotificationIcon fontSize='inherit' className={this.props.classes.pointIconSmall} />
                    <div>Directly respond to your customers</div>
                  </div>
                </div>
              )}
            // buttonTitle='Learn more'
            // buttonOnClick={() => this.setState({ scrollTo: 'engage' })}
            />
            <div style={{ width: '10%' }} />
          </div>
        </div>
        <div
          className={this.props.classes.circleContainer}
          style={{ zIndex: 1 }}
        >
          <span className={this.props.classes.circle} />
        </div>
      </div>
    );
  }

  renderCollectFeedback() {
    return (
      <React.Fragment>
        <ScrollAnchor scrollOnStateName='collect' positionVertical='start' />
        <Demo
          variant='heading-main'
          title='Ask your customers what they need'
          description='Collect customer feedback from all your support channels seamlessly into one scalable funnel. Drive your product forward with customers in mind.'
          alignItems='flex-start'
          imagePath='/img/landing/listen.svg'
          imageLocation='above'
          displayAlign='flex-start'
          demoWrap='browser'
          demoFixedHeight={350}
          initialSubPath='/embed/demo'
          template={templater => templater.demoExplorer({
            allowCreate: { actionTitle: 'Suggest', actionTitleLong: 'Suggest an idea' },
            display: {
              titleTruncateLines: 1,
              descriptionTruncateLines: 2,
              showCommentCount: false,
              showCategoryName: false,
              showCreated: false,
              showAuthor: false,
              showStatus: false,
              showTags: false,
              showVoting: false,
              showFunding: false,
              showExpression: false,
            },
          }, undefined, undefined, { descriptionTruncateLines: 2 }, { limit: 2 })}
          mock={mocker => mocker.demoFeedbackType()}
          settings={{
            demoDisableExplorerExpanded: true,
            // demoBlurryShadow: true,
            demoCreateAnimate: {
              title: 'Add Dark Mode',
              description: 'To reduce eye-strain, please add a low-light option',
              similarSearchTerm: 'theme',
            },
          }}
        />
        <HorizontalPanels wrapBelow='lg' maxWidth='lg' maxContentWidth='sm' staggerHeight={240}>
          {/* Collect feedback right from your website or app */}
          {/* Prioritize based on customer value */}
          {/* Keep your users updated */}
          {/* Explore */}
          <BlockContent
            variant='content'
            title='Capture feedback publicly, internally, or on-behalf'
            description='Enable feedback from your internal teams or make it publicly accessible. Capture feedback directly from your audience or on-behalf from other channels.'
            icon={(<VisibilityIcon />)}
          />
          <BlockContent
            variant='content'
            title='Customer segmentation and Analytics'
            description='Analyze your data with search, segment and filter to summarize feedback from target customers.'
            icon={(<AnalyticsIcon />)}
          />
          {/* <Demo
            variant='content'
            type='column'
            title='Powerful analytics'
            description={('Powered by ElasticSearch, perform user segmentations and gives you the answer you are looking for.')}
            icon={(<AnalyticsIcon />)}
            template={templater => {
              templater.demo();
              templater.demoExplorer({
                search: { limit: 4 },
                allowCreate: undefined,
                allowSearch: { enableSort: true, enableSearchText: true, enableSearchByCategory: true, enableSearchByStatus: true, enableSearchByTag: true },
              }, undefined, true);
            }}
            mock={mocker => mocker.demoExplorer()}
            settings={{
              demoBlurryShadow: true,
              demoSearchAnimate: [{
                term: 'Trending',
                update: { sortBy: Client.IdeaSearchSortByEnum.Trending },
              }, {
                term: 'Dark Mode',
                update: { searchText: 'Dark Mode' },
              }],
            }}
          /> */}
          <BlockContent
            variant='content'
            title='Integrate with your product'
            description='Provide your sales, support, engineering team an opportunity to voice their suggestions. Capture feedback from other channels and record it on-behalf of users.'
            icon={(<WidgetIcon />)}
          />
        </HorizontalPanels>
      </React.Fragment>
    );
  }

  renderPrioritization() {
    return (
      <React.Fragment>
        <ScrollAnchor scrollOnStateName='prioritize' positionVertical='start' />
        <Demo
          variant='heading-main'
          title='Give your most-valuable customers a proportionate voice'
          description='Assign voting power based on customer value and let them prioritize your suggestion box. Your users will love knowing their voice has been heard.'
          mirror
          alignItems='center'
          demoWrap='browser'
          demoWrapPadding='40px 40px 40px 20px'
          imagePath='/img/landing/value.svg'
          imageLocation='above'
          initialSubPath='/embed/demo'
          template={templater => templater.demoPrioritization('all')}
          mock={mocker => mocker.demoPrioritization()}
          settings={{
            demoFlashPostVotingControls: true,
          }}
        />
        <HorizontalPanels wrapBelow='md' maxWidth='lg' maxContentWidth='xs' staggerHeight={200}>
          <Demo
            variant='content'
            type='column'
            title='Keep it simple with voting'
            description='Most common and simplest to understand by users. Customer value and segmentation can be applied behind the scenes.'
            initialSubPath='/embed/demo'
            template={templater => templater.demoPrioritization('vote')}
            controls={project => (<PrioritizationControlsVoting templater={project.templater} />)}
            mock={mocker => mocker.demoPrioritization()}
            settings={{
              demoBlurryShadow: true,
              demoVotingExpressionsAnimate: [
                { type: 'vote', upvote: true },
              ],
            }}
            demoFixedHeight={150}
            containerPortal
          />
          <Demo
            variant='content'
            type='column'
            title='Expressions for a wider range of feedback'
            description='When you cannnot accurately express your feelings with simple upvotes, weighted emoji expressions are here to help.'
            initialSubPath='/embed/demo'
            template={templater => templater.demoPrioritization('express')}
            controls={project => (<PrioritizationControlsExpressions templater={project.templater} />)}
            mock={mocker => mocker.demoPrioritization()}
            settings={{
              demoBlurryShadow: true,
              demoVotingExpressionsAnimate: [
                { type: 'express', update: { expression: '👍', action: Client.IdeaVoteUpdateExpressionsActionEnum.Set } },
                { type: 'express', update: { expression: '👍', action: Client.IdeaVoteUpdateExpressionsActionEnum.Remove } },
              ],
            }}
            demoFixedHeight={420}
            containerPortal
          />
          <Demo
            variant='content'
            type='column'
            title='Credit system for advanced prioritization'
            description='Distribute credits to your users based on their value as a customer or monetary contribution. Let them fine-tune prioritization on their own.'
            initialSubPath='/embed/demo'
            template={templater => templater.demoPrioritization('fund')}
            controls={project => (<PrioritizationControlsCredits templater={project.templater} />)}
            mock={mocker => mocker.demoPrioritization()}
            demoFixedHeight={450}
            containerPortal
            settings={{
              demoBlurryShadow: true,
              demoFundingControlAnimate: [
                { index: 0, fundDiff: 20 },
                { index: 1, fundDiff: -30 },
                { index: 2, fundDiff: 20 },
              ],
            }}
          />
        </HorizontalPanels>
        <Block
          // variant='content'
          title='Give credits based on customer value'
          description='Decide which customers deserve your attention. Typically credits are issued based on monetary contribution and can be automatically issued with our API.'
          alignItems='center'
          demo={(
            <div className={this.props.classes.pointsContainer}>
              <div className={this.props.classes.point}>
                <PaymentIcon fontSize='inherit' className={this.props.classes.pointIcon} />
                <div>
                  <Typography variant='h6' component='div'>
                    Payment provider
                    &nbsp;
                    <PostStatusIframe
                      postId='payment-providers-integration-bgu'
                      height={14}
                      config={{ color: 'grey', fontSize: '0.8em', alignItems: 'end', justifyContent: 'start', textTransform: 'uppercase', }}
                    />
                  </Typography>
                  <Typography variant='body1' component='div' color='textSecondary'>
                    Stripe, Apple Store, Play Store
                  </Typography>
                </div>
              </div>
              <div className={this.props.classes.point}>
                <DonationIcon fontSize='inherit' className={this.props.classes.pointIcon} />
                <div>
                  <Typography variant='h6' component='div'>
                    Donation Framework
                    &nbsp;
                    <PostStatusIframe
                      postId='donation-frameworks-integration-hvn'
                      height={14}
                      config={{ color: 'grey', fontSize: '0.8em', alignItems: 'end', justifyContent: 'start', textTransform: 'uppercase', }}
                    />
                  </Typography>
                  <Typography variant='body1' component='div' color='textSecondary'>
                    Patreon, OpenCollective
                  </Typography>
                </div>
              </div>
              <div className={this.props.classes.point}>
                <ApiIcon fontSize='inherit' className={this.props.classes.pointIcon} />
                <div>
                  <Typography variant='h6' component='div'>
                    Custom source
                  </Typography>
                  <Typography variant='body1' component='div' color='textSecondary'>
                    Integrate via our API
                  </Typography>
                </div>
              </div>
            </div>
          )}
        />
      </React.Fragment>
    );
  }

  renderCaseStudies() {
    return (
      <HorizontalPanels wrapBelow='md' maxWidth='lg' maxContentWidth='xs'>
        <BlockContent
          variant='content'
          title='SAAS product support and feedback'
          description='asdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf ad'
          buttonTitle='See case study and demo'
          buttonLink='/case-study#saas'
        />
        <BlockContent
          variant='content'
          title='Open-Source community-funded product'
          description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
          buttonTitle='See case study and demo'
          buttonLink='/case-study#open-source'
        />
        <BlockContent
          variant='content'
          title='Mobile App monetization strategy'
          description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
          buttonTitle='See case study and demo'
          buttonLink='/case-study#mobile-social-media'
        />
      </HorizontalPanels>
    );
  }

  renderEngagement() {
    return (
      <React.Fragment>
        <ScrollAnchor scrollOnStateName='engage' positionVertical='start' />
        <Demo
          title='Build a community around your product'
          description='Whether you are starting out or have a product on the market, keep your users updated at every step. Let them be involved in your decision making and shape your product.'
          variant='heading-main'
          alignItems='baseline'
          initialSubPath='/embed/demo'
          demoFixedHeight={520}
          imagePath='/img/landing/community.svg'
          imageLocation='above'
          // scale={0.7}
          template={templater => {
            templater.demoCategory();
            templater.styleWhite();
          }}
          settings={{
            // demoBlurryShadow: true,
          }}
          mock={(mocker, config) => mocker.mockFakeIdeaWithComments('ideaId')
            .then(() => mocker.mockLoggedIn())}
          demo={project => (
            <Provider store={project.server.getStore()}>
              <AppThemeProvider isInsideContainer>
                <CommentList
                  server={project.server}
                  ideaId='ideaId'
                  expectedCommentCount={1}
                  logIn={() => Promise.resolve()}
                  newCommentsAllowed
                  loggedInUser={project.server.getStore().getState().users.loggedIn.user}
                  onAuthorClick={(c, u) => { console.log("AHA clicked", c, u) }}
                />
              </AppThemeProvider>
            </Provider>
          )}
        />
        <HorizontalPanels wrapBelow='md' maxWidth='lg' maxContentWidth='sm' staggerHeight={240}>
          <BlockContent
            variant='content'
            title='Respond to suggestions'
            description='Directly respond to customers regarding their requests and keep them updated with the current status quo'
            icon={(<RespondIcon />)}
          />
          <BlockContent
            variant='content'
            title='Activate users'
            description='Bring your users back when their wishes have been fulfilled'
            icon={(<NotificationIcon />)}
          />
          <BlockContent
            variant='content'
            title='Get involved'
            description='Embrace community discussions with threaded comments, rich editor, and a powerful search to find the right discussion'
            icon={(<CommunityIcon />)}
          />
        </HorizontalPanels>
        {/* // TODO add example roadmaps of:
        // - Software development workflow: Planned, In Progress, Recently completed
        // - Crowdfunding: Gathering feedback, Funding, Funded
        // - Custom (language courses): Gaining traction, Beta, Public
        // - Custom (Game ideas): Semi-finals, Selected */}
        <Demo
          title='Show off your progress with a product roadmap'
          description='Customizable roadmaps lets you organize your process. Get your users excited about upcoming improvements.'
          mirror
          initialSubPath='/embed/demo'
          alignItems='flex-start'
          imagePath='/img/landing/roadmap.svg'
          imageLocation='above'
          imageStyle={{ maxWidth: 500, padding: 0, }}
          type='largeDemo'
          demoWrap='browser'
          demoWrapPadding={40}
          template={templater => templater.demoBoardPreset('development')}
          mock={mocker => mocker.demoBoard([
            { status: '0', extra: { funded: 0, fundGoal: 9000, fundersCount: 0, voteValue: 14 } },
            { status: '0', extra: { funded: 500, fundGoal: 5000, fundersCount: 1, voteValue: 7 } },
            { status: '0', extra: { funded: 6700, fundGoal: 10000, fundersCount: 32, voteValue: 2 } },
            { status: '1', extra: { funded: 24300, fundGoal: 20000, fundersCount: 62 } },
            { status: '1', extra: { funded: 5200, fundGoal: 5000, fundersCount: 4 } },
            { status: '1', extra: { funded: 1000, fundGoal: 1000, fundersCount: 1 } },
            { status: '2', extra: { expressions: { '👍': 7, '❤️': 4 } } },
            { status: '2', extra: { expressions: { '👍': 1 } } },
            { status: '2' },
          ])}
          settings={{
            demoBlurryShadow: true,
          }}
          controls={project => (<RoadmapControls templater={project.templater} />)}
        />
      </React.Fragment>
    );
  }

  renderCustomize() {
    return (
      <React.Fragment>
        <ScrollAnchor scrollOnStateName='customize' positionVertical='start' />
        <Block
          title='Make it your own'
          imagePath='/img/landing/customize.svg'
          mirror
          imageStyle={{ paddingBottom: 0, maxWidth: 700 }}
          variant='heading-main'
          description='Our product is based on customizability to fit your specific needs. We are happy to meet your needs if a specific use case is not yet covered.'
          alignItems='flex-start'
        />
        <HorizontalPanels wrapBelow='lg' maxContentWidth='sm' maxWidth='lg' staggerHeight={0}>
          {this.renderCustomizeContent()}
          {this.renderCustomizeWorkflow()}
          {this.renderCustomizeLayout()}
          {/* {this.renderCustomizeOther()} */}
        </HorizontalPanels>
      </React.Fragment>
    );
  }

  renderCustomizeContent() {
    return (
      <Container maxWidth='xs'>
        <Block
          type='column'
          variant='heading'
          title='Define Custom content'
          description='Define a content type to hold a particular set of data. Each type can have different behavior and accessibility by users and moderators.'
        />
        <div className={classNames(this.props.classes.pointsContainer, this.props.classes.pointsContainerMinor)}>
          <div className={this.props.classes.pointSmall}>
            <FeedbackIcon fontSize='inherit' className={this.props.classes.pointIconSmall} />
            <div>User feedback</div>
          </div>
          <div className={this.props.classes.pointSmall}>
            <BlogIcon fontSize='inherit' className={this.props.classes.pointIconSmall} />
            <div>Blog entry</div>
          </div>
          <div className={this.props.classes.pointSmall}>
            <QuestionIcon fontSize='inherit' className={this.props.classes.pointIconSmall} />
            <div>Question &amp; Answer</div>
          </div>
          <div className={this.props.classes.pointSmall}>
            <KnowledgeIcon fontSize='inherit' className={this.props.classes.pointIconSmall} />
            <div>Knowledge Base article</div>
          </div>
          <div className={this.props.classes.pointSmall}>
            <MoreIcon fontSize='inherit' className={this.props.classes.pointIconSmall} />
          </div>
        </div>
      </Container>
    );
  }

  renderCustomizeWorkflow() {
    return (
      <Container maxWidth='xs'>
        <Demo
          type='column'
          variant='heading'
          title='Match your product Workflow'
          description='Customize states, transitions, and behavior of each content type to match your workflow. Each state can have different behavior and accessibility by users and moderators.'
          template={templater => {
            templater.workflowFeatures(templater.demoCategory(), false, false);
            templater.styleWhite();
          }}
          demoFixedHeight={400}
          demoPreventInteraction
          demo={project => (
            <Suspense fallback={<Loading />}>
              <WorkflowPreview
                editor={project.editor}
                categoryIndex={0}
                isVertical
                hideCorner
                height='100%'
              />
            </Suspense>
          )}
        />
      </Container>
    );
  }

  renderCustomizeLayout() {
    return (
      <Container maxWidth='xs'>
        <Demo
          type='column'
          variant='heading'
          title='Customize each page'
          description='Create custom pages and menus to fit the content your product needs. Use our page editor or inject your own HTML using Liquid template engine.'
          initialSubPath='/embed/demo'
          demoWrap='browser-dark'
          demoPreventInteraction
          template={templater => {
            templater.demoPrioritization('none');
            templater.styleDark();
          }}
          mock={mocker => mocker.demoPrioritization()}
          demoFixedHeight={180}
          demoFixedWidth={250}
          containerPortal
        />
      </Container>
    );
  }

  // onboardingDemoRef: React.RefObject<any> = React.createRef();
  // renderCustomizeOther() {
  //   return (
  //     <React.Fragment>
  //       <Demo
  //         variant='heading'
  //         type='column'
  //         title='Choose sign-up options'
  //         description='Introduce least amount of friction by choosing the right sign-up options for your product.'
  //         initialSubPath='/embed/demo'
  //         demoFixedWidth={420}
  //         template={templater => {
  //           setInitSignupMethodsTemplate(templater);
  //           templater.styleWhite();
  //         }}
  //         controls={project => (<OnboardingControls onboardingDemoRef={this.onboardingDemoRef} templater={project.templater} />)}
  //         demo={project => (<OnboardingDemo defaultDevice={Device.Desktop} innerRef={this.onboardingDemoRef} server={project.server} />)}
  //       />
  //     </React.Fragment>
  //   );
  // }

  renderSales() {
    return (
      <Block
        title='Every customer is different'
        description='Talk to our sales for a demo walkthrough and to determine how our solution can be customized for your needs.'
        buttonTitle='Get in touch'
        buttonLink='/contact/sales'
        imagePath='/img/support/sales.svg'
        mirror
      />
    );
  }
  renderPricing() {
    return (
      <React.Fragment>
        <ScrollAnchor scrollOnStateName='pricing' positionVertical='start' />
        <PricingPage />
      </React.Fragment>
    );
  }
}

export default withStyles(styles, { withTheme: true })(LandingPage);

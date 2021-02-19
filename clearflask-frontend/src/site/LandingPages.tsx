import { Container, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import PaymentIcon from '@material-ui/icons/AccountBalance';
import OncallIcon from '@material-ui/icons/Alarm';
import ContentDeliveryIcon from '@material-ui/icons/Cached';
import ApiIcon from '@material-ui/icons/Code';
import BlogIcon from '@material-ui/icons/Description';
import ClientIcon from '@material-ui/icons/Devices';
import ServerIcon from '@material-ui/icons/Dns';
import RoadmapIcon from '@material-ui/icons/EqualizerRounded';
/** Alternative: FreeBreakfast */
import DonationIcon from '@material-ui/icons/FavoriteBorder';
import FeedbackIcon from '@material-ui/icons/Feedback';
import BackupIcon from '@material-ui/icons/FileCopy';
import KnowledgeIcon from '@material-ui/icons/Help';
import EncryptionIcon from '@material-ui/icons/Https';
import MoreIcon from '@material-ui/icons/MoreHoriz';
import NotificationIcon from '@material-ui/icons/Notifications';
import CommunityIcon from '@material-ui/icons/People';
import QuestionIcon from '@material-ui/icons/QuestionAnswer';
import BillingIcon from '@material-ui/icons/Receipt';
import VisibilityIcon from '@material-ui/icons/RecordVoiceOver';
import RespondIcon from '@material-ui/icons/ReplyAll';
import SearchIcon from '@material-ui/icons/Search';
import AnalyticsIcon from '@material-ui/icons/ShowChart';
import StorageIcon from '@material-ui/icons/Storage';
import VoteIcon from '@material-ui/icons/ThumbsUpDown';
import AntiSpamIcon from '@material-ui/icons/VerifiedUser';
import PrivacyIcon from '@material-ui/icons/VisibilityOff';
import WidgetIcon from '@material-ui/icons/Widgets';
import classNames from 'classnames';
import React, { Suspense, useRef } from 'react';
import { Provider } from 'react-redux';
import * as Client from '../api/client';
import AppThemeProvider from '../app/AppThemeProvider';
import CommentList from '../app/comps/CommentList';
import PostStatusIframe from '../app/PostStatusIframe';
import DividerCorner from '../app/utils/DividerCorner';
import Loading from '../app/utils/Loading';
import { Device } from '../common/DeviceContainer';
import FakeBrowser from '../common/FakeBrowser';
import { importFailed, importSuccess } from '../Main';
import Block from './landing/Block';
import BlockContent from './landing/BlockContent';
import Demo from './landing/Demo';
import Hero from './landing/Hero';
import HorizontalPanels from './landing/HorizontalPanels';
import OnboardingControls, { setInitSignupMethodsTemplate } from './landing/OnboardingControls';
import OnboardingDemo from './landing/OnboardingDemo';
import PrioritizationControlsCredits from './landing/PrioritizationControlsCredits';
import PrioritizationControlsExpressions from './landing/PrioritizationControlsExpressions';
import PrioritizationControlsVoting from './landing/PrioritizationControlsVoting';
import RoadmapControls from './landing/RoadmapControls';
import TemplateDemoWithControls from './landing/TemplateDemo';
import PricingPage, { TrialInfoText } from './PricingPage';

const WorkflowPreview = React.lazy(() => import('../common/config/settings/injects/WorkflowPreview' /* webpackChunkName: "WorkflowPreview" */).then(importSuccess).catch(importFailed));

const useStyles = makeStyles((theme: Theme) => createStyles({
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
  smallBlock: {
    maxWidth: 'max-content',
    margin: 'auto',
  },
  apiText: {
    maxHeight: 50,
    fontSize: '40px',
    fontWeight: 'bold',
  },
  integrationImage: {
    maxHeight: 50,
  },
}));


export function LandingHero() {
  return (
    <Hero
      title='Listen to your users during product development'
      description='Feedback Management Tool with voting or crowd-funding to prioritize your roadmap'
      imagePath='/img/landing/hero.svg'
      imageHeight={588}
      mirror
      buttonTitle='Get started'
      buttonLink='/signup'
      buttonRemark={(
        <TrialInfoText />
      )}
    />
  );
}

export function PageHero(props: { title: string, description: string, imagePath: string }) {
  return (
    <Hero
      title={props.title}
      description={props.description}
      imagePath={props.imagePath}
      imageHeight={588}
      mirror
      buttonTitle='Get started'
      buttonLink='/signup'
      buttonRemark={(
        <TrialInfoText />
      )}
    />
  );
}

export function LandingClearFlaskDemo() {
  const classes = useStyles();
  return (
    <div className={classes.demo}>
      <Block
        noSpacing
        type='demoOnly'
        demo={(
          <FakeBrowser
            fixedHeight={500}
          >
            <iframe
              title='Demo: ClearFlask Feedback'
              src={`${window.location.protocol}//feedback.${window.location.host}`}
              width='100%'
              height='100%'
              frameBorder={0}
            />
          </FakeBrowser>
        )}
      />
    </div>
  );
}

export function LandingDemo() {
  const classes = useStyles();
  return (
    <div className={classes.demo}>
      <TemplateDemoWithControls />
    </div>
  );
}

export function LandingLoop() {
  const classes = useStyles();
  return (
    <div className={classes.overlapContainer}>
      <div className={classes.textCircleContainer}>
        <div className={classes.textCircleItemContainer}>
          <BlockContent
            className={classNames(classes.textCircleItemOne, classes.textCircleItem)}
            variant='content'
            titleCmpt='div'
            title='Collect feedback'
            description={(
              <div className={classNames(classes.pointsContainer, classes.pointsContainerMinor)}>
                <div>Ask your customer to influence your product decisions.</div>
                <div className={classes.point}>
                  <WidgetIcon fontSize='inherit' className={classes.pointIconSmall} />
                  <div>Seamless integration with your product</div>
                </div>
                <div className={classes.point}>
                  <AnalyticsIcon fontSize='inherit' className={classes.pointIconSmall} />
                  <div>Customer segmentation and Analytics</div>
                </div>
              </div>
            )}
          // buttonTitle='Learn more'
          // buttonOnClick={() => this.setState({ scrollTo: 'collect' })}
          />
        </div>
        <div className={classes.textCircleItemContainer}>
          <BlockContent
            className={classNames(classes.textCircleItemTwo, classes.textCircleItem)}
            variant='content'
            titleCmpt='div'
            title='Give a proportionate voice'
            description={(
              <div className={classNames(classes.pointsContainer, classes.pointsContainerMinor)}>
                <div>Prioritize your roadmap based on customer's value</div>
                <div className={classes.point}>
                  <VoteIcon fontSize='inherit' className={classes.pointIconSmall} />
                  <div>User vote</div>
                </div>
                <div className={classes.point}>
                  <PaymentIcon fontSize='inherit' className={classes.pointIconSmall} />
                  <div>Credit System</div>
                </div>
              </div>
            )}
          // buttonTitle='Learn more'
          // buttonOnClick={() => this.setState({ scrollTo: 'prioritize' })}
          />
        </div>
        <div className={classNames(classes.textCircleItemContainer, classes.textCircleItemThreeContainer)}>
          <BlockContent
            className={classNames(classes.textCircleItemThree, classes.textCircleItem)}
            variant='content'
            titleCmpt='div'
            title='Engage your customer'
            description={(
              <div className={classNames(classes.pointsContainer, classes.pointsContainerMinor)}>
                <div>Build a community around your product development</div>
                <div className={classes.point}>
                  <RoadmapIcon fontSize='inherit' className={classes.pointIconSmall} style={{ transform: 'rotate(180deg)' }} />
                  <div>Show off your Product Roadmap</div>
                </div>
                <div className={classes.point}>
                  <NotificationIcon fontSize='inherit' className={classes.pointIconSmall} />
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
        className={classes.circleContainer}
        style={{ zIndex: 1 }}
      >
        <span className={classes.circle} />
      </div>
    </div>
  );
}

export function LandingCollectFeedbackHero(props: { isHero?: boolean }) {
  return (
    <Demo
      variant={props.isHero ? 'hero' : 'heading-main'}
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
      {...(props.isHero ? {} : {
        buttonTitle: 'Learn more',
        buttonLink: '/product/collect',
      })}
    />
  );
}

export function LandingCollectFeedback() {
  return (
    <React.Fragment>
      <LandingCollectFeedbackHero isHero />
      <HorizontalPanels wrapBelow='lg' maxWidth='lg' maxContentWidth='sm' staggerHeight={0}>
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
          title='Integrate with your product or tools'
          description='Provide your sales, support, engineering team an opportunity to voice their suggestions. Capture feedback from other channels and record it on-behalf of users.'
          icon={(<WidgetIcon />)}
          buttonTitle='See integrations'
          buttonLink='/product/integrations'
        />
      </HorizontalPanels>
      <Block
        title='Collect'
        description='collect, embed in iframe, use API, internal feedback'
      />
      <Block
        title='Feature request tracking'
        description=''
        buttonTitle='Learn more'
        buttonLink='/solutions/feature-request-tracking'
        mirror
      />
      <Block
        title='Internal feedback'
        description=''
        buttonTitle='Learn more'
        buttonLink='/solutions/internal-feedback'
      />
      <Block
        title='Idea management'
        description=''
        buttonTitle='Learn more'
        buttonLink='/solutions/idea-management'
        mirror
      />
      <Block
        title='Crowd-funding'
        description=''
        buttonTitle='Learn more'
        buttonLink='/solutions/crowd-funding'
      />
    </React.Fragment>
  );
}


export function LandingPrioritizationHero(props: { isHero?: boolean }) {
  return (
    <Demo
      variant={props.isHero ? 'hero' : 'heading-main'}
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
      {...(props.isHero ? {} : {
        buttonTitle: 'Learn more',
        buttonLink: '/product/analyze',
      })}
    />
  );
}

export function LandingPrioritization() {
  const classes = useStyles();
  return (
    <React.Fragment>
      <LandingPrioritizationHero isHero />
      <LandingPrioritizationTypes />
      <Block
        // variant='content'
        title='Give credits based on customer value'
        description='Decide which customers deserve your attention. Typically credits are issued based on monetary contribution and can be automatically issued with our API.'
        alignItems='center'
        demo={(
          <div className={classes.pointsContainer}>
            <div className={classes.point}>
              <PaymentIcon fontSize='inherit' className={classes.pointIcon} />
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
            <div className={classes.point}>
              <DonationIcon fontSize='inherit' className={classes.pointIcon} />
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
            <div className={classes.point}>
              <ApiIcon fontSize='inherit' className={classes.pointIcon} />
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
      <Block
        title="Gauge users's reactions to features"
        description=''
      />
      <Block
        title='Communication channel with the exact customers you need'
        description='Validate solutions, recruit beta users, shape upcoming features'
      />
      <Block
        title='Segmentation'
        description=''
        postStatusId='segmentation'
      />
      <Block
        title='Identify top ideas'
        description=''
      />
      <Block
        title=''
        description=''
      />
    </React.Fragment>
  );
}

export function LandingPrioritizationTypes() {
  return (
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
  );
}

export function LandingCaseStudies() {
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

export function LandingEngagementHero(props: { isHero?: boolean }) {
  return (
    <Demo
      title='Build a community around your product'
      description='Whether you are starting out or have a product on the market, keep your users updated at every step. Let them be involved in your decision making and shape your product.'
      variant={props.isHero ? 'hero' : 'heading-main'}
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
      {...(props.isHero ? {} : {
        buttonTitle: 'Learn more',
        buttonLink: '/product/activate',
      })}
    />
  );
}

export function LandingEngagementRoadmap() {
  return (
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
  );
}

export function LandingEngagement() {
  return (
    <React.Fragment>
      <LandingEngagementHero isHero />
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
      <LandingEngagementRoadmap />
      <Block
        title='Understand potential customers'
        description=''
      />
      <Block
        title='Bring back churned customers'
        description=''
      />
      <Block
        title='Notify the right people'
        description=''
      />
      <Block
        title='Show status for future ideas'
        description=''
      />
      <Block
        title='Roadmap changes'
        description=''
      />
    </React.Fragment>
  );
}

export function LandingCustomizeHero(props: { isHero?: boolean }) {
  return (
    <Block
      title='Make it your own'
      imagePath='/img/landing/customize.svg'
      mirror
      imageStyle={{ paddingBottom: 0, maxWidth: 700 }}
      variant={props.isHero ? 'hero' : 'heading-main'}
      description='Our product is based on customizability to fit your specific needs. We are happy to meet your needs if a specific use case is not yet covered.'
      alignItems='flex-start'
      {...(props.isHero ? {} : {
        buttonTitle: 'Learn more',
        buttonLink: '/product/customize',
      })}
    />
  );
}

export function LandingCustomize() {
  return (
    <React.Fragment>
      <LandingCustomizeHero isHero />
      <HorizontalPanels wrapBelow='lg' maxContentWidth='sm' maxWidth='lg' staggerHeight={0}>
        <LandingCustomizeContent />
        <LandingCustomizeWorkflow />
        <LandingCustomizeLayout />
        {/* {this.renderCustomizeOther()} */}
      </HorizontalPanels>
      <Block
        title='Define custom content'
        description=''
        mirror
      />
      <Block
        title='Prioritization'
        description=''
        mirror
      />
      <LandingPrioritizationTypes />
      <Block
        title='Workflow'
        description=''
        mirror
      />
      <Block
        title='Tagging'
        description=''
        mirror
      />
      <Block
        title='Pages and Menu'
        description='Panel Board Explorer'
        mirror
      />
      <Block
        title='Page layout'
        description='Panel Board Explorer'
        mirror
      />
      <Block
        title='Look and feel, style'
        description=''
        mirror
      />
    </React.Fragment>
  );
}

export function LandingCustomizeContent() {
  const classes = useStyles();
  return (
    <Container maxWidth='xs'>
      <Block
        type='column'
        variant='heading'
        title='Define Custom content'
        description='Define a content type to hold a particular set of data. Each type can have different behavior and accessibility by users and moderators.'
      />
      <div className={classNames(classes.pointsContainer, classes.pointsContainerMinor)}>
        <div className={classes.pointSmall}>
          <FeedbackIcon fontSize='inherit' className={classes.pointIconSmall} />
          <div>User feedback</div>
        </div>
        <div className={classes.pointSmall}>
          <BlogIcon fontSize='inherit' className={classes.pointIconSmall} />
          <div>Blog entry</div>
        </div>
        <div className={classes.pointSmall}>
          <QuestionIcon fontSize='inherit' className={classes.pointIconSmall} />
          <div>Question &amp; Answer</div>
        </div>
        <div className={classes.pointSmall}>
          <KnowledgeIcon fontSize='inherit' className={classes.pointIconSmall} />
          <div>Knowledge Base article</div>
        </div>
        <div className={classes.pointSmall}>
          <MoreIcon fontSize='inherit' className={classes.pointIconSmall} />
        </div>
      </div>
    </Container>
  );
}

export function LandingIntegrations() {
  const classes = useStyles();
  return (
    <React.Fragment>
      <Hero
        title='Integrate with your tools'
        description=''
        imagePath='/img/landing/integration.svg'
      />
      <HorizontalPanels wrapBelow='sm' maxContentWidth='sm' maxWidth='md' staggerHeight={200}>
        <BlockContent
          variant='content'
          title='API'
          description='Integrate any service directly with our API'
          icon={(
            <Typography className={classes.apiText}>{'{ }'}</Typography>
          )}
          className={classes.smallBlock}
          buttonTitle='See docs'
          buttonLinkExt={`${window.location.protocol}//${window.location.host}/api`}
        />
        <BlockContent
          variant='content'
          title='Zapier'
          description='Easily connect with 2000+ apps without any coding.'
          icon={(
            <img
              alt=''
              className={classes.integrationImage}
              src='/img/landing/zapier.png'
            />
          )}
          className={classes.smallBlock}
          postStatusId='zapier-integration-rfs'
        />
      </HorizontalPanels>
      <HorizontalPanels wrapBelow='sm' maxContentWidth='sm' maxWidth='md' staggerHeight={-200}>
        <BlockContent
          variant='content'
          title='Hotjar'
          description='Analyze how your users are providing feedback to you.'
          icon={(
            <img
              alt=''
              className={classes.integrationImage}
              src='/img/landing/hotjar.png'
            />
          )}
          className={classes.smallBlock}
          buttonTitle='Setup'
          buttonLink='/dashboard/settings/integrations'
        />
        <BlockContent
          variant='content'
          title='Google Analytics'
          description='Extend your Analytics reach to feedback pages'
          icon={(
            <img
              alt=''
              className={classes.integrationImage}
              src='/img/landing/googleanalytics.svg'
            />
          )}
          className={classes.smallBlock}
          buttonTitle='Setup'
          buttonLink='/dashboard/settings/integrations'
        />
      </HorizontalPanels>
      <HorizontalPanels wrapBelow='sm' maxContentWidth='sm' maxWidth='md'>
        <BlockContent
          variant='content'
          title='Intercom Messenger'
          description='Show the Intercom messenger across feedback pages'
          icon={(
            <img
              alt=''
              className={classes.integrationImage}
              src='/img/landing/intercom.png'
            />
          )}
          className={classes.smallBlock}
          buttonTitle='Setup'
          buttonLink='/dashboard/settings/integrations'
        />
        <BlockContent
          variant='content'
          title='Intercom Feedback'
          description='Submit feedback directly within the Intercom Messenger'
          icon={(
            <img
              alt=''
              className={classes.integrationImage}
              src='/img/landing/intercom.png'
            />
          )}
          className={classes.smallBlock}
          postStatusId='intercom-integration-mbf'
        />
      </HorizontalPanels>
      <HorizontalPanels wrapBelow='sm' maxContentWidth='sm' maxWidth='md' staggerHeight={-200}>
        <BlockContent
          variant='content'
          title='Slack'
          description='Get updates directly in Slack when a post is created, updated, commented.'
          icon={(
            <img
              alt=''
              className={classes.integrationImage}
              src='/img/landing/slack.png'
            />
          )}
          className={classes.smallBlock}
          postStatusId='slack-integration-qgn'
        />
        <BlockContent
          variant='content'
          title='Stripe'
          description='Give credits to your users when they make a purchase with you.'
          icon={(
            <img
              alt=''
              className={classes.integrationImage}
              src='/img/landing/stripe.png'
            />
          )}
          className={classes.smallBlock}
          postStatusId='stripe-integration-fx9'
        />
      </HorizontalPanels>
      <HorizontalPanels wrapBelow='sm' maxContentWidth='sm' maxWidth='md' staggerHeight={200}>
        <BlockContent
          variant='content'
          title='Patreon'
          description='Give credits to your users when they make a donation.'
          icon={(
            <img
              alt=''
              className={classes.integrationImage}
              src='/img/landing/patreon.png'
            />
          )}
          className={classes.smallBlock}
          postStatusId='patreon-integration-pak'
        />
        <div />
      </HorizontalPanels>
    </React.Fragment>
  );
}

export function LandingCustomizeWorkflow() {
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

export function LandingCustomizeLayout() {
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

export function LandingCustomizeOther() {
  const onboardingDemoRef = useRef(null);
  return (
    <React.Fragment>
      <Demo
        variant='heading'
        type='column'
        title='Choose sign-up options'
        description='Introduce least amount of friction by choosing the right sign-up options for your product.'
        initialSubPath='/embed/demo'
        demoFixedWidth={420}
        template={templater => {
          setInitSignupMethodsTemplate(templater);
          templater.styleWhite();
        }}
        controls={project => (<OnboardingControls onboardingDemoRef={onboardingDemoRef} templater={project.templater} />)}
        demo={project => (<OnboardingDemo defaultDevice={Device.Desktop} innerRef={onboardingDemoRef} server={project.server} />)}
      />
    </React.Fragment>
  );
}

export function LandingFeatureRequestTracking() {
  return (
    <React.Fragment>
      <Hero
        title='Feature Request Tracking'
        description='Tool to keep organized and drive your product forward'
        imagePath='/img/landing/featurerequest.svg'
      />
      <Block
        title='Centralize all your feature requests'
        description='A dedicated portal for users to share and discuss new and upcoming product features. Easily collect feedback on-behalf of your users arriving from other channels.'
      />
      <Block
        title='Prioritize features'
        description='Give customers a voice to tell you the importance of a particular feature.'
        mirror
      />
      <HorizontalPanels wrapBelow='md' maxContentWidth='xs' maxWidth='md'>
        <BlockContent
          title='Idea validation'
          description='Get a sense of how successful a feature will be prior to any development work.'
        />
        <BlockContent
          title='Recruit Beta users'
          description='Easily find users that are willing to test out your upcoming feature before you roll it out.'
        />
        <BlockContent
          title='Just talk'
          description='Discuss the ins and outs of any topic directly with your customers. They will appreciate interacting with a human behind a product.'
        />
      </HorizontalPanels>
      <Block
        title='Close the loop with customers'
      />
      <HorizontalPanels wrapBelow='md' maxContentWidth='xs' maxWidth='md'>
        <BlockContent
          title='Keep users engaged'
          description=''
        />
        <BlockContent
          title='Visualize with a Roadmap'
          description='High-level overview of the features currently in your pipeline for users to get an idea of what is going on.'
          buttonTitle='See a Roadmap'
          buttonLink='/solutions/public-roadmap'
        />
      </HorizontalPanels>
      <Block
        title='Internal feedback'
        description=''
        buttonTitle='See how'
        buttonLink='/solutions/interal-feedback'
      />
    </React.Fragment>
  );
}

export function LandingPublicRoadmap() {
  return (
    <React.Fragment>
      <Hero
        title='Public Roadmap'
        description='Transparency between development and customers for stronger ties with your community.'
        imagePath='/img/landing/roadmap2.svg'
      />
      <Block
        title='Clear and concise'
        description='Show that your project is active'
      />
      <Block
        title='Asking for feature requests'
        description=''
        mirror
      />
      <Block
        title='Let customers be notified'
        description=''
      />
      <Block
        title='Embrace discussions'
        description='<Show threaded comments>'
        mirror
      />
    </React.Fragment>
  );
}

export function LandingCrowdFunding() {
  return (
    <React.Fragment>
      <Hero
        title='Transparent Feature Crowdfunding'
        description='Credit-system to reward your paying customers with a voice to shape your product.'
        imagePath='/img/landing/crowdfund.svg'
      />
      <Block
        title='Issue credits'
        description='When a customer makes a payment on your site, issue them ClearFlask credits to spend on ideas.'
        alignItems='center'
        demo={(
          <DividerCorner title='Transaction history' height='100%'>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell key='description'>Description</TableCell>
                  <TableCell key='amount' align='right'>Amount</TableCell>
                  <TableCell key='balance' align='right'>Account balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell key='description'>Credits for July 2021</TableCell>
                  <TableCell key='amount'>$50.00</TableCell>
                  <TableCell key='balance'>$70.00</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell key='description'>Fund 'Jira Integration'</TableCell>
                  <TableCell key='amount' style={{ color: '#d50000' }}>($80.00)</TableCell>
                  <TableCell key='balance'>$20.00</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell key='description'>Credits for June 2021</TableCell>
                  <TableCell key='amount'>$50.00</TableCell>
                  <TableCell key='balance'>$100.00</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell key='description'>Credits for May 2021</TableCell>
                  <TableCell key='amount'>$50.00</TableCell>
                  <TableCell key='balance'>$50.00</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </DividerCorner>
        )}
      />
      <Block
        alignItems='center'
        title='Let them prioritize'
        description='Let your users decide where to spend their credits.'
        mirror
        imagePath='/img/landing/demo-crowdfund.png'
        imageStyle={{ width: 'unset' }}
      />
      <Block
        title='Works best with'
        description='Products with a paid subscription are most suitable for using a credit-system.'
      />
      <HorizontalPanels wrapBelow='md' maxContentWidth='xs' maxWidth='lg'>
        <BlockContent
          title='SAAS Products'
          description='Most common use case is to give SAAS customers credits based on their subscription'
        />
        <BlockContent
          title='Donation-based / Freemium'
          description='Let users with the highest contributions dictate where your product should go.'
          buttonTitle='Learn more'
          buttonLink='/solutions/content-creator-forum'
        />
        <BlockContent
          title='Commercial Support'
          description='Issue credits as support allowance they can spend to receive support from you.'
          buttonTitle='Learn more'
          buttonLink='/solutions/commercial-support-management'
        />
      </HorizontalPanels>
      <Block
        alignItems='center'
        title='Credits as a selling point'
        description='Include credits as value-added to your paid plan or product. Let them know your product is driven by paying customers.'
        mirror
        imagePath='/img/landing/demo-advertise-credits.png'
        imageStyle={{ width: 'unset' }}
      />
      <Block
        title='Allow purchasing additional credits'
        description='Entice your users to purchase additional credits to get a particular feature implemented or to support your product in general.'
      />
      <Block
        title='Transparency in feature prioritization'
        description='Make it clear your product is actively supported and shaped by paying customers.'
        mirror
        imagePath='/img/landing/demo-funding-roadmap.png'
        imageStyle={{ width: 'unset' }}
      />
    </React.Fragment>
  );
}

export function LandingInternalFeedback() {
  return (
    <React.Fragment>
      <Hero
        title='Internal Feedback'
        description='Collect feedback from within your organization or customer-base'
        imagePath='/img/landing/internalfeedback.svg'
      />
      <Block
        title='Keep all your data private'
        description='Setup privacy settings so only authorized users can see and post feedback.'
      />
      <Block
        title='Stop forgetting what your coworker requested'
        description='Eliminate the mess of keeping track of feedback via starred emails, post-it notes, and text documents. Keep it all in one place.'
        mirror
      />
      <Block
        title='Keep your company informed'
        description='Let your co-workers see your workload in order to understand your prioritization of their requests.'
      />
    </React.Fragment>
  );
}

export function LandingIdeaManagement() {
  return (
    <React.Fragment>
      <Hero
        title='Idea Management'
        description=''
        imagePath='/img/landing/ideas.svg'
      />
      <Block
        title='Embrace transparency'
        description=''
      />
      <Block
        title='Merge all channels into one place'
        description=''
        mirror
      />
      <Block
        title='Submit idea on behalf of others'
        description=''
      />
      <Block
        title='Shape ideas from others'
        description=''
        mirror
      />
      <Block
        title='Give back feedback to the idea creator'
        description=''
      />
    </React.Fragment>
  );
}

export function LandingContentCreator() {
  return (
    <React.Fragment>
      <Hero
        title='Content Creator Forum'
        description='Reward your fans with a voice proportional to their contributions. Let your biggest fans shape your future creations.'
      />
      <Block
        title='Threaded conversations'
        description=''
      />
      <Block
        title='Idea bucket'
        description=''
      />
      <Block
        title='Feedback from your most valued fans, Credit based prioritization'
        description='Give your fans credits every time they give you a donation or make a subscription payment. Use those credits to prioritize ideas.'
      />
      <Block
        title='How it works'
        description='Infographic: show Patreon/Ko-fi -> ClearFlask issues credits -> Fan prioritizes ideas'
      />
      <Block
        title='Single Sign-On'
        description=''
      />
    </React.Fragment>
  );
}

export function LandingCommercialSupportManagement() {
  return (
    <React.Fragment>
      <Hero
        title='Commercial Support Management'
        description=''
      />
      <Block
        title=''
        description=''
      />
      <Block
        title=''
        description=''
      />
      <Block
        title=''
        description=''
      />
      <Block
        title=''
        description=''
      />
    </React.Fragment>
  );
}

export function LandingGrowWithUs() {
  return (
    <React.Fragment>
      <Hero
        title='Grow With Us'
        description='Built on scalable infrastructure to grow with your needs.'
        imagePath='/img/landing/architecture.svg'
      />
      <Block
        title='Reliability and scalability'
        description='Our automated systems are continuously monitoring the health to scale up resources as needed or to notify our engineers of an issue.'
      />
      <HorizontalPanels wrapBelow='md' maxContentWidth='xs' maxWidth='lg'>
        <BlockContent
          icon={(<OncallIcon />)}
          title='On-call'
          description='Our engineers are on-call 24/7 to resolve any elevated issues brought up by our automatic monitoring.'
        />
        <BlockContent
          icon={(<ServerIcon />)}
          variant='content'
          title='Compute'
          description='All of our server infrastructure is auto-scaled to meet your traffic demand.'
        />
        <BlockContent
          icon={(<StorageIcon />)}
          variant='content'
          title='Storage'
          description='Data is stored on a NoSQL Dynamo database and distributed Object Storage S3 that allows us to scale with ease.'
        />
        <BlockContent
          icon={(<BackupIcon />)}
          variant='content'
          title='Backups'
          description='All of our data is continuously backed up in case of an incident to protect your data.'
        />
      </HorizontalPanels>
      <Block
        title='Responsiveness'
        description='Bringing together the right tools for the best User Experience'
      />
      <HorizontalPanels wrapBelow='md' maxContentWidth='xs' maxWidth='lg'>
        <BlockContent
          icon={(<ContentDeliveryIcon />)}
          variant='content'
          title='Content Delivery Network'
          description='ClearFlask is hosted by CloudFront: a large network of globally distributed PoPs that deliver low-latency performance and high-availability.'
        />
        <BlockContent
          icon={(<SearchIcon />)}
          variant='content'
          title='Search engine'
          description='We use ElasticSearch: a powerful search engine to provide you relevant results within large datasets. It also ensures your users are not submitting duplicate ideas.'
        />
        <BlockContent
          icon={(<ClientIcon />)}
          variant='content'
          title='Client-side Framework'
          description='Once you load our page, we use React to deliver a responsive interface to your users with a Material design that is pleasing to use and keeps your users engaged.'
        />
        <BlockContent
          icon={(<ServerIcon />)}
          variant='content'
          title='Server-Side Rendering'
          description='Web pages are pre-rendered server-side to minimize the first page load on the client and improve SEO.'
          postStatusId='serverside-rendering-vni'
        />
      </HorizontalPanels>
      <Block
        title='Security and Privacy'
        description='Both Security and Privacy is critically important to us. We are thoughtful about the personal information we ask you to provide and we are building our systems with security in mind.'
      />
      <HorizontalPanels wrapBelow='md' maxContentWidth='xs' maxWidth='lg'>
        <BlockContent
          icon={(<EncryptionIcon />)}
          variant='content'
          title='Encryption'
          description='All pages are only accessible over encrypted channels. If you use a custom domain, we automatically generate a certificate for you via LetsEncrypt.'
        />
        <BlockContent
          icon={(<AntiSpamIcon />)}
          variant='content'
          title='Anti-Spam'
          description='Our backend system is monitoring unusual behavior and will issue Anti-Spam measures. Our team has past experience working on Anti-spam at a popular messenger.' />
        <BlockContent
          icon={(<PrivacyIcon />)}
          variant='content'
          title='Do Not Track'
          description='We respect the Do Not Track (DNT) flag that respects your privacy.'
          buttonTitle='Privacy Policy'
          buttonLink='/privacy-policy'
        />
        <BlockContent
          icon={(<BillingIcon />)}
          variant='content'
          title='Billing system'
          description='For reliable billing, we use KillBill to handle managing your final invoice and processing your payments.'
        />
      </HorizontalPanels>
    </React.Fragment>
  );
}

// export function LandingAboutUs() {
//   return (
//     <React.Fragment>
//       <Hero
//         title='Smotana company'
//         description='Our team at Smotana is based out of Mongolia. We are working on local projects as well'
//         imagePath='/img/landing/smotana.svg'
//         imageHeight={400}
//         buttonTitle='Visit'
//         buttonLinkExt='https://smotana.com'
//       />
//       <Block
//         title='Based in Mongolia'
//         description=''
//         imagePath='/img/landing/ub.png'
//         imageStyle={{
//           maxWidth: 400,
//           border: '1px solid black',
//           borderRadius: 15,
//           padding: 0,
//         }}
//         mirror
//       />
//     </React.Fragment>
//   );
// }

export function LandingSales() {
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
export function LandingPricing() {
  return (
    <React.Fragment>
      <PricingPage />
    </React.Fragment>
  );
}

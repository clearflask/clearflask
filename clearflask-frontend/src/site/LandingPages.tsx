/// <reference path="../@types/transform-media-imports.d.ts"/>
import loadable from '@loadable/component';
import { Container, IconButton, Size, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import PaymentIcon from '@material-ui/icons/AccountBalance';
import AddCommentIcon from '@material-ui/icons/AddComment';
import OncallIcon from '@material-ui/icons/Alarm';
import LifecycleIcon from '@material-ui/icons/Autorenew';
import BuildIcon from '@material-ui/icons/Build';
import ContentDeliveryIcon from '@material-ui/icons/Cached';
import CategoryIcon from '@material-ui/icons/Category';
import ApiIcon from '@material-ui/icons/Code';
import BlogIcon from '@material-ui/icons/Description';
import ClientIcon from '@material-ui/icons/Devices';
import ServerIcon from '@material-ui/icons/Dns';
import EditIcon from '@material-ui/icons/Edit';
import EmailIcon from '@material-ui/icons/Email';
import LightbulbIcon from '@material-ui/icons/EmojiObjectsOutlined';
import RoadmapIcon from '@material-ui/icons/EqualizerRounded';
import FacebookIcon from '@material-ui/icons/Facebook';
/** Alternative: FreeBreakfast */
import DonationIcon from '@material-ui/icons/FavoriteBorder';
import FeedbackIcon from '@material-ui/icons/Feedback';
import BackupIcon from '@material-ui/icons/FileCopy';
import ForumIcon from '@material-ui/icons/Forum';
import GithubIcon from '@material-ui/icons/GitHub';
import EngageIcon from '@material-ui/icons/Hearing';
import KnowledgeIcon from '@material-ui/icons/Help';
import EncryptionIcon from '@material-ui/icons/Https';
import LinkIcon from '@material-ui/icons/Link';
import ContentCreatorIcon from '@material-ui/icons/LiveTv';
import MoreIcon from '@material-ui/icons/MoreHoriz';
import UpcomingFeaturesIcon from '@material-ui/icons/NewReleasesOutlined';
import NotificationIcon from '@material-ui/icons/Notifications';
import CommunityIcon from '@material-ui/icons/People';
import QuestionIcon from '@material-ui/icons/QuestionAnswer';
import BillingIcon from '@material-ui/icons/Receipt';
import IdeasIcon from '@material-ui/icons/RecordVoiceOver';
import RespondIcon from '@material-ui/icons/ReplyAll';
import SearchIcon from '@material-ui/icons/Search';
import AnalyticsIcon from '@material-ui/icons/ShowChart';
import StorageIcon from '@material-ui/icons/Storage';
import VoteIcon from '@material-ui/icons/ThumbsUpDown';
import AntiSpamIcon from '@material-ui/icons/VerifiedUser';
import PrivacyIcon from '@material-ui/icons/VisibilityOff';
import TransparentIcon from '@material-ui/icons/VisibilityOutlined';
import WidgetIcon from '@material-ui/icons/Widgets';
import CareersIcon from '@material-ui/icons/Work';
import classNames from 'classnames';
import React, { useRef, useState } from 'react';
import { Provider } from 'react-redux';
import ArchitectureImg from '../../public/img/landing/architecture.svg';
import CentralizeImg from '../../public/img/landing/centralize.svg';
import CommunityImg from '../../public/img/landing/community.svg';
import ComparisonImg from '../../public/img/landing/comparison.svg';
import CreatorImg from '../../public/img/landing/creator.svg';
import CrowdfundImg from '../../public/img/landing/crowdfund.svg';
import CustomizeImg from '../../public/img/landing/customize.svg';
import DemoAdvertiseCreditsImg from '../../public/img/landing/demo-advertise-credits.png';
import DemoAsUserImg from '../../public/img/landing/demo-as-user.png';
import DemoCrowdfundImg from '../../public/img/landing/demo-crowdfund.png';
import DemoCrowdfund2Img from '../../public/img/landing/demo-crowdfund2.png';
import DemoEmailNotificationImg from '../../public/img/landing/demo-email-notif.png';
import DemoEmailNotification2Img from '../../public/img/landing/demo-email-notif2.png';
import DemoExplorerImg from '../../public/img/landing/demo-explorer.png';
import DemoFundingRoadmapImg from '../../public/img/landing/demo-funding-roadmap.png';
import DemoNoBalanceImg from '../../public/img/landing/demo-no-balance.png';
import DemoProjectPrivateImg from '../../public/img/landing/demo-project-private.png';
import DemoRoadmapImg from '../../public/img/landing/demo-roadmap.png';
import DemoTaggingImg from '../../public/img/landing/demo-tagging.png';
import DemoTagging2Img from '../../public/img/landing/demo-tagging2.png';
import FeatureRequestImg from '../../public/img/landing/featurerequest.svg';
import HeroImg from '../../public/img/landing/hero.svg';
import HtmlImg from '../../public/img/landing/html.png';
import IdeasImg from '../../public/img/landing/ideas.svg';
import InstallImg from '../../public/img/landing/install.svg';
import IntegrationImg from '../../public/img/landing/integration.svg';
import InternalFeedbackImg from '../../public/img/landing/internalfeedback.svg';
import ListenImg from '../../public/img/landing/listen.svg';
import LoopImg from '../../public/img/landing/loop.svg';
import RoadmapImg from '../../public/img/landing/roadmap.svg';
import Roadmap2Img from '../../public/img/landing/roadmap2.svg';
import SupportImg from '../../public/img/landing/support.svg';
import ValueImg from '../../public/img/landing/value.svg';
import SalesImg from '../../public/img/support/sales.svg';
import * as Client from '../api/client';
import AppThemeProvider from '../app/AppThemeProvider';
import CommentList from '../app/comps/CommentList';
import PostStatusIframe from '../app/PostStatusIframe';
import DividerCorner from '../app/utils/DividerCorner';
import Loading from '../app/utils/Loading';
import ClosablePopper from '../common/ClosablePopper';
import Templater from '../common/config/configTemplater';
import CreditView from '../common/config/CreditView';
import { Device } from '../common/DeviceContainer';
import FakeBrowser from '../common/FakeBrowser';
import Hr from '../common/Hr';
import GoogleIcon from '../common/icon/GoogleIcon';
import GuestIcon from '../common/icon/GuestIcon';
import { vh } from '../common/util/screenUtil';
import windowIso from '../common/windowIso';
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
import PricingPage, { TrialInfoText } from './PricingPage';

const WorkflowPreview = loadable(() => import(/* webpackChunkName: "WorkflowPreview" */'../common/config/settings/injects/WorkflowPreview').then(importSuccess).catch(importFailed), { fallback: (<Loading />) });

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
  demoEmbedButtons: {
    width: '100%',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  demoEmbedPopper: {
    height: 400,
    maxHeight: vh(90),
    width: 400,
    maxWidth: '90vw',
  },
  demoStatusEmbedText: {
    fontSize: '1.3em',
  },
  demoStatusEmbedContainer: {
    width: '100%',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  demoStatusEmbedIframe: {
    marginLeft: 10,
  },
  iconsContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  githubIcon: {
    fontSize: 21,
    margin: theme.spacing(0, 1),
  },
}));


export function LandingHero() {
  return (
    <Hero
      title='Listen to your users during product development'
      description='Feedback Management Tool to prioritize your roadmap'
      image={HeroImg}
      mirror
      buttonTitle='Get started'
      buttonLink='/signup'
      buttonRemark={(
        <TrialInfoText />
      )}
    />
  );
}

export function LandingClearFlaskDemo(props: Partial<React.ComponentProps<typeof Block>> & {
  fakeBrowserProps?: Partial<React.ComponentProps<typeof FakeBrowser>>,
}) {
  const classes = useStyles();
  const { fakeBrowserProps, ...blockProps } = props;
  return (
    <div className={classes.demo}>
      <Block
        demo={(
          <FakeBrowser
            fixedHeight={500}
            {...fakeBrowserProps}
          >
            <iframe
              title='Demo: ClearFlask Feedback'
              src={`${windowIso.location.protocol}//feedback.${windowIso.location.host}`}
              width='100%'
              height='100%'
              frameBorder={0}
            />
          </FakeBrowser>
        )}
        {...blockProps}
      />
    </div>
  );
}

export function LandingDemoEmbed(props: { path?: string, children: any }) {
  const [demoOpen, setDemoOpen] = useState<boolean>(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const classes = useStyles();
  return (
    <React.Fragment>
      <IconButton
        onClick={() => setDemoOpen(true)}
        ref={anchorRef}
      >
        {props.children}
      </IconButton>
      <ClosablePopper
        open={!!demoOpen}
        onClose={() => setDemoOpen(false)}
        placement='top'
        anchorEl={anchorRef.current}
        arrow
        clickAway
        paperClassName={classes.demoEmbedPopper}
      >
        <iframe
          title='Demo: ClearFlask Feedback'
          src={demoOpen ? `${windowIso.location.protocol}//feedback.${windowIso.location.host}/${props.path || ''}` : 'about:blank'}
          width='100%'
          height='100%'
          frameBorder={0}
        />
      </ClosablePopper>
    </React.Fragment>
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
      image={ListenImg}
      imageLocation='above'
      displayAlign='flex-start'
      // demoWrap='browser'
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
          description: 'To reduce eye-strain, please add a low-light option. ',
          similarSearchTerm: 'theme',
        },
      }}
      {...(props.isHero ? {} : {
        buttonTitle: 'Learn more',
        buttonLink: '/product/ask',
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
          icon={(<IdeasIcon />)}
        />
        <BlockContent
          variant='content'
          title='Customer segmentation and Analytics'
          description='Analyze your data with search, segment and filter to summarize feedback from target customers.'
          icon={(<AnalyticsIcon />)}
          postStatusId='customer-segmentation-and-analytics-pgi'
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
      <HorizontalPanels wrapBelow='md' maxWidth='lg' maxContentWidth='xs'>
        <Block
          variant='content'
          type='column'
          title='Feature request tracking'
          description=''
          buttonTitle='Learn more'
          buttonLink='/solutions/feature-request-tracking'
          mirror
        />
        <Block
          variant='content'
          type='column'
          title='Internal feedback'
          description=''
          buttonTitle='Learn more'
          buttonLink='/solutions/internal-feedback'
        />
        <Block
          variant='content'
          type='column'
          title='Idea management'
          description=''
          buttonTitle='Learn more'
          buttonLink='/solutions/idea-management'
          mirror
        />
      </HorizontalPanels>
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
      // demoWrap='browser'
      demoWrapPadding='40px 40px 40px 20px'
      image={ValueImg}
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
  return (
    <React.Fragment>
      <LandingPrioritizationHero isHero />
      <LandingPrioritizationTypes />
      <Block
        title='Give credits based on customer value'
        description='Decide which customers deserve your attention. Typically credits are issued based on monetary contribution and can be automatically issued with our API.'
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
          demoDisablePostOpen: true,
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
          demoDisablePostOpen: true,
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
          demoDisablePostOpen: true,
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
      alignItems='flex-start'
      initialSubPath='/embed/demo'
      demoFixedHeight={420}
      image={CommunityImg}
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
      demo={LandingCommentListDemo}
      {...(props.isHero ? {} : {
        buttonTitle: 'Learn more',
        buttonLink: '/product/activate',
      })}
    />
  );
}

function LandingCommentListDemo(project) {
  return (
    <Provider store={project.server.getStore()}>
      <AppThemeProvider
        seed='demo-community'
        isInsideContainer
      >
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
      image={RoadmapImg}
      imageLocation='above'
      imageStyle={{ maxWidth: 500, padding: 0, }}
      type='largeDemo'
      // demoWrap='browser'
      // demoWrapPadding={40}
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
        demoDisablePostOpen: true,
      }}
    // controls={project => (<RoadmapControls templater={project.templater} />)}
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
      image={CustomizeImg}
      mirror
      imageStyle={{ paddingBottom: 0, maxWidth: 700 }}
      variant={props.isHero ? 'hero' : 'heading-main'}
      description='Our product is highly customizable out of the box to fit your specific needs. If a specific use-case is not covered, we would love to hear from you.'
      alignItems={props.isHero ? 'flex-start' : 'center'}
      {...(props.isHero ? {} : {
        buttonTitle: 'Learn more',
        buttonLink: '/product/customize',
      })}
    />
  );
}

export function LandingCustomize() {
  const classes = useStyles();
  return (
    <React.Fragment>
      <LandingCustomizeHero isHero />
      <HorizontalPanels wrapBelow='lg' maxContentWidth='sm' maxWidth='lg' staggerHeight={0}>
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
              <CareersIcon fontSize='inherit' className={classes.pointIconSmall} />
              <div>Job postings</div>
            </div>
            <div className={classes.pointSmall}>
              <MoreIcon fontSize='inherit' className={classes.pointIconSmall} />
            </div>
          </div>
        </Container>
        <Container maxWidth='xs'>
          <Demo
            type='column'
            variant='heading'
            title='Match your product Workflow'
            description='Customize states, transitions, and behavior of each content type to match your workflow. Each state can also alter different behavior and accessibility.'
            template={templater => {
              templater.workflowFeatures(templater.demoCategory(), false, false);
              templater.styleWhite();
            }}
            demoFixedHeight={400}
            demoPreventInteraction
            demo={project => (
              <WorkflowPreview
                editor={project.editor}
                categoryIndex={0}
                isVertical
                hideCorner
                height='100%'
              />
            )}
          />
        </Container>
        <Container maxWidth='xs'>
          <Block
            title='Customize each page'
            description='Create custom pages and menus to fit the content your product needs. Use our page editor or inject your own HTML using Liquid template engine.'
            imageStyleOuter={{ padding: 'unset' }}
            image={HtmlImg}
            type='column'
            variant='heading'
          />
        </Container>
        {/* {this.renderCustomizeOther()} */}
      </HorizontalPanels>
      <HorizontalPanels wrapBelow='lg' maxContentWidth='sm' maxWidth='lg'>
        <Container maxWidth='xs'>
          <Demo
            title='Prioritization'
            description='Choose between voting, emoji expressions and crowd-funding for each of your content types.'
            type='column'
            variant='heading'
            alignItems='center'
            initialSubPath='/embed/demo'
            template={templater => templater.demoPrioritization('all')}
            mock={mocker => mocker.demoPrioritization()}
            settings={{
              demoFlashPostVotingControls: true,
              demoBlurryShadow: true,
              demoDisablePostOpen: true,
            }}
          />
        </Container>
        <Container maxWidth='xs'>
          <Block
            title='Tagging'
            description='Organize content into defined set of tags. Create tag groups and define rules how tags can be used.'
            imageStyleOuter={{ padding: 'unset' }}
            image={DemoTaggingImg}
            type='column'
            variant='heading'
          />
        </Container>
        <Container maxWidth='xs'>
          <Demo
            type='column'
            variant='heading'
            title='Look and feel'
            description='Match your product style with a custom palette, typography and branding.'
            initialSubPath='/embed/demo'
            demoWrap='browser-dark'
            demoPreventInteraction
            template={templater => {
              templater.demoPrioritization('none');
              templater.styleDark();
              templater.setFontFamily('serif');
            }}
            mock={mocker => mocker.demoPrioritization()}
            demoFixedHeight={180}
            demoFixedWidth={250}
            containerPortal
          />
        </Container>
      </HorizontalPanels>
      <Block
        title='Page elements'
        description='Each page can consist of several display elements. Choose between simple horizontal panels, Explorer or Board to present your content.'
      />
      <HorizontalPanels wrapBelow='lg' maxContentWidth='sm' maxWidth='lg'>
        <Block
          title='Explorer'
          description="Interactive vertical panel of content with a 'Create' and/or 'Search' corner. The Create corner allows users to add content while viewing similar content to minimize duplicates."
          image={DemoExplorerImg}
          imageStyleOuter={{ padding: 'unset' }}
          type='column'
        />
        <Block
          title='Board'
          description='Series of vertical panels allowing a Kanban style of content display. Typically used for a Roadmap view or state progression.'
          image={DemoRoadmapImg}
          imageStyleOuter={{ padding: 'unset' }}
          type='column'
        />
        {/* <Block
          title='Vertical Panels'
          description=''
          image={DemoVerticalPanelImg}
          imageStyleOuter={{ padding: 'unset' }}
          type='column'
        /> */}
      </HorizontalPanels>
      <Block
        title='And a lot more...'
        description="Sign up to see all the customizations. Remember if you don't find what you're looking for, we are here to help."
        mirror
      />
    </React.Fragment>
  );
}

export function LandingIntegrations() {
  const classes = useStyles();
  return (
    <React.Fragment>
      <Hero
        title='Integrations'
        description='Use with your existing tools.'
        image={IntegrationImg}
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
          buttonLinkExt={`${windowIso.location.protocol}//${windowIso.location.host}/api`}
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

export function LandingFeatureRequestTracking() {
  return (
    <React.Fragment>
      <Hero
        title='Feature Request Tracking'
        description='Tool to keep organized and drive your product forward'
        image={FeatureRequestImg}
      />
      <Block
        title='Centralize all your feature requests'
        description='A dedicated portal for users to share and discuss new and upcoming product features. Easily collect feedback on-behalf of your users arriving from other channels.'
        image={CentralizeImg}
        alignItems='center'
      />
      <Block
        title='Prioritize features'
        description='Give customers a voice to tell you the importance of a particular feature.'
        image={ValueImg}
        imageStyleOuter={{ paddingBottom: 'unset' }}
        alignItems='flex-start'
        mirror
      />
      <HorizontalPanels wrapBelow='md' maxContentWidth='xs' maxWidth='lg'>
        <BlockContent
          icon={(<LightbulbIcon />)}
          title='Idea validation'
          description='Get a sense of how successful a feature will be prior to any development work.'
        />
        <BlockContent
          icon={(<BuildIcon />)}
          title='Recruit Beta users'
          description='Easily find users that are willing to test out your upcoming feature before you roll it out.'
        />
        <BlockContent
          icon={(<ForumIcon />)}
          title='Just talk'
          description='Discuss the ins and outs of any topic directly with your customers. They will appreciate interacting with a human behind the product.'
        />
      </HorizontalPanels>
      <Block
        title='Close the loop with customers'
        description='The important part of collecting feedback is responding back to your customer ideas.'
        image={LoopImg}
        imageStyleOuter={{ paddingBottom: 'unset' }}
        alignItems='flex-start'
      />
      <HorizontalPanels wrapBelow='md' maxContentWidth='xs' maxWidth='md'>
        <BlockContent
          icon={(<EngageIcon />)}
          title='Keep users engaged'
          description="An update to customer's feedback shows good customer relations and may even bring back churned customers."
        />
        <BlockContent
          icon={(<RoadmapIcon style={{ transform: 'rotate(180deg)' }} />)}
          title='Visualize with a Roadmap'
          description='High-level overview of the features currently in your pipeline for users to get an idea of what is going on.'
          buttonTitle='See a Roadmap'
          buttonLink='/solutions/public-roadmap'
        />
      </HorizontalPanels>
      <Block
        title='Internal feedback'
        description='Collect feedback from a closed-group of people within your organization or customer-base'
        buttonTitle='See how'
        buttonLink='/solutions/internal-feedback'
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
        image={Roadmap2Img}
      />
      <Demo
        title='Include a public roadmap for your product'
        initialSubPath='/embed/demo'
        type='largeDemo'
        template={templater => templater.demoBoardPreset('development')}
        mock={mocker => mocker.demoBoard([
          { status: '0' }, { status: '0' }, { status: '0' }, { status: '0' },
          { status: '1' }, { status: '1' },
          { status: '2' }, { status: '2' }, { status: '2' },
        ])}
        settings={{
          demoBlurryShadow: true,
          demoDisablePostOpen: true,
        }}
      />
      <HorizontalPanels wrapBelow='lg' maxWidth='lg' maxContentWidth='sm' staggerHeight={0}>
        <BlockContent
          variant='content'
          icon={(<LightbulbIcon />)}
          title='Clear and concise'
          description="Simple view of your current progress and future plans. That's it!"
        />
        <BlockContent
          variant='content'
          icon={(<TransparentIcon />)}
          title='Transparency for customers and stakeholders'
          description='Commit to a customer-driven product development and keep your audience informed.'
        />
        <BlockContent
          variant='content'
          icon={(<UpcomingFeaturesIcon />)}
          title='Upcoming features'
          description='Let your community get excited about what you are working on. Keep them in-the-know of your hard work behind the scenes.'
        />
      </HorizontalPanels>
      <Block
        variant='content'
        title='Subscribe to updates'
        description='Keep users engaged with feature updates.'
        image={DemoEmailNotificationImg}
        imageScale={0.4}
        mirror
        alignItems='center'
      />
      <Demo
        title='Embrace discussions'
        description='Shape your features by directly communicating with your customer base.'
        alignItems='center'
        initialSubPath='/embed/demo'
        demoFixedHeight={420}
        template={templater => {
          templater.demoCategory();
          templater.styleWhite();
        }}
        settings={{
          // demoBlurryShadow: true,
        }}
        mock={(mocker, config) => mocker.mockFakeIdeaWithComments('ideaId')
          .then(() => mocker.mockLoggedIn())}
        demo={LandingCommentListDemo}
      />
      <Demo
        title='Customize'
        description='Change the columns, content, and labels. You can even create multiple roadmaps for different stakeholders.'
        initialSubPath='/embed/demo'
        type='largeDemo'
        template={templater => templater.demoBoardPreset('design')}
        mock={mocker => mocker.demoBoard([
          { status: '1' }, { status: '1' }, { status: '1' }, { status: '1' },
          { status: '2', extra: { expressions: { '👍': 7, '❤️': 4 } } },
          { status: '2', extra: { expressions: { '👍': 2, } } },
        ])}
        settings={{
          demoBlurryShadow: true,
          demoDisablePostOpen: true,
        }}
      />
    </React.Fragment>
  );
}

export function LandingCrowdFunding() {
  return (
    <React.Fragment>
      <Hero
        title='Feature Crowdfunding'
        description='Credit-system to reward your paying customers with a voice to shape your product.'
        image={CrowdfundImg}
      />
      <Block
        title='Link with your credit system'
        description='You can continue to use your existing payment platform. Link it with our system and decide when users will be issued credits.'
        alignItems='center'
        demo={(<LandingCreditSystemLinkOptions />)}
      />
      <Block
        title='Issue credits and spend'
        description='When a customer makes a payment on your site, issue them ClearFlask credits. They will be able to spend those credits on feature requests.'
        alignItems='center'
        mirror
        demo={(
          <LandingTransactionHistory items={[
            { description: 'Credits for May 2021', amount: 5000 },
            { description: 'Credits for June 2021', amount: 5000 },
            { description: "Fund 'Jira Integration'", amount: -8000 },
            { description: 'Credits for July 2021', amount: 5000 },
          ]} />
        )}
      />
      <Block
        title='Let them prioritize'
        description='Sit back and watch your users fund your ideas and decide where to spend their credits.'
        alignItems='center'
        image={DemoCrowdfundImg}
      />
      <Block
        title='Works best with'
        description='Products with a paid subscription are most suitable for using a credit-system.'
        image={ComparisonImg}
        imageStyleOuter={{ paddingBottom: 'unset' }}
        alignItems='flex-start'
        mirror
      />
      <HorizontalPanels wrapBelow='md' maxContentWidth='xs' maxWidth='lg'>
        <BlockContent
          icon={(<ApiIcon />)}
          title='SAAS Products'
          description='Most common use case is to give SAAS customers credits based on their subscription'
        />
        <BlockContent
          icon={(<DonationIcon />)}
          title='Donation-based / Freemium'
          description='Let users with the highest contributions dictate where your product should go.'
        />
        <BlockContent
          icon={(<ContentCreatorIcon />)}
          title='Content Creator'
          description='Reward your fans with a voice proportional to their contributions. Let your biggest fans shape your future creations.'
          buttonTitle='Learn more'
          buttonLink='/solutions/content-creator-forum'
        />
      </HorizontalPanels>
      <Block
        alignItems='center'
        title='Credits as a selling point'
        description='Include credits as value-added to your paid plan or product. Let them know your product is driven by paying customers.'
        mirror
        image={DemoAdvertiseCreditsImg}
      />
      <Block
        alignItems='center'
        title='Purchase additional credits'
        description='Entice your users to purchase additional credits to get a particular feature implemented or to support your product in general.'
        image={DemoNoBalanceImg}
      />
      <Block
        alignItems='center'
        title='Transparency in feature prioritization'
        description='Make it clear your product is actively supported and shaped by paying customers.'
        mirror
        image={DemoFundingRoadmapImg}
      />
    </React.Fragment>
  );
}

function LandingTransactionHistory(props: {
  reverse?: boolean;
  size?: Size,
  initialAmount?: number, items: Array<{
    description: string;
    amount: number;
  }>
}) {
  const credits = Client.CreditsToJSON({ formats: Templater.creditsCurrencyFormat() });
  var currAmt = props.initialAmount || 0;
  var transactions = props.items.map(item => {
    currAmt += item.amount;
    return (
      <TableRow>
        <TableCell key='description'>{item.description}</TableCell>
        <TableCell key='amount'><CreditView val={item.amount} credits={credits} /></TableCell>
        <TableCell key='balance'><CreditView val={currAmt} credits={credits} /></TableCell>
      </TableRow>
    );
  });
  if (props.reverse) {
    transactions = transactions.reverse();
  }
  return (
    <DividerCorner title='Transaction history' height='100%'>
      <Table size={props.size}>
        <TableHead>
          <TableRow>
            <TableCell key='description'>Description</TableCell>
            <TableCell key='amount' align='right'>Amount</TableCell>
            <TableCell key='balance' align='right'>Account balance</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions}
        </TableBody>
      </Table>
    </DividerCorner>
  );
}

function LandingCreditSystemLinkOptions(props: { donationFirst?: boolean }) {
  const classes = useStyles();
  const paymentProcessor = (
    <div className={classes.point}>
      <PaymentIcon fontSize='inherit' className={classes.pointIcon} />
      <div>
        <Typography variant='h6' component='div'>
          Payment processor
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
  );
  const donationFramework = (
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
  );
  const apiZapier = (
    <div className={classes.point}>
      <ApiIcon fontSize='inherit' className={classes.pointIcon} />
      <div>
        <Typography variant='h6' component='div'>
          Custom source
          </Typography>
        <Typography variant='body1' component='div' color='textSecondary'>
          Integrate via API, Zapier
          </Typography>
      </div>
    </div>
  );
  return (
    <div className={classes.pointsContainer}>
      {props.donationFirst ? donationFramework : paymentProcessor}
      {props.donationFirst ? paymentProcessor : donationFramework}
      {apiZapier}
    </div>
  );
}

export function LandingInternalFeedback() {
  return (
    <React.Fragment>
      <Hero
        title='Internal Feedback'
        description='Collect feedback from within your organization or customer-base'
        image={InternalFeedbackImg}
      />
      <Demo
        title='All your feedback in one place'
        description='Eliminate the mess of keeping track of feedback via starred emails, post-it notes, and text documents. Keep it all in one place.'
        alignItems='flex-end'
        demoFixedHeight={350}
        demoInsetFade
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
            showVoting: true,
            showFunding: false,
            showExpression: false,
          },
        }, undefined, undefined, { descriptionTruncateLines: 2 }, { limit: 3 })}
        // mock={mocker => mocker.demoFeedbackType()}
        mock={mocker => mocker.demoBoard([
          { status: '0', titleWords: 8, descriptionWords: 20, extra: { voteValue: 349 } },
          { status: '0', titleWords: 6, descriptionWords: 25, extra: { voteValue: 286 } },
          { status: '0', titleWords: 5, descriptionWords: 20, extra: { voteValue: 114 } },
        ])}
        settings={{
          demoDisablePostOpen: true,
          demoDisableExplorerExpanded: true,
          demoBlurryShadow: true,
          demoCreateAnimate: {
            title: 'Page load performance',
          },
        }}
      />
      <Block
        type='mediumDemo'
        title='Keep your stakeholders informed'
        description='Keep your stakeholders up-to-date with notifications over email or web-push.'
        image={DemoEmailNotificationImg}
        imageScale={0.4}
        alignItems='center'
        mirror
      />
      <Demo
        type='mediumDemo'
        title='Transparency in your workload'
        description='Let your co-workers see your work in order to understand your prioritization of their requests.'
        initialSubPath='/embed/demo'
        alignItems='center'
        template={templater => templater.demoBoard('Ticket queue', [
          { title: 'In Review' }, { title: 'In progress' },
        ])}
        mock={mocker => mocker.demoBoard([
          { status: '0' }, { status: '0' }, { status: '0' },
          { status: '1' }, { status: '1' },
        ])}
        settings={{
          demoBlurryShadow: true,
          demoDisablePostOpen: true,
        }}
        buttonTitle='See a Roadmap'
        buttonLink='/solutions/public-roadmap'
      />
      <Block
        title='Keep all your data private'
        description='Setup privacy settings so only authorized users can see and post feedback.'
        image={DemoProjectPrivateImg}
        imageScale={0.5}
        alignItems='center'
        mirror
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
        image={IdeasImg}
      />
      <Demo
        title='Embrace transparency'
        description="Allow your contributors to see each others' ideas and discuss in an open forum. Let them see what you're working on and see your prioritized backlog."
        initialSubPath='/embed/demo'
        type='mediumDemo'
        alignItems='center'
        template={templater => templater.demoBoardPreset('ideas')}
        mock={mocker => mocker.demoBoard([
          { status: '0' }, { status: '0' }, { status: '0' }, { status: '0' },
          { status: '1' }, { status: '1' },
        ])}
        settings={{
          demoBlurryShadow: true,
          demoDisablePostOpen: true,
        }}
        buttonTitle='See a Roadmap'
        buttonLink='/solutions/public-roadmap'
      />
      <HorizontalPanels wrapBelow='lg' maxWidth='lg' maxContentWidth='sm' staggerHeight={0}>
        <Block
          variant='content'
          type='column'
          title='Keep all ideas in one place'
          description='Keep forgetting what people asked you in-person or over email? Combine all your feedback channels into a single place to keep tidy and organized.'
          image={CentralizeImg}
          alignItems='center'
          mirror
        />
        <Block
          variant='content'
          type='column'
          title='Vote or submit an idea on behalf'
          description='Received an idea from a customer? Quickly create an account for them and vote/create the idea on behalf of them. They will be automatically notified when the idea is resolved.'
          image={DemoAsUserImg}
          imageScale={0.5}
          alignItems='center'
        />
      </HorizontalPanels>
      <HorizontalPanels wrapBelow='lg' maxWidth='lg' maxContentWidth='sm' staggerHeight={0}>
        <Block
          variant='content'
          type='column'
          icon={(<CategoryIcon />)}
          title='Organize ideas into buckets'
          description='With custom tags, organize ideas and assign to different teammates. You can also allow users to directly select the relevant tags themselves.'
          image={DemoTagging2Img}
          imageScale={0.4}
          mirror
          alignItems='center'
        />
        <Demo
          variant='content'
          type='column'
          icon={(<LifecycleIcon />)}
          title='Give your ideas a life cycle'
          description='Define custom stages for your ideas and transitions between them.'
          alignItems='center'
          template={templater => {
            templater.workflowIdea(templater.demoCategory());
            templater.styleWhite();
          }}
          demoFixedHeight={400}
          demoPreventInteraction
          demo={project => (
            <WorkflowPreview
              editor={project.editor}
              categoryIndex={0}
              isVertical
              hideCorner
              height='100%'
            />
          )}
        />
        <Block
          variant='content'
          type='column'
          icon={(<EditIcon />)}
          title='Make it your own'
          description="our tool can be customized to your needs whether you are collecting students' opinions, employee suggestion box, or product feedback."
          buttonTitle='See more customizations'
          buttonLink='/product/customize'
        />
      </HorizontalPanels>
      <Block
        title='Keep your contributors engaged'
        description='Notify your contributors when you have made progress to keep them in the loop and engaged.'
        image={LoopImg}
        mirror
        alignItems='center'
        buttonTitle='See how'
        buttonLink='/product/activate'
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
        image={CreatorImg}
      />
      <Block
        title='Establish a community'
      />
      <HorizontalPanels wrapBelow='lg' maxWidth='lg' maxContentWidth='md'>
        <Demo
          variant='content'
          type='column'
          icon={<IdeasIcon />}
          title='Idea brainstorm'
          description="Understand your community's opinion to make the right next step."
          alignItems='flex-start'
          demoFixedHeight={350}
          scale={0.7}
          demoInsetFade
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
              showVoting: true,
              showFunding: false,
              showExpression: false,
            },
          }, undefined, undefined, { descriptionTruncateLines: 2 }, { limit: 3 })}
          // mock={mocker => mocker.demoFeedbackType()}
          mock={mocker => mocker.demoBoard([
            { status: '0', titleWords: 8, descriptionWords: 20, extra: { voteValue: 349 } },
            { status: '0', titleWords: 6, descriptionWords: 25, extra: { voteValue: 286 } },
            { status: '0', titleWords: 5, descriptionWords: 20, extra: { voteValue: 114 } },
          ])}
          settings={{
            demoDisablePostOpen: true,
            demoDisableExplorerExpanded: true,
            demoBlurryShadow: true,
            demoCreateAnimate: {
              title: 'Add Dark Mode',
              similarSearchTerm: 'theme',
            },
          }}
        />
        <Demo
          variant='content'
          type='column'
          icon={<ForumIcon />}
          title='Discussion forum'
          description='Nurture a community in forum discussions with customized categories and threaded comments that bubble up the best comments to the top.'
          alignItems='center'
          initialSubPath='/embed/demo'
          demoFixedHeight={420}
          scale={0.7}
          template={templater => {
            templater.demoCategory();
            templater.styleWhite();
          }}
          settings={{
            demoBlurryShadow: true,
          }}
          mock={(mocker, config) => mocker.mockFakeIdeaWithComments('ideaId')
            .then(() => mocker.mockLoggedIn())}
          demo={LandingCommentListDemo}
        />
      </HorizontalPanels>
      <Block
        // variant='content'
        // type='column'
        icon={<PrivacyIcon />}
        title='Fans-only'
        description='You can choose to only allow fans to suggest ideas or to see your private content. You can ask them to sign in using their existing account on platforms such as Patreon or YouTube.'
        image={SupportImg}
      />
      <Block
        title='Prioritize your work'
      />
      <HorizontalPanels wrapBelow='lg' maxWidth='lg' maxContentWidth='md' staggerHeight={100}>
        <Demo
          variant='content'
          type='column'
          title='Simple voting'
          description='Let your fans vote up or down which ideas they like so you can concentrate on what your fanbase wants.'
          initialSubPath='/embed/demo'
          template={templater => templater.demoPrioritization('vote')}
          mock={mocker => mocker.demoPrioritization()}
          settings={{
            demoBlurryShadow: true,
            demoDisablePostOpen: true,
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
          title='Feedback from your most valued fans, Credit based prioritization'
          description='Give your fans credits every time they give you a donation or make a subscription payment. Use those credits to prioritize ideas. Infographic: show Patreon/Ko-fi -> ClearFlask issues credits -> Fan prioritizes ideas'
          initialSubPath='/embed/demo'
          template={templater => templater.demoPrioritization('fund')}
          controls={project => (<PrioritizationControlsCredits forContentCreator templater={project.templater} />)}
          mock={mocker => mocker.demoPrioritization()}
          demoFixedHeight={200}
          containerPortal
          settings={{
            demoDisablePostOpen: true,
            demoBlurryShadow: true,
            demoFundingAnimate: 20,
          }}
        />
      </HorizontalPanels>
      <HorizontalPanels wrapBelow='lg' maxWidth='lg' maxContentWidth='sm'>
        <Block
          variant='content'
          type='column'
          title='1# Link with your platform'
          description='If you are taking donations or payments for your content, link your platform to automatically issue'
          demo={(<LandingCreditSystemLinkOptions donationFirst />)}
        />
        <Block
          variant='content'
          type='column'
          title='2# Issue credits'
          description='When a donation is made or a user completes an action, give them credits proportional to their loyalty.'
          demo={(
            <LandingTransactionHistory size='small' items={[
              { description: 'Credits for donation', amount: 5000 },
              { description: "Fund 'Microphone upgrade'", amount: -2000 },
              { description: "Fund 'Upcoming album'", amount: -2500 },
            ]} />
          )}
        />
        <Block
          variant='content'
          type='column'
          title='3# Let them spend it'
          description=''
          image={DemoCrowdfund2Img}
          imageStyleOuter={{ padding: 'unset' }}
        />
      </HorizontalPanels>
      <Demo
        type='mediumDemo'
        title='Roadmap'
        description=''
        initialSubPath='/embed/demo'
        alignItems='center'
        template={templater => templater.demoBoard('Plan to fame', [
          { title: 'Gathering ideas', },
          { title: 'Up next', display: { showExpression: true } },
        ])}
        mock={mocker => mocker.demoBoard([
          { status: '0' }, { status: '0' }, { status: '0' },
          { status: '1', extra: { expressions: { '👍': 14, '❤️': 5 } } },
          { status: '1', extra: { expressions: { '👍': 6, } } },
        ])}
        settings={{
          demoBlurryShadow: true,
          demoDisablePostOpen: true,
        }}
        buttonTitle='See a Roadmap'
        buttonLink='/solutions/public-roadmap'
      />
      <Block
        title='Let your fans know'
        description='Your fans will be thrilled their particular idea came to life.'
        image={DemoEmailNotification2Img}
        imageScale={0.4}
        mirror
        alignItems='center'
      />
    </React.Fragment>
  );
}

export function LandingGrowWithUs() {
  return (
    <React.Fragment>
      <Hero
        title='Scale with us'
        description='Built on scalable infrastructure to grow with your needs.'
        image={ArchitectureImg}
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

export function LandingInstall() {
  const classes = useStyles();
  const onboardingDemoRef = useRef(null);
  return (
    <React.Fragment>
      <Hero
        title='Install'
        description='How to connect ClearFlask with your product.'
        image={InstallImg}
      />
      <Block
        title='Integration points'
      />
      <HorizontalPanels wrapBelow='md' maxContentWidth='xs' maxWidth='lg'>
        <LandingClearFlaskDemo
          variant='content'
          type='column'
          title='Portal'
          description={(
            <React.Fragment>
              Link directly from your app or website to your ClearFlask portal. Optionally use a custom domain <b>feedback.yoursite.com</b>
            </React.Fragment>
          )}
          fakeBrowserProps={{
            fixedHeight: 200,
            addresBarContent: 'feedback.yoursite.com',
            // darkMode: true,
          }}
        />
        <Block
          variant='content'
          type='column'
          title='Widget'
          description='Embed within your website using IFrames either entire ClearFlask portal or individual pages.'
          demo={(
            <FakeBrowser fixedHeight={200} addresBarContent='yoursite.com'>
              <div className={classes.demoEmbedButtons}>
                <LandingDemoEmbed><FeedbackIcon /></LandingDemoEmbed>
                <Hr vertical margins='35px' length='100px'>or</Hr>
                <LandingDemoEmbed path='embed/feedback'><AddCommentIcon /></LandingDemoEmbed>
                <LandingDemoEmbed path='embed/roadmap'><RoadmapIcon style={{ transform: 'rotate(180deg)' }} /></LandingDemoEmbed>
              </div>
            </FakeBrowser>
          )}
        />
        <Block
          variant='content'
          type='column'
          title='Embed Status'
          description='Create a direct link to a particular idea or feature. Useful if you want to raise awareness of future functionality.'
          demo={(
            <FakeBrowser fixedHeight={200} addresBarContent='yoursite.com'>
              <div className={classes.demoStatusEmbedContainer}>
                <Typography className={classes.demoStatusEmbedText}>Custom domains</Typography>
                <PostStatusIframe
                  className={classes.demoStatusEmbedIframe}
                  width={100}
                  postId='ustom-subdomains-vr4'
                  config={{
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                  }}
                />
              </div>
            </FakeBrowser>
          )}
        />
      </HorizontalPanels>
      <Demo
        alignItems='center'
        mirror
        title='User onboarding'
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
      <HorizontalPanels wrapBelow='md' maxContentWidth='xs' maxWidth='lg' padRight={1}>
        <Block
          variant='content'
          type='column'
          icon={(<LinkIcon />)}
          title='Link accounts'
          description='Link accounts with your existing service using Single Sign-On, OAuth, or email domain whitelist. SSO creates an ideal seamless experience with no additional login steps.'
        />
        <Block
          variant='content'
          type='column'
          icon={(
            <div className={classes.iconsContainer}>
              <GoogleIcon />
              <GithubIcon fontSize='inherit' className={classes.githubIcon} />
              <FacebookIcon />
            </div>
          )}
          title='Sign in with ...'
          description='Use any OAuth provider to auto-create an account for your users. Ideal if your users are coming in from specific services or to simply ease sign-up friction.'
        />
      </HorizontalPanels>
      <HorizontalPanels wrapBelow='md' maxContentWidth='xs' maxWidth='lg' padLeft={1}>
        <Block
          variant='content'
          type='column'
          icon={(<EmailIcon />)}
          title='Email sign-up'
          description='Let your users sign-up with an email. Optionally require email verification, passwordless login, or password required.'
        />
        <Block
          variant='content'
          type='column'
          icon={(<NotificationIcon />)}
          title='Browser Notifications'
          description='To ease friction with users providing an email, allow your users to sign-up by allowing Browser Web Push Notifications. This allows you to engage your users wiht little friction. Non-supporting browsers can fall-back to Guest access.'
        />
      </HorizontalPanels>
      <HorizontalPanels wrapBelow='md' maxContentWidth='xs' maxWidth='lg' padLeft={2}>
        <Block
          variant='content'
          type='column'
          icon={(<GuestIcon />)}
          title='Guest accounts'
          description='Ideal in some use cases, allows your users to sign-up without providing any contact information. Use as a last resort as it attracts spam and leaves you with no engagement opportunity.'
        />
      </HorizontalPanels>
      <Block
        title='Issue Credit automatically'
        description='If you are using the Credit System, issue credits to your users automatically with your platform when they make a purchase or complete any action.'
        alignItems='flex-start'
        image={CrowdfundImg}
        imageLocation='above'
        demo={(<LandingCreditSystemLinkOptions />)}
        buttonTitle='See Feature Crowdfunding'
        buttonLink='/solutions/feature-crowdfunding'
      />
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
      image={SalesImg}
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

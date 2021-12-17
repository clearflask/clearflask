// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
/// <reference path="../@types/transform-media-imports.d.ts"/>
import loadable from '@loadable/component';
import { Button, ButtonGroup, Container, IconButton, Size, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@material-ui/core';
import { createStyles, fade, makeStyles, Theme } from '@material-ui/core/styles';
import AccessibilityIcon from '@material-ui/icons/AccessibilityNew';
import PaymentIcon from '@material-ui/icons/AccountBalance';
import OncallIcon from '@material-ui/icons/Alarm';
import LifecycleIcon from '@material-ui/icons/Autorenew';
import BuildIcon from '@material-ui/icons/Build';
import ContentDeliveryIcon from '@material-ui/icons/Cached';
import CategoryIcon from '@material-ui/icons/Category';
import ChangeIcon from '@material-ui/icons/ChangeHistory';
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
import OpenCommunityIcon from '@material-ui/icons/Group';
import EngageIcon from '@material-ui/icons/Hearing';
import KnowledgeIcon from '@material-ui/icons/Help';
import EncryptionIcon from '@material-ui/icons/Https';
import LinkIcon from '@material-ui/icons/Link';
import ContentCreatorIcon from '@material-ui/icons/LiveTv';
import MoodBadIcon from '@material-ui/icons/MoodBad';
import MoreIcon from '@material-ui/icons/MoreHoriz';
import UpcomingFeaturesIcon from '@material-ui/icons/NewReleasesOutlined';
import NotificationIcon from '@material-ui/icons/Notifications';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import CommunityIcon from '@material-ui/icons/People';
import QuestionIcon from '@material-ui/icons/QuestionAnswer';
import BillingIcon from '@material-ui/icons/Receipt';
import CustomerFeedbackIcon from '@material-ui/icons/RecordVoiceOver';
import RespondIcon from '@material-ui/icons/ReplyAll';
import SearchIcon from '@material-ui/icons/Search';
import AnalyticsIcon from '@material-ui/icons/ShowChart';
import StorageIcon from '@material-ui/icons/Storage';
import VoteIcon from '@material-ui/icons/ThumbsUpDown';
import AntiSpamIcon from '@material-ui/icons/VerifiedUser';
import PrivacyIcon from '@material-ui/icons/VisibilityOff';
import TransparentIcon from '@material-ui/icons/VisibilityOutlined';
import KeyIcon from '@material-ui/icons/VpnKey';
import WidgetIcon from '@material-ui/icons/Widgets';
import CareersIcon from '@material-ui/icons/Work';
import classNames from 'classnames';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Provider, shallowEqual, useSelector } from 'react-redux';
import AnalyzeImg from '../../public/img/landing/analyze.svg';
import ArchitectureImg from '../../public/img/landing/architecture.svg';
import CentralizeImg from '../../public/img/landing/centralize.svg';
import ComparisonImg from '../../public/img/landing/comparison.svg';
import CreatorImg from '../../public/img/landing/creator.svg';
import CrowdfundImg from '../../public/img/landing/crowdfund.svg';
import CustomerCloudStaff from '../../public/img/landing/customer/cloudstaff.png';
import CustomerDekra from '../../public/img/landing/customer/dekra.jpg';
import CustomerErpca from '../../public/img/landing/customer/erpca.png';
import CustomerGoodOnYou from '../../public/img/landing/customer/goodonyou.svg';
import CustomerLeaseWeb from '../../public/img/landing/customer/leaseweb.png';
import CustomerStudios from '../../public/img/landing/customer/studios.svg';
import CustomizeImg from '../../public/img/landing/customize.svg';
import DemoAdvertiseCreditsImg from '../../public/img/landing/demo-advertise-credits.png';
import DemoAsUserImg from '../../public/img/landing/demo-as-user.png';
import DemoChangelogImg from '../../public/img/landing/demo-changelog.png';
import DemoChangelog2Img from '../../public/img/landing/demo-changelog2.png';
import DemoCrowdfundImg from '../../public/img/landing/demo-crowdfund.png';
import DemoCrowdfund2Img from '../../public/img/landing/demo-crowdfund2.png';
import DemoDashboardFeedbackVid from '../../public/img/landing/demo-dashboard-feedback.mp4';
import DemoDashboardFeedbackImg from '../../public/img/landing/demo-dashboard-feedback.png';
import DemoDashboardRoadmapVid from '../../public/img/landing/demo-dashboard-roadmap.mp4';
import DemoDashboardRoadmapImg from '../../public/img/landing/demo-dashboard-roadmap.png';
import DemoEmailNotificationImg from '../../public/img/landing/demo-email-notif.png';
import DemoEmailNotification2Img from '../../public/img/landing/demo-email-notif2.png';
import DemoExplorerImg from '../../public/img/landing/demo-explorer.png';
import DemoExportedDataImg from '../../public/img/landing/demo-exported-data.png';
import DemoFeedbackWhatElseImg from '../../public/img/landing/demo-feedback-whatelse.png';
import DemoFeedbackImg from '../../public/img/landing/demo-feedback.png';
import DemoFundingRoadmapImg from '../../public/img/landing/demo-funding-roadmap.png';
import DemoNoBalanceImg from '../../public/img/landing/demo-no-balance.png';
import DemoPageFeedbackClassigImg from '../../public/img/landing/demo-page-feedback-classic.png';
import DemoPageFeedbackImg from '../../public/img/landing/demo-page-feedback.png';
import DemoPinnedResponseImg from '../../public/img/landing/demo-pinned-response.png';
import DemoPortalFeedbackVid from '../../public/img/landing/demo-portal-feedback.mp4';
import DemoPostImg from '../../public/img/landing/demo-post.png';
import DemoProjectPrivateImg from '../../public/img/landing/demo-project-private.png';
import DemoRoadmapImg from '../../public/img/landing/demo-roadmap.png';
import DemoTaggingImg from '../../public/img/landing/demo-tagging.png';
import DemoTagging2Img from '../../public/img/landing/demo-tagging2.png';
import FeatureRequestImg from '../../public/img/landing/featurerequest.svg';
import HtmlImg from '../../public/img/landing/html.png';
import IdeasImg from '../../public/img/landing/ideas.svg';
import IntegrationImg from '../../public/img/landing/integration.svg';
import InternalFeedbackImg from '../../public/img/landing/internalfeedback.svg';
import ListenImg from '../../public/img/landing/listen.svg';
import LoopImg from '../../public/img/landing/loop.svg';
import NotifyImg from '../../public/img/landing/notify.svg';
import PromoThumb from '../../public/img/landing/promo-video-thumb.jpg';
import ProudImg from '../../public/img/landing/proud.svg';
import PublicDiscussionImg from '../../public/img/landing/public-discussion.svg';
import RoadmapImg from '../../public/img/landing/roadmap.svg';
import Roadmap2Img from '../../public/img/landing/roadmap2.svg';
import Server2Img from '../../public/img/landing/server2.svg';
import Server3Img from '../../public/img/landing/server3.svg';
import SupportImg from '../../public/img/landing/support.svg';
import TeamImg from '../../public/img/landing/team.svg';
import ValueImg from '../../public/img/landing/value.svg';
import VersionControlImg from '../../public/img/landing/versioncontrol.svg';
import SalesImg from '../../public/img/support/sales.svg';
import * as Admin from '../api/admin';
import * as Client from '../api/client';
import { ReduxStateAdmin } from '../api/serverAdmin';
import { SSO_TOKEN_PARAM_NAME } from '../app/App';
import AppThemeProvider from '../app/AppThemeProvider';
import CommentList from '../app/comps/CommentList';
import PostStatusIframe from '../app/PostStatusIframe';
import DividerCorner from '../app/utils/DividerCorner';
import Loading from '../app/utils/Loading';
import ClosablePopper from '../common/ClosablePopper';
import Templater, { createTemplateV2OptionsDefault } from '../common/config/configTemplater';
import CreditView from '../common/config/CreditView';
import { contentScrollApplyStyles, Orientation, Side } from '../common/ContentScroll';
import FakeBrowser from '../common/FakeBrowser';
import Hr from '../common/Hr';
import GoogleIcon from '../common/icon/GoogleIcon';
import GuestIcon from '../common/icon/GuestIcon';
import LockSimpleIcon from '../common/icon/LockSimpleIcon';
import OpenSourceIcon from '../common/icon/OpenSourceIcon';
import ImgIso from '../common/ImgIso';
import Stack from '../common/Stack';
import { isProd } from '../common/util/detectEnv';
import { IframeWithUrlSync } from '../common/util/iframeUrlSync';
import { vh } from '../common/util/screenUtil';
import windowIso from '../common/windowIso';
import { importFailed, importSuccess } from '../Main';
import Competitors from './Competitors';
import Background from './landing/Background';
import Block from './landing/Block';
import BlockContent from './landing/BlockContent';
import Demo from './landing/Demo';
import Hero from './landing/Hero';
import HorizontalPanels from './landing/HorizontalPanels';
import PrioritizationControlsCredits from './landing/PrioritizationControlsCredits';
import Logo from './Logo';
import PricingPage from './PricingPage';

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
    maxHeight: theme.vh(90),
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
  textAlignCenter: {
    textAlign: 'center',
  },
  demoCustomizeControl: {
    margin: theme.spacing(2),
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
  },
  templateCards: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'stretch',
  },
  templateCard: {
    margin: theme.spacing(4),
    width: 200,
    display: 'flex',
    flexDirection: 'column',
  },
  customers: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 80,
    '& > *': {
      filter: 'grayscale(100%)',
      opacity: 0.35,
      minWidth: 150,
      maxWidth: 150,
      width: '100%',
    },
    ...contentScrollApplyStyles({ theme, side: Side.Center, orientation: Orientation.Horizontal }),
  },
}));

export function Landing() {
  const { t } = useTranslation('site');
  const classes = useStyles();
  return (
    <>
      <LandingHero />
      <Block
        className={classes.textAlignCenter}
        type='headingOnly'
        title={(
          <div className={classes.customers}>
            <ImgIso img={CustomerDekra} />
            <ImgIso img={CustomerLeaseWeb} />
            <ImgIso img={CustomerCloudStaff} />
            <ImgIso img={CustomerErpca} />
            <ImgIso img={CustomerGoodOnYou} />
            <ImgIso img={CustomerStudios} />
          </div>
        )}
      />
      <Block
        className={classes.textAlignCenter}
        type='headingOnly'
        title='See what we have to offer'
        spacingBottom={0}
      />
      <HorizontalPanels wrapBelow='md' maxContentWidth='xs' maxWidth='lg' staggerHeight={40}>
        <Block
          type='column'
          icon={(<CustomerFeedbackIcon fontSize='inherit' />)}
          title={t('customer-feedback')}
          titleColorSecondary
          demoImage={DemoFeedbackImg}
          demoWrap='browser'
        />
        <Block
          type='column'
          icon={(<RoadmapIcon fontSize='inherit' style={{ transform: 'rotate(180deg)' }} />)}
          title={t('product-roadmap')}
          titleColorSecondary
          demoImage={DemoRoadmapImg}
          demoWrap='browser'
        />
        <Block
          type='column'
          icon={(<ChangeIcon fontSize='inherit' />)}
          title={t('announcements')}
          titleColorSecondary
          demoImage={DemoChangelog2Img}
          demoWrap='browser'
        />
      </HorizontalPanels>
      <Block
        type='headingMain'
        title={t('simple-yet-powerful-feedback-experience')}
        description={t('ask-your-customers-for-feedback-on-your-product-and-extract-valuable-ideas')}
        largePoints
        points={[
          t('choose-between-feedback-first-or'),
          t('website-integration'),
        ]}
        alignItems='center'
        demoFixedWidth='100%'
        demoFixedHeight={500}
        demo={(
          <Stack
            // raiseOnHover
            contentSpacingVertical={200}
            items={[{
              height: 'max-content',
              content: (
                <FakeBrowser>
                  <ImgIso img={DemoPageFeedbackClassigImg} />
                </FakeBrowser>
              )
            }, {
              height: 'max-content',
              width: 330,
              content: (
                <FakeBrowser>
                  <ImgIso img={DemoFeedbackImg} />
                </FakeBrowser>
              )
            }]}
          />
        )}
        buttonTitle='See how'
        buttonLink='/product/ask'
      />
      <Block
        mirror
        type='headingMain'
        title={t('convert-ideas-into-actionable-tasks')}
        description={t('find-the-most-valuable-features-from-the-most-important-customers')}
        largePoints
        points={[
          t('analyze-feedback'),
          t('validate-ideas'),
          t('prioritize-roadmap'),
        ]}
        alignItems='center'
        demoFixedWidth='100%'
        demo={(
          <Stack
            contentSpacingVertical={200}
            float='right' // overflow left
            items={[{
              content: (<ImgIso img={DemoDashboardRoadmapImg} />),
              height: 'max-content',
            }, {
              content: (<ImgIso img={DemoDashboardFeedbackImg} />),
              height: 'max-content',
            }]}
          />
        )}
        buttonTitle={t('learn-more')}
        buttonLink='/product/analyze'
      />
      <Block
        type='headingMain'
        title={t('share-progress-with-your-community')}
        description={t('become-a-customer-centric-organization-with')}
        largePoints
        points={[
          t('public-roadmap'),
          t('announcements'),
          t('subscribe-to-updates'),
        ]}
        alignItems='center'
        demoFixedWidth='100%'
        // demoFixedHeight={500}
        demo={(
          <Stack
            topLeftToBottomRight
            // raiseOnHover
            ascendingLevel
            contentSpacingVertical={200}
            items={[{
              content: (
                <FakeBrowser>
                  <ImgIso img={DemoPostImg} />
                </FakeBrowser>
              ),
              width: 300,
              height: 'max-content',
            }, {
              content: (
                <FakeBrowser>
                  <ImgIso img={DemoChangelogImg} />
                </FakeBrowser>
              ),
              width: 330,
            }, {
              content: (
                <FakeBrowser>
                  <ImgIso img={DemoRoadmapImg} />
                </FakeBrowser>
              ),
            }]}
          />
        )}
        buttonTitle={t('learn-more')}
        buttonLink='/product/act'
      />
      <LandingPricingOptions />

      {/* <HorizontalPanels wrapBelow='lg' maxWidth='lg' maxContentWidth='sm' staggerHeight={150}>
        <Block
          type='column'
          title='Idea Management'
          description='Collect and organize ideas from your users, customers or coworkers'
          image={IdeasImg}
          imageLocation='above'
          buttonTitle='Learn more'
          buttonLink='/solutions/idea-management'
        />
        <Block
          type='column'
          title='Feature Crowdfunding'
          description='Credit-system to reward your paying customers with a voice to shape your product.'
          image={CrowdfundImg}
          imageLocation='above'
          buttonTitle='Learn more'
          buttonLink='/solutions/feature-crowdfunding'
        />
        <Block
          type='column'
          title='Product Roadmap'
          description='Transparency between development and customers for stronger ties with your community.'
          image={Roadmap2Img}
          imageLocation='above'
          buttonTitle='Learn more'
          buttonLink='/solutions/product-roadmap'
        />
      </HorizontalPanels> */}
      {/* <Hidden mdDown>
        <HorizontalPanels wrapBelow='lg' maxWidth='lg' maxContentWidth='sm' padRight={1}>
          <Block
            type='column'
            title='Feature Request Tracking'
            description='Tool to keep organized and drive your product forward'
            image={FeatureRequestImg}
            imageLocation='above'
            buttonTitle='Learn more'
            buttonLink='/solutions/feature-request-tracking'
          />
          <Block
            type='column'
            title='Content Creator Forum'
            description='Reward your fans with a voice proportional to their contributions. Let your biggest fans shape your future creations.'
            image={CreatorImg}
            imageLocation='above'
            buttonTitle='Learn more'
            buttonLink='/solutions/content-creator-forum'
          />
        </HorizontalPanels>
        <HorizontalPanels wrapBelow='lg' maxWidth='lg' maxContentWidth='sm' padRight={2}>
          <Block
            type='column'
            title='Internal Feedback'
            description='Collect feedback from within your organization or customer-base'
            image={InternalFeedbackImg}
            imageLocation='above'
            buttonTitle='Learn more'
            buttonLink='/solutions/internal-feedback'
          />
        </HorizontalPanels>
      </Hidden> */}

      {/* <Block />
      <HorizontalPanels wrapBelow='lg' maxWidth='lg' maxContentWidth='md' padRight={1}>
        <Block
          type='column'
          title='Make it your own'
          description='Our solution can be customized out of the box to fit your specific needs.'
          image={CustomizeImg}
          imageLocation='above'
          buttonTitle='Learn more'
          buttonLink='/product/customize'
        />
      </HorizontalPanels>
      <HorizontalPanels wrapBelow='lg' maxWidth='lg' maxContentWidth='md' padLeft={1}>
        <Block
          type='column'
          title='Scale with us'
          description='Built on scalable infrastructure to grow with your needs.'
          image={ArchitectureImg}
          imageLocation='above'
          buttonTitle='Learn more'
          buttonLink='/product/scale-with-us'
        />
        <Block
          type='column'
          title='Integrations'
          description='Use with your existing tools.'
          image={IntegrationImg}
          imageLocation='above'
          buttonTitle='Learn more'
          buttonLink='/product/integrations'
        />
      </HorizontalPanels> */}
      {/* <LandingSales /> */}
      {/* <LandingGraveyard /> */}
    </>
  );
}

export function LandingGraveyard() {
  const classes = useStyles();
  return (
    <>
      <div style={{ height: '100vh' }} />
      <Hero title='Landing components graveyard' />

      <HorizontalPanels wrapBelow='lg' maxWidth='lg' maxContentWidth='sm' staggerHeight={0}>
        <Block
          type='column'
          title='Spark discussions'
          description=''
          icon={(<CustomerFeedbackIcon fontSize='inherit' />)}
        />
        <Block
          type='column'
          title='show off future ideas'
          description='post status demom Maybe put this in Analyze -> validate'
          icon={(<CustomerFeedbackIcon fontSize='inherit' />)}
        />
      </HorizontalPanels>
      <HorizontalPanels wrapBelow='lg' maxWidth='lg' maxContentWidth='sm' staggerHeight={0}>
        {/* Collect feedback right from your website or app */}
        {/* Prioritize based on customer value */}
        {/* Keep your users updated */}
        {/* Explore */}
        <BlockContent
          variant='content'
          title='Capture feedback publicly, internally, or on-behalf'
          description='Enable feedback from your internal teams or make it publicly accessible. Capture feedback directly from your audience or on-behalf from other channels.'
          icon={(<CustomerFeedbackIcon fontSize='inherit' />)}
        />
        <BlockContent
          variant='content'
          title='Customer segmentation and Analytics'
          description='Analyze your data with search, segment and filter to summarize feedback from target customers.'
          icon={(<AnalyticsIcon fontSize='inherit' />)}
          postStatusId='customer-segmentation-and-analytics-pgi'
        />
        {/* <Demo
            variant='content'
            type='column'
            title='Powerful analytics'
            description={('Powered by ElasticSearch, perform user segmentations and gives you the answer you are looking for.')}
            icon={(<AnalyticsIcon fontSize='inherit' />)}
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
          icon={(<WidgetIcon fontSize='inherit' />)}
          buttonTitle='See integrations'
          buttonLink='/product/integrations'
        />
      </HorizontalPanels>
      <Block
        title='Collect'
        description='collect, embed in iframe, use API, internal feedback'
      />
      <HorizontalPanels wrapBelow='md' maxWidth='lg' maxContentWidth='xs' staggerHeight={150}>
        <Block
          type='column'
          title='Feature Request Tracking'
          description='Tool to keep organized and drive your product forward'
          image={FeatureRequestImg}
          imageLocation='above'
          buttonTitle='Learn more'
          buttonLink='/solutions/feature-request-tracking'
          mirror
        />
        <Block
          type='column'
          title='Internal Feedback'
          description='Collect feedback from within your organization or customer-base'
          image={InternalFeedbackImg}
          imageLocation='above'
          buttonTitle='Learn more'
          buttonLink='/solutions/internal-feedback'
        />
        <Block
          type='column'
          title='Idea management'
          description='Collect and organize ideas from your users, customers or coworkers'
          image={IdeasImg}
          imageLocation='above'
          buttonTitle='Learn more'
          buttonLink='/solutions/idea-management'
          mirror
        />
      </HorizontalPanels>
      <Block
        title='Feature Crowdfunding'
        description='Credit-system to reward your paying customers with a voice to shape your product.'
        image={CrowdfundImg}
        imageLocation='above'
        buttonTitle='Learn more'
        buttonLink='/solutions/feature-crowdfunding'
      />
      <LandingLoop />
      <LandingCustomizeHero />
      <Demo
        type='mediumDemo'
        title='Stay on the same page'
        description='Keep everyone on the same page with your product development roadmap'
        mirror
        image={Roadmap2Img}
        imageLocation='above'
        initialSubPath='/embed/demo'
        alignItems='center'
        template={templater => templater.demoBoard('Product roadmap', [
          { title: 'Planned' }, { title: 'Completed' },
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
        buttonLink='/solutions/product-roadmap'
      />
      <HorizontalPanels wrapBelow='md' maxContentWidth='xs' maxWidth='lg' padRight={1}>
        <Block
          type='column'
          icon={(<LinkIcon fontSize='inherit' />)}
          title='Link your existing accounts'
          description='Link accounts with your existing service using Single Sign-On, OAuth, or email domain whitelist. SSO is the ideal seamless experience with no sign-up steps.'
        />
        <Block
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
          type='column'
          icon={(<EmailIcon fontSize='inherit' />)}
          title='Email sign-up'
          description='Let your users sign-up with an email. Optionally require email verification, passwordless login, or password required.'
        />
        <Block
          type='column'
          icon={(<NotificationIcon fontSize='inherit' />)}
          title='Browser Notifications'
          description='To ease friction with users providing an email, allow your users to sign-up by allowing Browser Web Push Notifications. This allows you to engage your users wiht little friction. Non-supporting browsers can fall-back to Guest access.'
        />
      </HorizontalPanels>
      <HorizontalPanels wrapBelow='md' maxContentWidth='xs' maxWidth='lg' padLeft={2}>
        <Block
          type='column'
          icon={(<GuestIcon fontSize='inherit' />)}
          title='Guest accounts'
          description='Ideal in some use cases, allows your users to sign-up without providing any contact information. Use as a last resort as it attracts spam and leaves you with no engagement opportunity.'
        />
      </HorizontalPanels>
      <Block
        type='headingMain'
        title='Give your most-valuable customers a proportionate voice'
        description='Assign voting power based on customer value and let them prioritize your suggestion box. Your users will love knowing their voice has been heard.'
        alignItems='flex-start'
        image={ValueImg}
        imageStyleOuter={{ maxWidth: 350, padding: 0, }}
      />
      <HorizontalPanels wrapBelow='md' maxWidth='lg' maxContentWidth='xs'>
        <Demo
          type='column'
          title='Keep it simple with voting'
          description='Most common and simplest to understand by users. Customer value and segmentation can be applied behind the scenes.'
          initialSubPath='/embed/demo'
          template={templater => templater.demoPrioritization('vote')}
          // controls={project => (<PrioritizationControlsVoting templater={project.templater} />)}
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
          type='column'
          title='Expressions for a wider range of feedback'
          description='When you cannnot accurately express your feelings with simple upvotes, weighted emoji expressions are here to help.'
          initialSubPath='/embed/demo'
          template={templater => templater.demoPrioritization('express')}
          // controls={project => (<PrioritizationControlsExpressions templater={project.templater} />)}
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
          type='column'
          title='Credit System for advanced prioritization'
          description='Distribute credits to your users based on their value as a customer or monetary contribution. Let them fine-tune prioritization on their own.'
          initialSubPath='/embed/demo'
          template={templater => templater.demoPrioritization('fund')}
          // controls={project => (<PrioritizationControlsCredits templater={project.templater} />)}
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
          buttonTitle='See Feature Crowdfunding'
          buttonLink='/solutions/feature-crowdfunding'
        />
      </HorizontalPanels>
      <div className={classes.demoEmbedButtons}>
        <LandingDemoEmbed path='embed/feedback'><FeedbackIcon /></LandingDemoEmbed>
        <LandingDemoEmbed path='embed/roadmap'><RoadmapIcon style={{ transform: 'rotate(180deg)' }} /></LandingDemoEmbed>
      </div>
    </>
  );
}

export function LandingHero() {
  const { t } = useTranslation('site');
  return (
    <Background svg={{
      d: 'm 172 63 c -170 -16 -71 162 -59 187 C 131 294 67 369 118 415 C 179 466 401 477 550 371 c 89 -59 226 139 379 -8 c 31 -36 196 -234 34 -287 c -309 -122 -184 87 -791 -13',
      viewBox: '0 0 1200 500',
    }} width={2400} height={1000}>
      <Hero
        title={t('hero')}
        description={t('subhero')}
        // description='Open-source ideation tool to gather feedback and prioritize your roadmap transparently within your product community.'
        // description='Listen to your users during product development and prioritize your roadmap with our open-source Feedback Management Tool'
        vidyard={{
          image: PromoThumb,
          uuid: 'EZK7e1kRjWzamC3PMMNuUh',
        }}
        mirror
        buttonTitle={t('get-started')}
        buttonLink='/signup'
        buttonRemark={(<div>{t('free-14-day-trial')}</div>)}
        // buttonAddOauth
        button2Title={t('see-demo')}
        button2Link='/product/demo'
      />
    </Background>
  );
}

export function LandingClearFlaskDemo(props: {
  path?: string,
  fakeBrowserProps?: Partial<React.ComponentProps<typeof FakeBrowser>>,
}) {
  const { t } = useTranslation('site');
  return (
    <FakeBrowser
      fixedHeight={500}
      {...props.fakeBrowserProps}
    >
      <iframe
        title={t('demo-clearflask-feedback')}
        src={`${windowIso.location.protocol}//product.${windowIso.location.host}${props.path || ''}`}
        width='100%'
        height='100%'
        frameBorder={0}
      />
    </FakeBrowser>
  );
}

export function LandingDemoEmbed(props: { path?: string, children: any }) {
  const [demoOpen, setDemoOpen] = useState<boolean>(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const classes = useStyles();
  return (
    <>
      <IconButton
        onClick={() => setDemoOpen(true)}
        innerRef={anchorRef}
      >
        {props.children}
      </IconButton>
      <ClosablePopper
        anchorType='ref'
        anchor={anchorRef}
        open={!!demoOpen}
        onClose={() => setDemoOpen(false)}
        placement='top'
        arrow
        clickAway
        paperClassName={classes.demoEmbedPopper}
      >
        <iframe
          title='Demo: ClearFlask Feedback'
          src={`${windowIso.location.protocol}//product.${windowIso.location.host}/${props.path || ''}`}
          width='100%'
          height='100%'
          frameBorder={0}
        />
      </ClosablePopper>
    </>
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

export function LandingCollectFeedback() {
  const classes = useStyles();
  return (
    <>
      <Background svg={{
        d: 'm 269 57 c -155 -7 -211 73 -180 144 C 135 297 50 378 119 519 c 64 58 463 65 569 -10 c 119 -87 483 103 528 -47 c 52 -187 137 -305 -104 -351 C 809 75 878 198 765 122 C 544 -30 434.3333 78.6667 269 57',
        viewBox: '0 0 1400 500',
      }} offsetY='-50px' width={1700} height={700}>
        <Demo
          type='hero'
          title='Ask for feedback'
          description='Collect customer feedback all in one place from all your support channels'
          image={ListenImg}
          imageLocation='above'
          demoImage={DemoPortalFeedbackVid}
          demoWrap='browser'
        />
      </Background>
      <Block
        className={classes.textAlignCenter}
        type='headingOnly'
        title='Optimizing your strategy'
        description='There are many ways to configure your portal for your particular needs'
        spacingBottom={0}
      />
      <HorizontalPanels wrapBelow='md' maxWidth='xl' staggerHeight={200}>
        <Block
          iconAbove
          icon={(<CustomerFeedbackIcon fontSize='inherit' />)}
          titleVariant='h3'
          type='column'
          title='Customer-first'
          subtitle='Hands-on and detail-oriented'
          description={(
            <>
              To extract unbiased and informative feedback, a simple feedback box is the ideal approach to capture customers' own words.
              <p>Intended for detail-oriented product managers, customer-first approach is the best way to understand your customers.</p>
            </>
          )}
          demoWrap='browser'
          demoImage={DemoPageFeedbackImg}
          alignItems='center'
          points={[
            'Customer-centric product',
            'Large community',
            'Simple feedback form',
          ]}
        />
        <Block
          iconAbove
          icon={(<OpenCommunityIcon fontSize='inherit' />)}
          titleVariant='h3'
          type='column'
          title='Community-first'
          subtitle='Community-driven and transparent'
          description={(
            <>
              Feedback as a public forum is adopted by many organizations. This approach focuses on your customers ability to discuss features amongst themselves.
              <p>Although managing feedback is more hands-off in this approach, the feedback you receive will mostly be in the form of votes on existing ideas that will amplify the loudest customers.</p>
            </>
          )}
          // description='A publicly explorable feedback is adopted by many organizations. It is primarily suitable for open, trusted, or small communities as feedback tends to accumulate votes rather than expressing.'
          demoWrap='browser'
          demoImage={DemoPageFeedbackClassigImg}
          alignItems='center'
          points={[
            'Low-effort hands-off feedback',
            'Open community',
            'B2B feedback',
            'Internal feedback tracking',
            'Employee feedback',
          ]}
        />
      </HorizontalPanels>
      {/* <Block
        className={classes.textAlignCenter}
        type='headingOnly'
        title='Customer-first experience'
        spacingBottom={0}
      />
      <Block
        title='#1 Capture words instead of votes'
        description='Reading customer feedback is insightful. Between an in-person interview (High friction, high value) and voting (Low friction, low value), a simple feedback box strikes the right balance.'
        demoImage={CaptureFeedbackImg}
        // demoWrap='browser'
        alignItems='center'
        imageStyle={{ padding: 0 }}
        points={[
          'Keeps a line of communnication from the feedback poster',
          "Avoids voting-only feedback that leads to one person's idea and 100s of lazy upvotes",
        ]}
        spacingTopBottom={0}
      />
      <Block
        title='#2 Group with related ideas'
        description='Only after feedback is submitted, user can combine it with an existing idea.'
        demoImage={AnyRelatedImg}
        // demoWrap='browser'
        alignItems='center'
        imageStyle={{ padding: 0 }}
        points={[
          'Extracts unbiased opinion before exposing community feedback',
          'Embraces further discussion around subtle differences of the same idea'
        ]}
        spacingTopBottom={0}
      />
      <Block
        title={(
          <>
            #3 <b>Wants</b> instead of <b>upvotes</b>
          </>
        )}
        description='Ask your users about specific ideas that you are seeking feedback from. Always asks the user why a feature is wanted.'
        demoImage={SeeWhatElseImg}
        // demoWrap='browser'
        alignItems='center'
        imageStyle={{ padding: 0 }}
        points={[
          'Idea validation and brainstorming',
          'Find volunteer BETA testers for an upcoming feature',
        ]}
        spacingTopBottom={0}
      /> */}
      {/* <Demo
        title='Build a community around your product'
        description='Whether you are starting out or have a product on the market, keep your users updated at every step. Let them be involved in your decision making and shape your product.'
        alignItems='center'
        initialSubPath='/embed/demo'
        demoFixedHeight={450}
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
      /> */}
      <Block
        title='Easily integrates with your website or app'
        description='Use a custom domain to host your ClearFlask portal or embed it directly on your site or app. Use your own logo, branding, palette and typography.'
        image={LoopImg}
        imageLocation='above'
        points={[
          { text: (<>Portal (<b>brand</b>.clearflask.com)</>) },
          { text: (<>Custom domain (feedback.<b>yoursite</b>.com)</>) },
          'Embed widget within your website',
        ]}
        alignItems='center'
        demo={(
          <FakeBrowser
            fixedWidth={200}
            fixedHeight={200}
            addressBarContent='yoursite.com'
          >
            <div className={classes.demoEmbedButtons}>
              <LandingDemoEmbed path='embed/feedback'>
                <FeedbackIcon />
              </LandingDemoEmbed>
            </div>
          </FakeBrowser>
        )}
      />
      <FooterHorizontalPanels
        svgD='M 0 49.98 C 229 45 327 -37 500 49.98 L 500 150 L 0 150 Z'
      >
        <GetStartedColumn />
        <Block
          title='Analyze feedback'
          type='column'
          description='Organize all the data you collected to make the right decision'
          image={AnalyzeImg}
          mirror
          buttonTitle='Continue'
          buttonLink='/product/analyze'
          {...FooterHorizontalPanelsBlockProps}
        />
      </FooterHorizontalPanels>
    </>
  );
}


export function LandingPrioritization() {
  return (
    <>
      <Block
        mirror
        type='hero'
        title='Analyze feedback effectively'
        description='Organize all the data you collected to make the right decision'
        image={AnalyzeImg}
      />
      {/* <Demo
        type='demoOnly'
        template={templater => templater.createTemplateV2()}
        spacingTop={0}
        demo={project => (
          <Provider store={project.server.getStore()}>
            <TemplateWrapper<[FeedbackInstance | undefined, RoadmapInstance | undefined, ChangelogInstance | undefined]>
              key={project.server.getProjectId()}
              editor={project.editor}
              mapper={templater => Promise.all([templater.feedbackGet(), templater.roadmapGet(), templater.changelogGet()])}
              renderResolved={(templater, [feedback, roadmap, changelog]) => (
                <DashboardHome
                  server={project.server}
                  editor={project.editor}
                  feedback={feedback}
                  roadmap={roadmap}
                  changelog={changelog}
                />
              )}
            />
          </Provider>
        )}
      /> */}
      <Block
        mirror
        type='mediumDemo'
        title='Manage incoming feedback'
        description='Quickly address incoming feedback in your Feedback Dashboard page.'
        points={[
          'Convert to task',
          'Quickly respond',
          'Merge duplicates',
          'Shelve it for later',
        ]}
        alignItems='center'
        demoImage={DemoDashboardFeedbackVid}
        demoWrap='browser'
      />
      <Block
        type='mediumDemo'
        title='Prioritize your roadmap'
        description='Plan out your tasks in your Roadmap Dashboard page.'
        points={[
          'Drag & drop Kanban style',
          'Customize status workflow',
          'Automatically notify subscribers of updates',
        ]}
        alignItems='center'
        demoImage={DemoDashboardRoadmapVid}
        demoWrap='browser'
      />
      <HorizontalPanels wrapBelow='lg' maxContentWidth='sm' maxWidth='lg' staggerHeight={0}>
        <Container maxWidth='xs'>
          <Demo
            type='column'
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
            title='Tagging'
            description='Organize content into defined set of tags. Create tag groups and define rules how tags can be used.'
            imageStyleOuter={{ padding: 'unset' }}
            image={DemoTaggingImg}
            type='column'
          />
        </Container>
        <Container maxWidth='xs'>
          <Block
            title='Export and analyze externally'
            description='Export your data and feed it into your own analytics engine for insights.'
            type='column'
            imageStyleOuter={{ padding: 'unset' }}
            image={DemoExportedDataImg}
          />
        </Container>
      </HorizontalPanels>
      <Block
        type='headingMain'
        icon={(<LightbulbIcon fontSize='inherit' />)}
        title='Idea Validation'
        description='Get a sense of how successful a feature will be prior to any development work'
        image={IdeasImg}
        imageStyleOuter={{ maxWidth: 350, padding: 0, }}
        alignItems='flex-start'
      />
      <HorizontalPanels wrapBelow='md' maxWidth='lg' maxContentWidth='xs'>
        <Block
          type='column'
          icon={(<ForumIcon fontSize='inherit' />)}
          title='Market audience at your fingertips'
          description='Reach out to customers that are directly interested in your particular idea.'
        />
        <Block
          type='column'
          icon={(<BuildIcon fontSize='inherit' />)}
          title='Recruit BETA users'
          description='Partially roll-out your feature to customers that you know will use it and provide you feedback.'
        />
        <Block
          type='column'
          icon={(<MoodBadIcon fontSize='inherit' />)}
          title="Gauge customer reactions"
          description='Analyze feedback to shape your idea for success.'
        />
      </HorizontalPanels>
      <FooterHorizontalPanels
        svgD='M 0 49.98 C 65 4 191 104 500 49.98 L 500 150 L 0 150 Z'
      >
        <GetStartedColumn />
        <Block
          title='Keep everyone informed'
          description='Take action on what your users are telling you.'
          image={NotifyImg}
          imageLocation='above'
          mirror
          buttonTitle='Continue'
          buttonLink='/product/act'
          {...FooterHorizontalPanelsBlockProps}
        />
      </FooterHorizontalPanels>
    </>
  );
}

export function LandingOpenSource() {
  const { t } = useTranslation('site');
  return (
    <>
      <Block
        type='hero'
        title={t('were-open-source')}
        description={t('build-software-with-us-for')}
        iconAbove
        icon={<OpenSourceIcon fontSize='inherit' />}
        image={VersionControlImg}
        buttonTitle={t('source-code')}
        buttonLinkExt='https://github.com/clearflask/clearflask'
        buttonVariant='contained'
        buttonIcon={(<GithubIcon />)}
      />
      <Block
        title='Why open source?'
        spacingBottom={0}
      />
      <HorizontalPanels wrapBelow='md' maxContentWidth='xs' maxWidth='lg' staggerHeight={100}>
        <Block
          type='column'
          icon={(<CustomerFeedbackIcon fontSize='inherit' />)}
          title='Open product development'
          description='We are targetting companies that are not afraid to open up their product development. It makes sense for us to follow the same path.'
        />
        <Block
          type='column'
          icon={(<AccessibilityIcon fontSize='inherit' />)}
          title='Accessibility'
          description='Some individuals or organizations cannot afford a product financially, but they do have developers to host their own instance and even contribute fixes and features back to the project.'
        />
        <Block
          type='column'
          icon={(<LockSimpleIcon fontSize='inherit' />)}
          title='Lock-in'
          description='Open-source ensures your feet are not swept under you by a vendor if they raise their prices unreasonably, stop maintenance, or keep your data hostage.'
        />
      </HorizontalPanels>
    </>
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
  const classes = useStyles();
  return (
    <>
      <Background svg={{
        d: 'M 0 49.98 C 186 275 271.49 -50 500 49.98 L 500 0 L 0 0 Z',
        viewBox: '0 0 500 150',
        flexible: true,
      }}>
        <Block
          type='hero'
          title='Keep everyone informed'
          description="Let your community and stakeholders know what you're up to."
          image={PublicDiscussionImg}
        />
      </Background>
      <Demo
        icon={(<RoadmapIcon fontSize='inherit' style={{ transform: 'rotate(180deg)' }} />)}
        title='Stay on the same page'
        description='Keep everyone on the same page with your product development'
        image={RoadmapImg}
        imageLocation='above'
        points={[
          'Publicly accessible or privately shared',
          'Customize columns, titles and style',
          'Gather insights along the way',
        ]}
        alignItems='center'
        demoImage={DemoRoadmapImg}
        demoWrap='browser'
      />
      <Demo
        mirror
        icon={(<ChangeIcon fontSize='inherit' />)}
        title='Release an update'
        description='Let everyone know when you release a new feature.'
        image={SupportImg}
        imageLocation='above'
        points={[
          'Discuss changes within your community',
          'Subscribe to new updates',
        ]}
        alignItems='center'
        demoImage={DemoChangelog2Img}
        demoWrap='browser'
      />
      <HorizontalPanels wrapBelow='md' maxWidth='md' maxContentWidth='xs'>
        <Block
          type='column'
          title='Respond to suggestions'
          description='Directly respond to customers regarding their requests and keep them updated with the current status quo'
          icon={(<RespondIcon fontSize='inherit' />)}
          image={DemoPinnedResponseImg}
          imageStyleOuter={{ padding: 'unset' }}
        />
        <Block
          type='column'
          title='Status updates'
          description='Let customers subscribe to updates on specific feature requests.'
          icon={(<NotificationIcon fontSize='inherit' />)}
          image={DemoEmailNotificationImg}
          imageStyleOuter={{ padding: 'unset' }}
          imageScale={0.3}
        />
      </HorizontalPanels>
      <Block
        alignItems='flex-start'
        title='Maintain a two-way communication'
        description={(
          <>
            Feedback from a customer you can reach out to is important for addressing their needs.
            <p>Allow them to be notified using their preferred least-disruptive communication channel.</p>
          </>
        )}
        demoFixedWidth={420}
        image={InternalFeedbackImg}
        imageLocation='above'
        demo={(
          <>
            <div className={classes.point}>
              <KeyIcon fontSize='inherit' className={classes.pointIcon} />
              <div>
                <Typography variant='h6' component='div'>
                  Single Sign-On
                </Typography>
                <Typography variant='body1' component='div' color='textSecondary'>
                  Link existing user accounts
                </Typography>
              </div>
            </div>
            <div className={classes.point}>
              <OpenInNewIcon fontSize='inherit' className={classes.pointIcon} />
              <div>
                <Typography variant='h6' component='div'>
                  OAuth
                </Typography>
                <Typography variant='body1' component='div' color='textSecondary'>
                  External sign-in including
                  &nbsp;
                  <GoogleIcon fontSize='inherit' />
                  &nbsp;
                  <GithubIcon fontSize='inherit' />
                  &nbsp;
                  <FacebookIcon fontSize='inherit' />
                </Typography>
              </div>
            </div>
            <div className={classes.point}>
              <EmailIcon fontSize='inherit' className={classes.pointIcon} />
              <div>
                <Typography variant='h6' component='div'>
                  Email
                </Typography>
                <Typography variant='body1' component='div' color='textSecondary'>
                  Signup with email
                  <br />(Magic link, Domain-whitelist)
                </Typography>
              </div>
            </div>
            <div className={classes.point}>
              <NotificationIcon fontSize='inherit' className={classes.pointIcon} />
              <div>
                <Typography variant='h6' component='div'>
                  Browser push
                </Typography>
                <Typography variant='body1' component='div' color='textSecondary'>
                  Receive a notification right in your browser
                </Typography>
              </div>
            </div>
            <div className={classes.point}>
              <GuestIcon fontSize='inherit' className={classes.pointIcon} />
              <div>
                <Typography variant='h6' component='div'>
                  Guest
                </Typography>
                <Typography variant='body1' component='div' color='textSecondary'>
                  Guests with in-app notifications
                </Typography>
              </div>
            </div>
          </>
        )}
      />
      <Block
        mirror
        title='Create trust in your community'
        description=''
        image={TeamImg}
        imageStyleOuter={{ maxWidth: 400, padding: 0, }}
        alignItems='flex-start'
      />
      <HorizontalPanels wrapBelow='md' maxWidth='lg' maxContentWidth='sm'>
        <Block
          type='column'
          icon={(<TransparentIcon fontSize='inherit' />)}
          title='Embrace a transparent culture'
          description='Customers are loyal to brands they trust and understand.'
        />
        <Block
          type='column'
          icon={(<FeedbackIcon fontSize='inherit' />)}
          title='Understand potential and churned customers'
          description='Receive feedback from potential customers to steer your product towards the market gap and understand the reasons why your customers are leaving.'
        />
        <Block
          type='column'
          icon={(<CommunityIcon fontSize='inherit' />)}
          title='Get involved'
          description='Embrace community discussions with threaded comments, rich editor, and a powerful search to find the right discussion'
        />
      </HorizontalPanels>
      <FooterHorizontalPanels
        svgD='M 0 49.98 C 229 45 327 -37 500 49.98 L 500 150 L 0 150 Z'
      >
        <GetStartedColumn />
        <Block
          title='Integrations'
          type='column'
          description='Bring in your own tools and connect with ClearFlask'
          image={IntegrationImg}
          mirror
          buttonTitle='Continue'
          buttonLink='/product/integrations'
          {...FooterHorizontalPanelsBlockProps}
        />
      </FooterHorizontalPanels>
    </>
  );
}

export function LandingCustomizeHero(props: { isHero?: boolean }) {
  return (
    <Block
      type={props.isHero ? 'hero' : 'headingMain'}
      title='Make it your own'
      description='Our solution can be customized out of the box to fit your specific needs.'
      image={CustomizeImg}
      mirror
      imageStyle={{ paddingBottom: 0, maxWidth: 700 }}
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
    <>
      <LandingCustomizeHero isHero />
      <HorizontalPanels wrapBelow='lg' maxContentWidth='sm' maxWidth='lg' staggerHeight={0}>
        <Container maxWidth='xs'>
          <Block
            type='column'
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
          />
        </Container>
        <Container maxWidth='xs'>
          <Demo
            type='column'
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
    </>
  );
}

export function LandingIntegrations() {
  const classes = useStyles();
  return (
    <>
      <Hero
        title='Integrations'
        description='Use with your existing tools.'
        image={IntegrationImg}
      />
      <HorizontalPanels wrapBelow='sm' maxContentWidth='sm' maxWidth='md' staggerHeight={200}>
        <BlockContent
          variant='content'
          title='API and Webhooks'
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
          title='GitHub'
          description='Mirror GitHub issues and comments with ClearFlask, respond to feedback all from a single place.'
          icon={(
            <img
              alt=''
              className={classes.integrationImage}
              src='/img/landing/github.png'
            />
          )}
          className={classes.smallBlock}
          buttonTitle='Setup'
          buttonLink='/dashboard/settings/project/github'
        />
      </HorizontalPanels>
      <HorizontalPanels wrapBelow='sm' maxContentWidth='sm' maxWidth='md' staggerHeight={200}>
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
          buttonLink='/dashboard/settings/project/google-analytics'
        />
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
          buttonLink='/dashboard/settings/project/hotjar'
        />
      </HorizontalPanels>
      <HorizontalPanels wrapBelow='sm' maxContentWidth='sm' maxWidth='md' staggerHeight={200}>
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
          buttonLink='/dashboard/settings/project/intercom'
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
          postStatusId='zapier-integration-ldt'
        />
      </HorizontalPanels>
      {/* <HorizontalPanels wrapBelow='sm' maxContentWidth='sm' maxWidth='md' staggerHeight={-200}>
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
      </HorizontalPanels> */}
    </>
  );
}

export function LandingFeatureRequestTracking() {
  return (
    <>
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
          icon={(<LightbulbIcon fontSize='inherit' />)}
          title='Idea validation'
          description='Get a sense of how successful a feature will be prior to any development work.'
        />
        <BlockContent
          icon={(<BuildIcon fontSize='inherit' />)}
          title='Recruit Beta users'
          description='Easily find users that are willing to test out your upcoming feature before you roll it out.'
        />
        <BlockContent
          icon={(<ForumIcon fontSize='inherit' />)}
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
          icon={(<EngageIcon fontSize='inherit' />)}
          title='Keep users engaged'
          description="An update to customer's feedback shows good customer relations and may even bring back churned customers."
        />
        <BlockContent
          icon={(<RoadmapIcon fontSize='inherit' style={{ transform: 'rotate(180deg)' }} />)}
          title='Visualize with a Roadmap'
          description='High-level overview of the features currently in your pipeline for users to get an idea of what is going on.'
          buttonTitle='See a Roadmap'
          buttonLink='/solutions/product-roadmap'
        />
      </HorizontalPanels>
      <Block />
      <HorizontalPanels wrapBelow='md' maxContentWidth='xs' maxWidth='lg'>
        <Block
          type='column'
          title='Internal feedback'
          description='Collect feedback from a closed-group of people within your organization or customer-base'
          image={InternalFeedbackImg}
          imageLocation='above'
          buttonTitle='See how'
          buttonLink='/solutions/internal-feedback'
        />
        <Block
          type='column'
          title='Feature Crowdfunding'
          description='Bring in your own tools and connect with ClearFlask'
          image={CrowdfundImg}
          imageLocation='above'
          buttonTitle='Learn more'
          buttonLink='/solutions/feature-crowdfunding'
        />
      </HorizontalPanels>
    </>
  );
}

export function LandingDemo() {
  const { t } = useTranslation('site');
  const classes = useStyles();
  const [customized, setCustomize] = useState<boolean>(false);
  return (
    <>
      <Background svg={{
        d: 'M 0 49.98 C 2 97 124 189 249 86 C 320 36 492 166 500 49.98 L 500 0 L 0 0 Z',
        viewBox: '0 0 500 150',
        flexible: true,
      }} height={500} align='top'>
        <Hero
          title={t('sandbox-demo')}
          description={t('pre-packaged-with-feedback')}
          image={ProudImg}
        />
        <ButtonGroup disableElevation variant='outlined' className={classes.demoCustomizeControl}>
          <Button disabled={!customized} onClick={() => setCustomize(false)}>{t('out-of-the-box')}</Button>
          <Button disabled={customized} onClick={() => setCustomize(true)}>{t('customized')}</Button>
        </ButtonGroup>
        <Demo
          key={customized ? 'custom' : 'not-custom'}
          type='demoOnly'
          spacingTop={0}
          template={async templater => {
            await templater.createTemplateV2({
              ...createTemplateV2OptionsDefault,
              templateFeedbackIsClassic: !!customized,
              templateLanding: !customized,
              templateRoadmap: !customized,
              templateChangelog: !customized,
              infoName: 'GreatProduct',
              infoLogo: `${windowIso.location.protocol}//${windowIso.location.host}/img/landing/GreatProductLogo.png`
            });
            if (customized) templater.styleDark();
            if (customized) templater.templateBlog(true);
          }}
          mock={async mocker => {
            const userMe = await mocker.mockLoggedIn(1000, false);
            await mocker.mockItems(userMe);
          }}
          initialSubPath='/'
          demoFixedWidth='min(100%, 1024px)'
          demoFixedHeight={vh(80)}
          demoWrap={!customized ? 'browser' : 'browser-dark'}
          demoWrapBrowserShowProjectUrlWithPrefix='https://feedback.yoursite.com'
          controlsLocation='top'
          settings={{
            demoScrollY: true,
            suppressSetTitle: true,
          }}
        />
      </Background>
      <Block
        mirror
        type='mediumDemo'
        title={t('feedback')}
        description={t('quickly-address-incoming-feedback-respond')}
        alignItems='center'
        demoImage={DemoDashboardFeedbackVid}
        demoWrap='browser'
      />
      <Block
        type='mediumDemo'
        title={t('roadmap')}
        description={t('plan-out-your-roadmap-with-a-kanban')}
        alignItems='center'
        demoImage={DemoDashboardRoadmapVid}
        demoWrap='browser'
      />
      <Background svg={{
        d: 'M 0 49.98 C 366 -97 79 227 500 49.98 L 500 150 L 0 150 Z',
        viewBox: '0 0 500 150',
        flexible: true,
      }}>
        <Block
          mirror
          title={t('love-it')}
          description={t('try-it-out-yourself-for-free-and')}
          buttonTitle={t('try-it')}
          buttonLink='/signup'
          buttonVariant='contained'
          buttonSuppressIcon
        />
      </Background>
    </>
  );
}

// TODO other example roadmaps of:
// - Software development workflow: Planned, In Progress, Recently completed
// - Crowdfunding: Gathering feedback, Funding, Funded
// - Custom (language courses): Gaining traction, Beta, Public
// - Custom (Game ideas): Semi-finals, Selected
export function LandingPublicRoadmap() {
  return (
    <>
      <Hero
        title='Product Roadmap'
        description='Transparency between development and customers for stronger ties with your community.'
        image={Roadmap2Img}
      />
      <Demo
        initialSubPath='/embed/demo'
        type='demoOnly'
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
          icon={(<LightbulbIcon fontSize='inherit' />)}
          title='Clear and concise'
          description="Simple view of your current progress and future plans. That's it!"
        />
        <BlockContent
          variant='content'
          icon={(<TransparentIcon fontSize='inherit' />)}
          title='Transparency for customers and stakeholders'
          description='Commit to a customer-driven product development and keep your audience informed.'
        />
        <BlockContent
          variant='content'
          icon={(<UpcomingFeaturesIcon fontSize='inherit' />)}
          title='Upcoming features'
          description='Let your community get excited about what you are working on. Keep them in-the-know of your hard work behind the scenes.'
        />
      </HorizontalPanels>
      <Block />
      <HorizontalPanels wrapBelow='lg' maxWidth='md' maxContentWidth='xs'>
        <Block
          type='column'
          title='Subscribe to updates'
          description='Keep users engaged with feature updates.'
          image={DemoEmailNotificationImg}
          imageScale={0.3}
          mirror
          alignItems='center'
        />
        <Demo
          type='column'
          title='Embrace discussions'
          description='Shape your features by directly communicating with your customer base.'
          alignItems='center'
          initialSubPath='/embed/demo'
          demoFixedHeight={450}
          scale={0.7}
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
      </HorizontalPanels>
      <Demo
        title='Customize'
        description='Change the columns, content, and labels. You can even create multiple roadmaps for different stakeholders.'
        initialSubPath='/embed/demo'
        type='mediumDemo'
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
        buttonTitle='See more customizations'
        buttonLink='/product/customize'
      />
    </>
  );
}

export function LandingCrowdFunding() {
  return (
    <>
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
          icon={(<ApiIcon fontSize='inherit' />)}
          title='SAAS Products'
          description='Most common use case is to give SAAS customers credits based on their subscription'
        />
        <BlockContent
          icon={(<DonationIcon fontSize='inherit' />)}
          title='Donation-based / Freemium'
          description='Let users with the highest contributions dictate where your product should go.'
        />
        <BlockContent
          icon={(<ContentCreatorIcon fontSize='inherit' />)}
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
      <Block
        title='Feature request tracking'
        description='Tool to keep organized and drive your product forward'
        image={FeatureRequestImg}
        imageLocation='above'
        mirror
        buttonTitle='See how'
        buttonLink='/solutions/feature-request-tracking'
      />
    </>
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
    <>
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
            showVoting: false,
            showVotingCount: true,
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
      <HorizontalPanels wrapBelow='lg' maxWidth='lg' maxContentWidth='sm' staggerHeight={0}>
        <Block
          type='column'
          icon={(<NotificationIcon fontSize='inherit' />)}
          title='Keep your stakeholders informed'
          description='Keep your stakeholders up-to-date with notifications over email or web-push.'
          image={DemoEmailNotificationImg}
          imageScale={0.4}
          alignItems='center'
          mirror
        />
        <Block
          type='column'
          icon={(<PrivacyIcon fontSize='inherit' />)}
          title='Keep all your data private'
          description='Setup privacy settings so only your users can see and post feedback. Authenticate via Single Sign-On, OAuth or whitelist your email domain.'
          image={DemoProjectPrivateImg}
          imageScale={0.5}
          alignItems='center'
        />
      </HorizontalPanels>
      <Demo
        type='mediumDemo'
        title='Transparency in your workload'
        description='Let your co-workers see your work in order to understand your prioritization of their requests.'
        initialSubPath='/embed/demo'
        image={Roadmap2Img}
        imageLocation='above'
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
        buttonLink='/solutions/product-roadmap'
      />
    </>
  );
}

export function LandingIdeaManagement() {
  return (
    <>
      <Hero
        title='Idea Management'
        description='Collect and organize ideas from your users, customers or coworkers'
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
        buttonLink='/solutions/product-roadmap'
      />
      <HorizontalPanels wrapBelow='lg' maxWidth='lg' maxContentWidth='sm' staggerHeight={0}>
        <Block
          type='column'
          title='Keep all ideas in one place'
          description='Keep forgetting what people asked you in-person or over email? Combine all your feedback channels into a single place to keep tidy and organized.'
          image={CentralizeImg}
          alignItems='center'
          mirror
        />
        <Block
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
          type='column'
          icon={(<CategoryIcon fontSize='inherit' />)}
          title='Organize ideas into buckets'
          description='With custom tags, organize ideas and assign to different teammates. You can also allow users to directly select the relevant tags themselves.'
          image={DemoTagging2Img}
          imageScale={0.4}
          mirror
          alignItems='center'
        />
        <Demo
          type='column'
          icon={(<LifecycleIcon fontSize='inherit' />)}
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
          type='column'
          icon={(<EditIcon fontSize='inherit' />)}
          title='Make it your own'
          description="our tool can be customized to your needs whether you are collecting students' opinions, employee suggestion box, or product feedback."
          buttonTitle='See more customizations'
          buttonLink='/product/customize'
        />
      </HorizontalPanels>
      <Block
        title='Act'
        description='Take action based on what you have learnt.'
        image={LoopImg}
        mirror
        alignItems='center'
        buttonTitle='See how'
        buttonLink='/product/act'
      />
    </>
  );
}

export function LandingContentCreator() {
  return (
    <>
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
          type='column'
          icon={<CustomerFeedbackIcon />}
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
              showVoting: false,
              showVotingCount: true,
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
          type='column'
          title='1# Link with your platform'
          description='If you are taking donations or payments for your content, link your platform to automatically issue'
          demo={(<LandingCreditSystemLinkOptions donationFirst />)}
        />
        <Block
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
        buttonLink='/solutions/product-roadmap'
      />
      <Block
        title='Let your fans know'
        description='Your fans will be thrilled their particular idea came to life.'
        image={DemoEmailNotification2Img}
        imageScale={0.4}
        mirror
        alignItems='center'
      />
    </>
  );
}

export function LandingGrowWithUs() {
  return (
    <>
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
          icon={(<OncallIcon fontSize='inherit' />)}
          title='On-call'
          description='Our engineers are on-call 24/7 to resolve any elevated issues brought up by our automatic monitoring.'
        />
        <BlockContent
          icon={(<ServerIcon fontSize='inherit' />)}
          variant='content'
          title='Compute'
          description='All of our server infrastructure is auto-scaled to meet your traffic demand.'
        />
        <BlockContent
          icon={(<StorageIcon fontSize='inherit' />)}
          variant='content'
          title='Storage'
          description='Data is stored on a NoSQL Dynamo database and distributed Object Storage S3 that allows us to scale with ease.'
        />
        <BlockContent
          icon={(<BackupIcon fontSize='inherit' />)}
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
          icon={(<ContentDeliveryIcon fontSize='inherit' />)}
          variant='content'
          title='Content Delivery Network'
          description='ClearFlask is hosted by CloudFront: a large network of globally distributed PoPs that deliver low-latency performance and high-availability.'
        />
        <BlockContent
          icon={(<SearchIcon fontSize='inherit' />)}
          variant='content'
          title='Search engine'
          description='We use ElasticSearch: a powerful search engine to provide you relevant results within large datasets.'
        />
        <BlockContent
          icon={(<ClientIcon fontSize='inherit' />)}
          variant='content'
          title='Client-side Framework'
          description='Once you load our page, we use React to deliver a responsive interface to your users with a Material design that is pleasing to use.'
        />
        <BlockContent
          icon={(<ServerIcon fontSize='inherit' />)}
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
          icon={(<EncryptionIcon fontSize='inherit' />)}
          variant='content'
          title='Encryption'
          description='All pages are only accessible over encrypted channels. If you use a custom domain, we automatically generate a certificate for you via LetsEncrypt.'
        />
        <BlockContent
          icon={(<AntiSpamIcon fontSize='inherit' />)}
          variant='content'
          title='Anti-Spam'
          description='Our backend system is monitoring unusual behavior and will issue Anti-Spam measures. Our team has past experience working on Anti-spam at a popular messenger.' />
        <BlockContent
          icon={(<BillingIcon fontSize='inherit' />)}
          variant='content'
          title='Billing system'
          description='For reliable billing, we use KillBill to handle managing your final invoice and processing your payments.'
        />
      </HorizontalPanels>
    </>
  );
}

// export function LandingAboutUs() {
//   return (
//     <>
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
//     </>
//   );
// }

export function LandingCompare() {
  return (<Competitors />);
}

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
export function LandingPricingOptions() {
  const { t } = useTranslation('site');
  return (
    <FooterHorizontalPanels
      title={t('lets-get-started')}
      svgD='M 0 49.98 C 411 265 386 -17 500 49.98 L 500 150 L 0 150 Z'
    >
      <Block
        icon={(<ServerIcon fontSize='inherit' />)}
        title={t('cloud-offering')}
        description={t('hassle-free-scalable-solution-with')}
        buttonTitle={t('try-for-free')}
        buttonLink='/signup'
        button2Title={t('pricing')}
        button2Link='/pricing'
        buttonSuppressIcon
        image={Server2Img}
        {...FooterHorizontalPanelsBlockProps}
      />
      <Block
        icon={(<OpenSourceIcon fontSize='inherit' />)}
        title={t('self-hosting')}
        description={t('open-source-with-no-limitations-own')}
        buttonTitle={t('install-it')}
        buttonLinkExt='https://github.com/clearflask/clearflask/blob/master/INSTALLATION.md'
        buttonVariant='contained'
        buttonSuppressIcon
        image={Server3Img}
        {...FooterHorizontalPanelsBlockProps}
      />
    </FooterHorizontalPanels>
  );
}
const FooterHorizontalPanelsBlockProps: Partial<React.ComponentProps<typeof Block>> = {
  type: 'column',
  titleVariant: 'h4',
  imageLocation: 'above',
  imageStyleOuter: { minHeight: 300 },
};
export function FooterHorizontalPanels(props: {
  title?: string;
  svgD: string;
  children?: any;
}) {
  const classes = useStyles();
  return (
    <>
      <Background svg={{
        d: props.svgD,
        viewBox: '0 0 500 150',
        flexible: true,
      }}>
        <Block
          className={classes.textAlignCenter}
          type='headingOnly'
          title={props.title}
        />
      </Background>
      <Background backgroundColor={fade('#218774', 0.05)}>
        <HorizontalPanels wrapBelow='md' maxContentWidth='xs' maxWidth='lg'>
          {props.children}
        </HorizontalPanels>
        <br />
        <br />
        <br />
        <br />
      </Background>
    </>
  );
}
export function LandingPricing() {
  return (
    <>
      <PricingPage />
    </>
  );
}
export function GetStartedColumn() {
  const { t } = useTranslation('site');
  return (
    <>
      <Block
        type='column'
        title={t('get-started')}
        description='Try out all the features during your trial period.'
        buttonTitle='Try for free'
        buttonLink='/signup'
        button2Title='Pricing'
        button2Link='/pricing'
        buttonSuppressIcon
        image={TeamImg}
        {...FooterHorizontalPanelsBlockProps}
      />
    </>
  );
}

export function LandingPromo() {
  return (
    <>
      <Background svg={{
        d: 'M 0 49.98 Q 59 131 226 93 C 374 59 387 188 500 176 L 500 0 L 0 0 Z',
        viewBox: '0 0 500 150',
      }} width={2400} height={1000}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ margin: '180px 150px 50px 0px' }}>
            <Logo scale={5} />
          </div>
          <div style={{ margin: '0px 0px 30px' }}>
            <Typography variant='h3' color='textSecondary'>
              Open-source feedback tool<br /> to build better products.
            </Typography>
          </div>
        </div>
      </Background>
      <div style={{ zIndex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <FakeBrowser fixedWidth={1000}>
          <ImgIso img={DemoPageFeedbackClassigImg} />
        </FakeBrowser>
      </div>

      <Hr margins={300} />

      <Background svg={{
        d: 'M 0 177 Q 113 188 226 116 C 359 65 400 154 502 107 L 500 0 L 0 0 Z',
        viewBox: '0 0 500 150',
      }} width={2400} height={1000}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ margin: '100px 700px 0px 0px' }}>
            <Logo scale={1} />
          </div>
        </div>
      </Background>
      <Block
        title='Product feedback'
        type='headingMain'
        xlargePoints
        points={[
          'Ask for feedback',
          'Validate new ideas',
          'Easy integration',
        ]}
        alignItems='center'
        demoFixedWidth='100%'
        demoFixedHeight={500}
        spacingTop={0}
        demo={(
          <Stack
            float='right'
            contentSpacingVertical={200}
            items={[{
              height: 'max-content',
              width: 800,
              content: (
                <FakeBrowser>
                  <ImgIso img={DemoFeedbackWhatElseImg} />
                </FakeBrowser>
              )
            }, {
              height: 'max-content',
              width: 330,
              content: (
                <FakeBrowser>
                  <ImgIso img={DemoFeedbackImg} />
                </FakeBrowser>
              )
            }]}
          />
        )}
      />

      <Hr margins={300} />

      <Background align='top' svg={{
        d: 'M 0 177 Q 130 27 287 139 C 362 182 408 258 501 229 L 500 0 L 0 0 Z',
        viewBox: '0 0 500 200',
      }} width={2400} height={1000}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ margin: '100px 0px 0px 700px' }}>
            <Logo scale={1} />
          </div>
        </div>
        <Block
          mirror
          title='Analyze ideas'
          type='headingMain'
          xlargePoints
          points={[
            'Convert ideas to tasks',
            'Prioritize your roadmap',
            'Estimate value/effort',
          ]}
          alignItems='center'
          demoFixedWidth='100%'
          spacingTop={0}
          demo={(
            <Stack
              contentSpacingVertical={200}
              float='right' // overflow left
              items={[{
                content: (<ImgIso img={DemoDashboardRoadmapImg} />),
                height: 'max-content',
              }, {
                content: (<ImgIso img={DemoDashboardFeedbackImg} />),
                height: 'max-content',
              }]}
            />
          )}
        />
      </Background>

      <Hr margins={300} />

      <Background align='top' svg={{
        d: 'M 0 177 Q 166 -61 287 139 C 351 239 408 258 501 229 L 500 0 L 0 0 Z',
        viewBox: '0 0 500 200',
      }} width={2400} height={1000}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ margin: '100px 700px 0px 0px' }}>
            <Logo scale={1} />
          </div>
        </div>
        <Block
          title='Keep everyone informed'
          type='headingMain'
          xlargePoints
          points={[
            'Public Roadmap',
            'Announcements',
          ]}
          alignItems='center'
          demoFixedWidth='100%'
          spacingTop={0}
          demo={(
            <Stack
              // topLeftToBottomRight
              // ascendingLevel
              float='right'
              contentSpacingVertical={280}
              items={[{
                content: (
                  <FakeBrowser>
                    <ImgIso img={DemoRoadmapImg} />
                  </FakeBrowser>
                ),
                width: 800,
                height: 'max-content',
              }, {
                content: (
                  <FakeBrowser>
                    <ImgIso img={DemoChangelogImg} />
                  </FakeBrowser>
                ),
                width: 550,
                height: 'max-content',
              }]}
            />
          )}
        />
      </Background>

      <Hr margins={300} />

      <Background align='top' svg={{
        d: 'M 0 177 Q 125 33 287 139 C 423 208 473 120 501 229 L 500 0 L 0 0 Z',
        viewBox: '0 0 500 200',
      }} width={2400} height={1000}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ margin: '100px 700px 0px 0px' }}>
            <Logo scale={1} />
          </div>
        </div>
        <div style={{ margin: '180px 150px 50px 0px' }}>
          <FeedbackIcon fontSize='inherit' style={{ fontSize: '5em', margin: 'auto' }} />
        </div>
      </Background>

      <Hr margins={300} />

    </>
  );
}

export function LandingEmbedFeedbackPage(props: {
  browserPathPrefix: string;
  embed?: boolean;
}) {
  const account = useSelector<ReduxStateAdmin, Admin.AccountAdmin | undefined>(state => state.account.account.account, shallowEqual);

  return (
    <IframeWithUrlSync
      redirectOnDirectAccess=''
      browserPathPrefix={props.browserPathPrefix}
      srcWithoutPathname={isProd() ? 'https://product.clearflask.com' : `${windowIso.location.protocol}//product.${windowIso.location.host}`}
      pathnamePrefix={props.embed ? '/embed' : undefined}
      initialQuery={account?.cfJwt ? `?${SSO_TOKEN_PARAM_NAME}=${account.cfJwt}` : undefined}
      frameBorder='0'
      height={vh(100)}
      width='100%'
    />
  );
}

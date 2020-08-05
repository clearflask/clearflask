import { Container, Typography, Box, CircularProgress } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import PaymentIcon from '@material-ui/icons/AccountBalance';
import ApiIcon from '@material-ui/icons/Code';
/** Alternative: FreeBreakfast */
import DonationIcon from '@material-ui/icons/FavoriteBorder';
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import * as Client from '../api/client';
import AppThemeProvider from '../app/AppThemeProvider';
import CommentList from '../app/comps/CommentList';
import { CreateTemplateOptions, createTemplateOptionsDefault } from '../common/config/configTemplater';
import Block from './landing/Block';
import BlockContent from './landing/BlockContent';
import Demo from './landing/Demo';
import Hero from './landing/Hero';
import HorizontalPanels from './landing/HorizontalPanels';
import PrioritizationControlsCredits from './landing/PrioritizationControlsCredits';
import PrioritizationControlsExpressions from './landing/PrioritizationControlsExpressions';
import PrioritizationControlsVoting from './landing/PrioritizationControlsVoting';
import RoadmapControls from './landing/RoadmapControls';
import ScrollAnchor, { SCROLL_TO_STATE_KEY } from '../common/util/ScrollAnchor';
import classNames from 'classnames';
import CollectIcon from '@material-ui/icons/RecordVoiceOverRounded';
import PrioritizeIcon from '@material-ui/icons/FormatListNumbered';
import RoadmapIcon from '@material-ui/icons/EqualizerRounded';
import NotificationIcon from '@material-ui/icons/Notifications';
import AnalyticsIcon from '@material-ui/icons/ShowChart';
import VoteIcon from '@material-ui/icons/ThumbsUpDown';
import EmojiIcon from '@material-ui/icons/Mood';
import SegmentIcon from '@material-ui/icons/FilterList';
import WidgetIcon from '@material-ui/icons/Widgets';
import PostStatusIframe from '../app/PostStatusIframe';
import PricingPage from './PricingPage';

const styles = (theme: Theme) => createStyles({
  marker: {
    color: theme.palette.text.hint,
  },
  pointsContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    width: '100%',
  },
  point: {
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
    margin: theme.spacing(2),
  },
  pointIcon: {
    fontSize: '2em',
    margin: theme.spacing(0, 4, 0, 0),
  },
  overlapContainer: {
    position: 'relative',
  },
  textCircleContainer: {
    margin: 'auto',
    maxWidth: '100%',
    [theme.breakpoints.up('lg')]: {
      width: 1500,
      height: 1200,
      maxHeight: 1200,
    },
    [theme.breakpoints.down('md')]: {
      width: 900,
      height: 900,
      maxHeight: 900,
    },
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
    alignSelf: 'flex-end',
    justifyContent: 'end',
    [theme.breakpoints.up('lg')]: {
      paddingRight: 150,
      boxSizing: 'content-box',
    },
  },
  textCircleItemTwo: {
    alignSelf: 'flex-start',
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
    borderColor: theme.palette.primary.main,
    [theme.breakpoints.up('lg')]: {
      opacity: 0.1,
    },
    [theme.breakpoints.down('md')]: {
      opacity: 0.03,
    },
  },
});
interface State {
  scrollTo?: string;
}
class LandingPage extends Component<WithStyles<typeof styles, true>, State> {
  state:State = {};

  render() {
    return (
      <React.Fragment>
        {this.renderHero()}
        {this.renderLoop()}
        {this.renderCollectFeedback()}
        {this.renderPrioritization()}
        {this.renderEngagement()}
        {this.renderCaseStudies()}
        {this.renderCustomize()}
        {this.renderPricing()}
        {this.renderSales()}
      </React.Fragment>
    );
  }

  renderHero() {
    return (
      <Hero
        title='Product Feedback Solution for transparent organizations'
        description='An idea brainstorming tool with cost/benefit prioritization of user feedback to drive your product forward.'
        imagePath='/img/landing/hero.svg'
      />
    );
  }

  renderDemo() {
    const opts: CreateTemplateOptions = {
      ...createTemplateOptionsDefault,
      fundingAllowed: false,
    };
    return (
      <Container maxWidth='lg'>
        <Demo
          type='demoOnly'
          edgeType='outline'
          demoFixedHeight={500}
          template={templater => templater.demo(opts)}
          mock={mocker => mocker.templateMock(opts)}
          settings={{
            demoMenuAnimate: [
              { path: 'feedback' },
              { path: 'roadmap' },
            ],
          }}
        />
      </Container>
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
                <div className={this.props.classes.pointsContainer}>
                  <div>Collect all feedback channels into unified place. Influence your product decisions based on data.</div>
                  <div className={this.props.classes.point}>
                    <WidgetIcon fontSize='inherit' className={this.props.classes.pointIcon} />
                    <div>Embed in your product</div>
                  </div>
                  <div className={this.props.classes.point}>
                    <AnalyticsIcon fontSize='inherit' className={this.props.classes.pointIcon} />
                    <div>Customer segmentation and Analytics</div>
                  </div>
                </div>
              )}
              buttonTitle='Learn more'
              buttonOnClick={() => this.setState({scrollTo: 'collect'})}
            />
          </div>
          <div className={this.props.classes.textCircleItemContainer}>
            <BlockContent
              className={classNames(this.props.classes.textCircleItemTwo, this.props.classes.textCircleItem)}
              variant='content'
              titleCmpt='div'
              title='A proportionate voice'
              description={(
                <div className={this.props.classes.pointsContainer}>
                  <div>Prioritize feedback based on customer's voice with our options that fit your needs:</div>
                  <div className={this.props.classes.point}>
                    <VoteIcon fontSize='inherit' className={this.props.classes.pointIcon} />
                    <div>Voting</div>
                  </div>
                  <div className={this.props.classes.point}>
                    <PaymentIcon fontSize='inherit' className={this.props.classes.pointIcon} />
                    <div>Credit System</div>
                  </div>
                </div>
              )}
              buttonTitle='Learn more'
              buttonOnClick={() => this.setState({scrollTo: 'prioritize'})}
            />
          </div>
          <div className={classNames(this.props.classes.textCircleItemContainer, this.props.classes.textCircleItemThreeContainer)}>
            <div style={{width: '10%'}} />
            <BlockContent
              className={classNames(this.props.classes.textCircleItemThree, this.props.classes.textCircleItem)}
              variant='content'
              titleCmpt='div'
              title='Engage your customers'
              description={(
                <div className={this.props.classes.pointsContainer}>
                  <div>Build a community around your product development</div>
                  <div className={this.props.classes.point}>
                    <RoadmapIcon fontSize='inherit' className={this.props.classes.pointIcon} style={{transform: 'rotate(180deg)'}} />
                    <div>Show off your Product Roadmap</div>
                  </div>
                  <div className={this.props.classes.point}>
                    <NotificationIcon fontSize='inherit' className={this.props.classes.pointIcon} />
                    <div>Notify users waiting for a particular feature</div>
                  </div>
                </div>
              )}
              buttonTitle='Learn more'
              buttonOnClick={() => this.setState({scrollTo: 'engage'})}
            />
          </div>
        </div>
        <div
          className={this.props.classes.circleContainer}
          style={{zIndex: 1}}
        >
          <span className={this.props.classes.circle} />
        </div>
      </div>
    );
  }

  onboardingDemoRef: React.RefObject<any> = React.createRef();
  renderCollectFeedback() {
    return (
      <React.Fragment>
        {this.state.scrollTo === 'collect' && (
          <ScrollAnchor scrollOnMount positionVertical='start' />
        )}
        <Demo
          title='Understand your customer needs'
          description='Collect customer feedback from all your support channels seamlessly into one scalable funnel. Drive your product forward with customers in mind.'
          displayAlign='flex-start'
          demoFixedHeight={400}
          initialSubPath='/embed/demo'
          template={templater => templater.demoExplorer({
            allowCreate: { actionTitle: 'Suggest', actionTitleLong: 'Suggest an idea' },
            allowSearch: { enableSort: false, enableSearchText: true, enableSearchByCategory: false, enableSearchByStatus: false, enableSearchByTag: false },
          }, undefined, undefined, { descriptionTruncateLines: 2 }, { limit: 2 })}
          mock={mocker => mocker.demoFeedbackType()}
          settings={{
            demoForceExplorerCreateHasSpace: false,
            demoDisableExpand: true,
            // demoBlurryShadow: true,
            demoCreateAnimate: {
              title: 'Add Dark Mode',
              description: 'To reduce eye-strain, please add a dark mode option',
              similarSearchTerm: 'theme',
            },
          }}
        />
        <HorizontalPanels wrapBelow='lg' maxWidth='xl' maxContentWidth='sm' staggerHeight={120}>
          {/* Collect feedback right from your website or app */}
          {/* Prioritize based on customer value */}
          {/* Keep your users updated */}
          {/* Explore */}
          {/* <Demo
            variant='content'
            type='column'
            title='Single Sign-On to for existing users or use our frictionless signup'
            description='New user sign up is optimized for conversion with several choices of options for users to receive updates. The best experience is using Single Sign-On with your existing account system.'
            initialSubPath='/embed/demo'
            demoFixedWidth={420}
            template={templater => {
              setInitSignupMethodsTemplate(templater);
              templater.styleWhite();
            }}
            controls={project => (<OnboardingControls onboardingDemoRef={this.onboardingDemoRef} templater={project.templater} />)}
            demo={project => (<OnboardingDemo defaultDevice={Device.Desktop} innerRef={this.onboardingDemoRef} server={project.server} />)}
          /> */}
          <Demo
            variant='content'
            type='column'
            title='Powerful search reduces duplicate submissions'
            description='Search engine powered by ElasticSearch ensures users do not create duplicate feedback.'
            initialSubPath='/embed/demo'
            scale={0.7}
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
          />
          <BlockContent
            variant='content'
            title='Capture feedback from internal teams or on-behalf of users'
            description='Provide your sales, support, engineering team an opportunity to voice their suggestions. Capture feedback from other channels and record it on-behalf of users.'
          />
          <BlockContent
            variant='content'
            title='Integrate with your product'
            description='Provide your sales, support, engineering team an opportunity to voice their suggestions. Capture feedback from other channels and record it on-behalf of users.'
          />
        </HorizontalPanels>
      </React.Fragment>
    );
  }

  renderPrioritization() {
    return (
      <React.Fragment>
        {this.state.scrollTo === 'prioritize' && (
          <ScrollAnchor scrollOnMount positionVertical='start' />
        )}
        <Demo
          title='Give your valuable customers a proportionate voice'
          description='Assign voting power based on customer value and let them prioritize your suggestion box. Your users will love knowing their voice has been heard.'
          mirror
          demoFixedHeight={300}
          initialSubPath='/embed/demo'
          template={templater => templater.demoPrioritization('all')}
          mock={mocker => mocker.demoPrioritization()}
          settings={{
            demoFlashPostVotingControls: true,
          }}
        />
        <HorizontalPanels wrapBelow='md' maxWidth='lg' maxContentWidth='xs' staggerHeight={-200}>
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
              demoFundingControlAnimate: [
                { index: 0, fundDiff: 20 },
                { index: 1, fundDiff: -30 },
                { index: 2, fundDiff: 20 },
              ],
            }}
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
            title='Keep it simple with voting'
            description='Most common and simplest to understand by users. Customer value and segmentation can be applied behind the scenes.'
            initialSubPath='/embed/demo'
            template={templater => templater.demoPrioritization('vote')}
            controls={project => (<PrioritizationControlsVoting templater={project.templater} />)}
            mock={mocker => mocker.demoPrioritization()}
            settings={{
              demoVotingExpressionsAnimate: [
                { type: 'vote', upvote: true },
              ],
            }}
            demoFixedHeight={150}
            containerPortal
          />
        </HorizontalPanels>
        <Block
          // variant='content'
          title='Give credits to users based on their contribution'
          description='When a customer completes a purchase, issue them credit.'
          alignItems='center'
          demo={(
            <div className={this.props.classes.pointsContainer}>
              <div className={this.props.classes.point}>
                <PaymentIcon fontSize='inherit' className={this.props.classes.pointIcon} />
                <div>
                  <Typography variant='h6'>
                    Payment provider
                    &nbsp;
                    <PostStatusIframe
                      postId='customer-segmentation-and-analytics'
                      height={14}
                      config={{ color: 'grey', fontSize: '0.8em', alignItems: 'end', justifyContent: 'start', textTransform: 'uppercase', }}
                    />
                  </Typography>
                  <Typography variant='body1'>
                    Stripe, Apple Store, Play Store
                  </Typography>
                </div>
              </div>
              <div className={this.props.classes.point}>
                <DonationIcon fontSize='inherit' className={this.props.classes.pointIcon} />
                <div>
                  <Typography variant='h6'>
                    Donation Framework
                    &nbsp;
                    <PostStatusIframe
                      postId='donation-framework'
                      height={14}
                      config={{ color: 'grey', fontSize: '0.8em', alignItems: 'end', justifyContent: 'start', textTransform: 'uppercase', }}
                    />
                  </Typography>
                  <Typography variant='body1'>
                    Patreon, OpenCollective
                  </Typography>
                </div>
              </div>
              <div className={this.props.classes.point}>
                <ApiIcon fontSize='inherit' className={this.props.classes.pointIcon} />
                <div>
                  <Typography variant='h6'>
                    Custom source
                  </Typography>
                  <Typography variant='body1'>
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
        {this.state.scrollTo === 'engage' && (
          <ScrollAnchor scrollOnMount positionVertical='start' />
        )}
        <Demo
          title='Build a community around your product'
          description='Whether you are starting out or have a product on the market, keep your users updated at every step. Let them be involved in your decision making and shape your product.'
          alignItems='center'
          initialSubPath='/embed/demo'
          // scale={0.7}
          template={templater => {
            templater.demoCategory();
            templater.styleWhite();
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
                />
              </AppThemeProvider>
            </Provider>
          )}
        />
        {/* // TODO add example roadmaps of:
        // - Software development workflow: Planned, In Progress, Recently completed
        // - Crowdfunding: Gathering feedback, Funding, Funded
        // - Custom (language courses): Gaining traction, Beta, Public
        // - Custom (Game ideas): Semi-finals, Selected */}
        <Demo
          title='Show off your progress'
          description='Customizable roadmaps lets you organize your process. Get your users excited about upcoming improvements.'
          mirror
          initialSubPath='/embed/demo'
          displayAlign='flex-end'
          // scale={0.7}
          type='largeDemo'
          template={templater => templater.demoBoardPreset('development')}
          mock={mocker => mocker.demoBoard([
            { status: '0', extra: { voteValue: 14, expressions: { '❤️': 4, '🚀': 1 } } },
            { status: '0', extra: { voteValue: 7, expressions: { '👍': 1, '😕': 2 } } },
            { status: '0', extra: { voteValue: 2, expressions: { '👍': 1 } } },
            { status: '1', extra: { funded: 7800, fundGoal: 9000, fundersCount: 12, expressions: { '😍': 2 } } },
            { status: '1', extra: { funded: 500, fundGoal: 5000, fundersCount: 1, expressions: { '👀': 1 } } },
            { status: '2', extra: { funded: 6700, fundGoal: 5000, fundersCount: 32, } },
            { status: '2', extra: { funded: 24300, fundGoal: 20000, fundersCount: 62 } },
          ])}
          settings={{
            demoBlurryShadow: true,
          }}
          controls={project => (<RoadmapControls templater={project.templater} />)}
        />
        <HorizontalPanels wrapBelow='md' maxWidth='lg' maxContentWidth='sm' staggerHeight={120}>
          <BlockContent
            variant='content'
            title='Activate users waiting for a particular feature'
            description='Notifications blah blah asdf adasdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf ad'
          />
          <BlockContent
            variant='content'
            title='Respond to suggestions to let your users know'
            description='Suggestion Admin Reply and Status change asdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf ad'
          />
          <BlockContent
            variant='content'
            title='Get involved in community discussions'
            description='Threaded comments, forums blah blah ads asdf adasdfasfdsa fasd fdas fads ads asdf ad'
          />
        </HorizontalPanels>
      </React.Fragment>
    );
  }

  renderCustomize() {
    return (
      <React.Fragment>
        <Block
          title='Make it your own'
          description='Custom workflows, prioritization and branding to fit your needs.'
        />
      </React.Fragment>
    );
  }

  renderSales() {
    return (
      <Block
        title='Every customer is different'
        description='Talk to our sales for a demo walkthrough and to determine how our solution can be customized for your needs.'
        buttonTitle='Get in touch'
        buttonLink='/contact/sales'
        mirror
      />
    );
  }
  renderPricing() {
    return (
      <PricingPage />
    );
  }
}

export default withStyles(styles, { withTheme: true })(LandingPage);

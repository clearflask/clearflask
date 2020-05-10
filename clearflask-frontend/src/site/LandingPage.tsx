import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import * as Client from '../api/client';
import CommentList from '../app/comps/CommentList';
import { CreateTemplateOptions, createTemplateOptionsDefault } from '../common/config/configTemplater';
import { Device } from '../common/DeviceContainer';
import { SCROLL_TO_STATE_KEY } from '../common/util/ScrollAnchor';
import { description as collectDescription, title as collectTitle } from './CollectPage';
import { transparencyDescription, transparencyTitle } from './EngagePage';
import Block from './landing/Block';
import BlockContent from './landing/BlockContent';
import Demo from './landing/Demo';
import Demos from './landing/Demos';
import FundingControlDemo from './landing/FundingControlDemo';
import Hero from './landing/Hero';
import HorizontalPanels from './landing/HorizontalPanels';
import { setInitSignupMethodsTemplate } from './landing/OnboardingControls';
import OnboardingDemo from './landing/OnboardingDemo';
import { prioritizationDescription, prioritizationTitle } from './PrioritizePage';

const styles = (theme: Theme) => createStyles({
});

class LandingPage extends Component<WithStyles<typeof styles, true>> {

  render() {
    return (
      <React.Fragment>
        {this.renderHero()}
        {this.renderCollectFeedback()}
        {this.renderPrioritization(true)}
        {this.renderCaseStudies()}
        {this.renderEngagement(true)}
        {this.renderCustomize()}
        {this.renderSales(true)}
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

  renderCollectFeedback(mirror?: boolean) {
    const opts: CreateTemplateOptions = {
      ...createTemplateOptionsDefault,
      fundingAllowed: false,
    };
    return (
      <React.Fragment>
        <Demo
          title={collectTitle}
          description={collectDescription}
          mirror={mirror}
          type='largeDemo'
          edgeType='outline'
          edgeSpacing
          // scale={0.7}
          demoFixedHeight={400}
          template={templater => templater.demo(opts)}
          mock={mocker => mocker.templateMock(opts)}
        />
        <HorizontalPanels wrapBelow='lg' maxWidth='xl' maxContentWidth='xs' staggerHeight={50}>
          <Demo
            variant='content'
            type='column'
            title='Seamless onboarding'
            description='New user sign up is optimized for conversion with several choices of options for users to receive updates. The best experience is using Single Sign-On with your existing account system.'
            initialSubPath='/embed/demo'
            template={templater => {
              setInitSignupMethodsTemplate(templater);
              templater.styleWhite();
            }}
            scale={0.6}
            demoFixedHeight={330}
            demo={project => (<OnboardingDemo defaultDevice={Device.None} server={project.server} />)}
            buttonTitle='See all options'
            buttonLink='/collect'
            buttonState={{ [SCROLL_TO_STATE_KEY]: 'onboarding' }}
          />
          <Demo
            variant='content'
            type='column'
            title='Powerful search reduces duplicate submissions'
            description='Search engine powered by ElasticSearch ensures users do not create duplicate feedback.'
            buttonTitle='See More'
            buttonLink='/collect'
            buttonState={{ [SCROLL_TO_STATE_KEY]: 'search' }}
            initialSubPath='/embed/demo'
            scale={0.6}
            demoFixedWidth={330}
            demoFixedHeight={300}
            template={templater => {
              templater.demo();
              templater.demoExplorer({
                search: { limit: 4 },
                allowCreate: false,
                allowSearch: { enableSort: true, enableSearchText: true, enableSearchByCategory: true, enableSearchByStatus: true, enableSearchByTag: true },
              }, {
                // title: 'Suggest an idea',
                // description: 'Let us know how we can improve our product. We want to hear your ideas!',
              }, true);
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
          <Demo
            variant='content'
            type='column'
            title='Collect on-behalf of users'
            description='asdfasdasf asf dsafdasfmkjldsf lkadsf dasf dasfds fdsa fdsakhfjklashflk sdf sadf '
            buttonTitle='See More'
            buttonLink='/collect'
            buttonState={{ [SCROLL_TO_STATE_KEY]: 'on-behalf' }}
            initialSubPath='/embed/demo'
            template={templater => templater.demoExplorer({
              allowCreate: true,
              allowSearch: undefined,
            })}
            mock={mocker => mocker.demoExplorer()}
            scale={0.6}
            demoFixedWidth={330}
            demoFixedHeight={300}
            settings={{
              demoBlurryShadow: true,
              demoCreateAnimate: {
                title: 'Add Dark Mode',
                description: 'To reduce eye-strain, please add a dark mode option',
              },
            }}
          />
        </HorizontalPanels>
      </React.Fragment>
    );
  }

  renderPrioritization(mirror?: boolean) {
    return (
      <React.Fragment>
        <Demo
          title={prioritizationTitle}
          description={prioritizationDescription}
          mirror={mirror}
          buttonTitle='Learn about prioritization'
          buttonLink='/prioritization'
          initialSubPath='/embed/demo'
          template={templater => templater.demoPrioritization('all')}
          mock={mocker => mocker.demoPrioritization()}
          settings={{
            demoFlashPostVotingControls: true,
          }}
        />
        <HorizontalPanels wrapBelow='md' maxWidth='xl' maxContentWidth='xs' staggerHeight={0}>
          <BlockContent
            variant='content'
            title='Keep it simple with voting and expressions'
            description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
            buttonTitle='See how it looks'
            buttonLink='/prioritization#simple-voting'
          />
          <Demo
            variant='content'
            type='column'
            title='Credit system for advanced prioritization'
            description='asdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf ad'
            buttonTitle='See the benefits'
            buttonLink='/prioritization#crowdfunding'
            initialSubPath='/embed/demo'
            template={templater => templater.demoPrioritization('fund')}
            mock={mocker => mocker.demoPrioritization()}
            demoFixedHeight={330}
            edgeType='outline'
            demo={project => (<FundingControlDemo server={project.server} ideaId='add-dark-mode' />)}
          />
        </HorizontalPanels>
      </React.Fragment>
    );
  }

  renderCaseStudies() {
    return (
      <HorizontalPanels wrapBelow='md' maxWidth='lg' maxContentWidth='xs'>
        <BlockContent
          variant='content'
          title='Support credit system for SAAS companies'
          description='asdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf ad'
          buttonTitle='See Demo'
          buttonLink='/case-study#saas'
        />
        <BlockContent
          variant='content'
          title='Donation-based open-source library'
          description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
          buttonTitle='See Demo'
          buttonLink='/case-study#open-source'
        />
        <BlockContent
          variant='content'
          title='Mobile social media app'
          description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
          buttonTitle='See Demo'
          buttonLink='/case-study#mobile-social-media'
        />
      </HorizontalPanels>
    );
  }

  renderEngagement(mirror?: boolean) {
    return (
      <React.Fragment>
        <Demos
          title={transparencyTitle}
          description={transparencyDescription}
          buttonTitle='Learn about transparency'
          buttonLink='/transparency'
          mirror={mirror}
          stackProps={{
            contentSpacingVertical: 100,
            ascendingLevel: true,
            topLeftToBottomRight: true,
            raiseOnHover: true,
          }}
          demos={[
            {
              scale: 0.7,
              template: templater => {
                const categoryId = templater.demoCategory();
                templater.supportVoting(categoryId, true);
                templater.workflowFeatures(categoryId);
                templater.styleWhite();
              },
              mock: (mocker, config) => mocker.mockFakeIdeaWithComments('ideaid')
                .then(() => mocker.mockLoggedIn()),
              initialSubPath: '/embed/post/ideaid',
            },
            {
              initialSubPath: '/embed/demo',
              scale: 0.5,
              template: templater => templater.demoBoardPreset('development'),
              mock: mocker => mocker.demoBoard([
                { status: '0', extra: { voteValue: 14, expressions: { '❤️': 4, '🚀': 1 } } },
                { status: '0', extra: { voteValue: 7, expressions: { '👍': 1, '😕': 2 } } },
                { status: '0', extra: { voteValue: 2, expressions: { '👍': 1 } } },
                { status: '1', extra: { funded: 7800, fundGoal: 9000, fundersCount: 12, expressions: { '😍': 2 } } },
                { status: '1', extra: { funded: 500, fundGoal: 5000, fundersCount: 1, expressions: { '👀': 1 } } },
                { status: '2', extra: { funded: 6700, fundGoal: 5000, fundersCount: 32, } },
                { status: '2', extra: { funded: 24300, fundGoal: 20000, fundersCount: 62 } },
              ]),
              settings: {
                demoBlurryShadow: true,
              },
            },
          ]}
        />
        <HorizontalPanels wrapBelow='md' maxWidth='xl' maxContentWidth='xs' staggerHeight={50}>
          <BlockContent
            variant='content'
            title='Roadmap'
            description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
            buttonTitle='See More'
            buttonLink='/engagement#roadmap'
          />
          <BlockContent
            variant='content'
            title='Admin replies and notifications'
            description='asdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf ad'
            buttonTitle='See More'
            buttonLink='/engagement#admin-reply'
          />
          <Demo
            variant='content'
            type='column'
            title='Organized discussion with threaded comments'
            description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
            buttonTitle='See More'
            buttonLink='/engagement#notifications'
            scale={0.5}
            template={templater => templater.demoCategory()}
            mock={(mocker, config) => mocker.mockFakeIdeaWithComments('ideaId')
              .then(() => mocker.mockLoggedIn())}
            demo={project => (
              <Provider store={project.server.getStore()}>
                <CommentList
                  server={project.server}
                  ideaId='ideaId'
                  expectedCommentCount={1}
                  logIn={() => Promise.resolve()}
                  newCommentsAllowed
                  loggedInUser={project.server.getStore().getState().users.loggedIn.user}
                />
              </Provider>
            )}
          />
        </HorizontalPanels>
      </React.Fragment>
    );
  }

  renderCustomize(mirror?: boolean) {
    return (
      <React.Fragment>
        <Block
          title='Customization afasdfsdaf fas fdsasf sadf dsaa fs'
          description='fasdfsdaf asf d fdsafds fasf asf asasf asf fa fasd  sad as as asfd asfd'
          mirror={mirror}
          buttonTitle='See templates'
          buttonLink='/customize'
        />
        <HorizontalPanels wrapBelow='sm' maxWidth='xl' maxContentWidth='xs' staggerHeight={50}>
          <BlockContent
            variant='content'
            title='Predefined templates'
            description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
            buttonTitle='See More'
            buttonLink='/customize#templates'
          />
          <BlockContent
            variant='content'
            title='Content types'
            description='asdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf ad'
            buttonTitle='See More'
            buttonLink='/customize#content'
          />
          <BlockContent
            variant='content'
            title='Site layout'
            description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
            buttonTitle='See More'
            buttonLink='/customize#layout'
          />
          <Demo
            variant='content'
            type='column'
            title='Look and feel'
            description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
            buttonTitle='See More'
            buttonLink='/customize#look-and-feel'
            initialSubPath={'/post/ideaid'}
            scale={0.7}
            template={templater => {
              const categoryId = templater.demoCategory();
              templater.supportVoting(categoryId, true);
              templater.workflowFeatures(categoryId);
              templater.styleDark();
              // templater.setFontFamily('"Comic Sans MS", cursive, sans-serif');
              templater.setAppName('Smotana', 'https://smotana.com/favicon.ico');
            }}
            mock={(mocker, config) => mocker.mockFakeIdeaWithComments('ideaid')
              .then(() => mocker.mockLoggedIn())}
          />
        </HorizontalPanels>
      </React.Fragment>
    );
  }

  renderSales(mirror?: boolean) {
    return (
      <Block
        title='Every customer is different'
        description='Talk to our sales for a demo walkthrough and to determine how our solution can be customized for your needs.'
        buttonTitle='Get in touch'
        buttonLink='/contact/sales'
        mirror={mirror}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(LandingPage);

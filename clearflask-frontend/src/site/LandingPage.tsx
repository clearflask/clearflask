import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import * as Client from '../api/client';
import { Device } from '../common/DeviceContainer';
import { featuresDescription, featuresTitle } from './FeaturesPage';
import Block from './landing/Block';
import BlockContent from './landing/BlockContent';
import Demo from './landing/Demo';
import Demos from './landing/Demos';
import Hero from './landing/Hero';
import HorizontalPanels from './landing/HorizontalPanels';
import OnboardingControls, { setInitSignupMethodsTemplate } from './landing/OnboardingControls';
import OnboardingDemo from './landing/OnboardingDemo';
import { prioritizationDescription, prioritizationTitle } from './PrioritizationPage';
import { transparencyDescription, transparencyTitle } from './TransparencyPage';

const styles = (theme: Theme) => createStyles({
});

class LandingPage extends Component<WithStyles<typeof styles, true>> {
  onboardingDemoRef: React.RefObject<any> = React.createRef();

  render() {
    return (
      <React.Fragment>
        {this.renderHero()}
        {this.renderCollectFeedback()}
        {this.renderPrioritization(true)}
        {/* Add: crowdfunding, prioritization */}
        {this.renderEngagement()}
        {this.renderFeatures(true)}
        {/* {this.renderCustomize()} */}
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

  renderCollectFeedback(mirror?: boolean) {
    return (
      <React.Fragment>
        <Demo
          title='Collect user feedback in one place'
          description='Capture feedback from all channels into one bucket.'
          mirror={mirror}
          initialSubPath='/embed/demo'
          template={templater => templater.demoExplorer({
            allowCreate: true,
            allowSearch: { enableSort: true, enableSearchText: true, enableSearchByCategory: true, enableSearchByStatus: true, enableSearchByTag: true },
          }, {
            title: 'Suggest an idea',
            description: 'Let us know how we can improve our product. We want to hear your ideas!',
          })}
          mock={mocker => mocker.demoExplorer()}
          scale={0.7}
          demoFixedHeight={300}
          settings={{
            demoBlurryShadow: true,
            demoCreateAnimate: {
              title: 'Add Dark Mode',
            },
          }}
        />
        <HorizontalPanels wrapBelow='md' maxWidth='xl' maxContentWidth='xs' staggerMinHeight={1000}>
          <Demo
            variant='h5'
            column
            title='Seamless onboarding'
            description='asfa sfa fasd fdas fdsa fads fadsf asd fads fasdf asd fads fads fas fasdf adsf dasfas '
            initialSubPath='/embed/demo'
            template={templater => {
              setInitSignupMethodsTemplate(templater);
              templater.styleWhite();
            }}
            scale={0.7}
            controls={project => (<OnboardingControls onboardingDemoRef={this.onboardingDemoRef} templater={project.templater} />)}
            demo={project => (<OnboardingDemo defaultDevice={Device.None} innerRef={this.onboardingDemoRef} server={project.server} />)}
            buttonTitle='See More'
            buttonLink='/collect#onboarding'
            suppressShadow
          />
          <Demo
            variant='h5'
            column
            title='Powerful search reduces duplicate submissions'
            description='Search engine powered by ElasticSearch ensures users do not create duplicate feedback.'
            buttonTitle='See More'
            buttonLink='/collect#powerful-search'
            initialSubPath='/embed/demo'
            scale={0.7}
            template={templater => {
              templater.baseFeatures();
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
            variant='h5'
            column
            title='Customize user experience'
            description='Our platform is fully customizable in both style and functionality to maximize effectiveness.'
            buttonTitle='See More'
            buttonLink='/collect#user-experience'
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
        <HorizontalPanels wrapBelow='sm' maxWidth='md' maxContentWidth='xs' staggerMinHeight={300}>
          <BlockContent
            variant='h5'
            title='Crowdfunding'
            description='asdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf ad'
            buttonTitle='See More'
            buttonLink='/prioritization#crowdfunding'
          />
          <BlockContent
            variant='h5'
            title='Simple voting'
            description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
            buttonTitle='See More'
            buttonLink='/prioritization#simple-voting'
          />
        </HorizontalPanels>
      </React.Fragment>
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
        <HorizontalPanels wrapBelow='sm' maxWidth='md' maxContentWidth='xs' staggerMinHeight={300}>
          <BlockContent
            variant='h5'
            title='Let your users know, Notifications and Admin reply'
            description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
            buttonTitle='See More'
            buttonLink='/engagement#notifications'
          />
          <BlockContent
            variant='h5'
            title='Roadmap'
            description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
            buttonTitle='See More'
            buttonLink='/engagement#roadmap'
          />
          <BlockContent
            variant='h5'
            title='Admin replies'
            description='asdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf ad'
            buttonTitle='See More'
            buttonLink='/engagement#admin-reply'
          />
        </HorizontalPanels>
      </React.Fragment>
    );
  }

  renderFeatures(mirror?: boolean) {
    return (
      <Block
        title={featuresTitle}
        description={featuresDescription}
        buttonTitle='Browse features'
        buttonLink='/features'
        mirror={mirror}
        imagePath='/img/landing/features.svg'
      />
    );
  }

  renderCustomize(mirror?: boolean) {
    return (
      <Block
        title=''
        description=''
        mirror={mirror}
      />
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

import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { featuresDescription, featuresTitle } from './FeaturesPage';
import Block from './landing/Block';
import Demo from './landing/Demo';
import Demos from './landing/Demos';
import Hero from './landing/Hero';
import { prioritizationDescription, prioritizationTitle } from './PrioritizationPage';
import { transparencyDescription, transparencyTitle } from './TransparencyPage';

const styles = (theme: Theme) => createStyles({
});

class LandingPage extends Component<WithStyles<typeof styles, true>> {

  render() {
    return (
      <React.Fragment>
        {this.renderHero()}
        {this.renderAddIdea()}
        {this.renderPrioritization()}
        {this.renderTransparency(true)}
        {this.renderFeatures()}
        {/* {this.renderEngagement()} */}
        {/* {this.renderCustomize()} */}
        {this.renderSales(true)}
      </React.Fragment>
    );
  }

  renderHero() {
    return (
      <Hero
        title='Product Feedback Solution for customer transparency'
        description='An idea brainstorming tool with cost/benefit prioritization of user feedback to drive your product forward.'
        imagePath='/img/landing/hero.svg'
      />
    );
  }

  renderAddIdea(mirror?: boolean) {
    return (
      <Demo
        title='Collect feedback'
        description='fasfsd fs afas fasd fas'
        mirror={mirror}
        initialSubPath='/embed/demo'
        template={templater => templater.demoExplorer({ allowCreate: true })}
        mock={mocker => mocker.demoExplorer()}
        scale={0.7}
        settings={{
          // demoBlurryShadow: true,
          demoCreateOpen: {
            title: 'Cannot save',
          },
        }}
      />
    );
  }

  renderPrioritization(mirror?: boolean) {
    return (
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
    );
  }

  renderTransparency(mirror?: boolean) {
    return (
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

  renderEngagement(mirror?: boolean) {
    return (
      <Block
        title=''
        description='Notifications, updates on ideas'
        mirror={mirror}
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

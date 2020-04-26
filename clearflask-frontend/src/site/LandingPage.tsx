import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { loremIpsum } from "lorem-ipsum";
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
        demos={[
          {
            initialSubPath: '/embed/demo',
            scale: 0.7,
            template: templater => templater.demoBoard('Roadmap', [
              { title: 'Planned' },
              { title: 'In Progress' },
            ]),
            mock: mocker => mocker.demoBoard([
              { status: '0', title: loremIpsum({ units: 'words', count: Math.round(Math.random() * 10 + 3) }) },
              { status: '0', title: loremIpsum({ units: 'words', count: Math.round(Math.random() * 10 + 3) }) },
              { status: '0', title: loremIpsum({ units: 'words', count: Math.round(Math.random() * 10 + 3) }) },
              { status: '0', title: loremIpsum({ units: 'words', count: Math.round(Math.random() * 10 + 3) }) },
              { status: '1', title: loremIpsum({ units: 'words', count: Math.round(Math.random() * 10 + 3) }) },
              { status: '1', title: loremIpsum({ units: 'words', count: Math.round(Math.random() * 10 + 3) }) },
              { status: '1', title: loremIpsum({ units: 'words', count: Math.round(Math.random() * 10 + 3) }) },
              { status: '1', title: loremIpsum({ units: 'words', count: Math.round(Math.random() * 10 + 3) }) },
            ]),
            settings: {
              demoBlurryShadow: true,
            },
          },
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

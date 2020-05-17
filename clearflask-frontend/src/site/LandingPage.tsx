import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { CreateTemplateOptions, createTemplateOptionsDefault } from '../common/config/configTemplater';
import { description as collectDescription, title as collectTitle } from './CollectPage';
import { transparencyDescription, transparencyTitle } from './EngagePage';
import Block from './landing/Block';
import BlockContent from './landing/BlockContent';
import Demo from './landing/Demo';
import Hero from './landing/Hero';
import HorizontalPanels from './landing/HorizontalPanels';
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
        {this.renderEngagement()}
        {this.renderCustomize(true)}
        {this.renderCaseStudies()}
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
          demoFixedHeight={500}
          template={templater => templater.demo(opts)}
          mock={mocker => mocker.templateMock(opts)}
          settings={{
            demoMenuAnimate: [
              { path: '' },
              { path: 'ideas' },
            ],
          }}
        />
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
          buttonLink='/prioritize'
          initialSubPath='/embed/demo'
          template={templater => templater.demoPrioritization('all')}
          mock={mocker => mocker.demoPrioritization()}
          settings={{
            demoFlashPostVotingControls: true,
          }}
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
          buttonTitle='See Demo'
          buttonLink='/case-study#saas'
        />
        <BlockContent
          variant='content'
          title='Open-Source community-funded product'
          description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
          buttonTitle='See Demo'
          buttonLink='/case-study#open-source'
        />
        <BlockContent
          variant='content'
          title='Mobile App monetization strategy'
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
        <Demo
          title={transparencyTitle}
          description={transparencyDescription}
          buttonTitle='See how'
          buttonLink='/engage'
          mirror={mirror}
          initialSubPath='/embed/demo'
          scale={0.5}
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
        />
      </React.Fragment>
    );
  }

  renderCustomize(mirror?: boolean) {
    return (
      <React.Fragment>
        <Block
          title='Made with customization in mind'
          description='fasdfsdaf asf d fdsafds fasf asf asasf asf fa fasd  sad as as asfd asfd'
          mirror={mirror}
          buttonTitle='See templates'
          buttonLink='/customize'
        />
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

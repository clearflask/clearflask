import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { featuresDescription, featuresTitle } from './FeaturesPage';
import Block from './landing/Block';
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
        {this.renderCollect()}
        {this.renderPrioritization(true)}
        {this.renderTransparency()}
        {this.renderFeatures(true)}
        {/* {this.renderEngagement()} */}
        {/* {this.renderCustomize()} */}
        {this.renderSales()}
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

  renderCollect(mirror?: boolean) {
    return (
      <Block
        title='Give valuable customers a voice to drive your product'
        description='A tool to empower your users to express their opinion for you to make better product decisions.'
        mirror={mirror}
        imagePath='/img/landing/collect.svg'
      />
    );
  }

  renderPrioritization(mirror?: boolean) {
    return (
      <Block
        title={prioritizationTitle}
        description={prioritizationDescription}
        mirror={mirror}
        buttonTitle='Learn about prioritization'
        buttonLink='/prioritization'
        imagePath='/img/landing/prioritization.svg'
      />
    );
  }

  renderTransparency(mirror?: boolean) {
    return (
      <Block
        title={transparencyTitle}
        description={transparencyDescription}
        buttonTitle='Learn about transparency'
        buttonLink='/transparency'
        mirror={mirror}
        imagePath='/img/landing/transparency.svg'
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

  // TODO move this somewhere else
  // onboardingDemoRef: React.RefObject<any> = React.createRef();
  // renderOnboarding(mirror?: boolean) {
  //   return (
  //     <Demo
  //       mirror={mirror}
  //       title='Notify users when their wishes are fulfilled'
  //       description='It is important to keep a communication channel from users leaving feedback. To minimize friction, users can choose between browser push notifications, mobile push or standard email.'
  //       initialSubPath='/embed/demo'
  //       template={templater => setInitSignupMethodsTemplate(templater)}
  //       controls={project => (<OnboardingControls onboardingDemoRef={this.onboardingDemoRef} templater={project.templater} />)}
  //       demo={project => (<OnboardingDemo innerRef={this.onboardingDemoRef} server={project.server} />)}
  //     />
  //   );
  // }
}

export default withStyles(styles, { withTheme: true })(LandingPage);

import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import Block from './landing/Block';
import Hero from './landing/Hero';
import Placeholder from './landing/Placeholder';

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
        {this.renderEngagement()}
        {this.renderCustomize()}
        {this.renderSales()}
      </React.Fragment>
    );
  }

  renderHero() {
    return (
      <Hero
        title='Idea management tool for your product'
        description='An idea brainstorming tool with cost/benefit prioritization of user feedback to drive your product forward.'
        image={(<Placeholder width={500} height={350} />)}
      />
    );
  }

  renderCollect(mirror?: boolean) {
    return (
      <Block
        title='Give valuable customers a voice to drive your product'
        description='A tool to empower your users to express their opinion for you to make better product decisions.'
        mirror={mirror}
        demo={(<Placeholder width={500} height={350} />)}
      />
    );
  }

  renderPrioritization(mirror?: boolean) {
    return (
      <Block
        title='Proportionate voice based on customer value'
        description='Assign each user voting power based on their value as a customer and let them spend the voting power prioritizing your roadmap. Your users will love knowing they have a voice.'
        mirror={mirror}
        buttonTitle='Learn about prioritization'
        buttonLink='/prioritization'
        demo={(<Placeholder width={500} height={350} />)}
      />
    );
  }

  renderTransparency(mirror?: boolean) {
    return (
      <Block
        title='Transparency strengthens user community'
        description='Keep your users involved and informed of your progress with updates and roadmap (Roadmap, changelog, Idea reply)'
        buttonTitle='Learn about transparency'
        buttonLink='/transparency'
        mirror={mirror}
        demo={(<Placeholder width={500} height={350} />)}
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

import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import * as Client from '../api/client';
import { CreateTemplateOptions, createTemplateOptionsDefault } from '../common/config/configTemplater';
import { Device } from '../common/DeviceContainer';
import Demo from './landing/Demo';
import OnboardingControls, { setInitSignupMethodsTemplate } from './landing/OnboardingControls';
import OnboardingDemo from './landing/OnboardingDemo';
import PrioritizationControlsExpressions from './landing/PrioritizationControlsExpressions';

export const title = "Know your customers' needs";
export const description = 'Collect customer feedback from all your support channels seamlessly into one scalable funnel. Drive your product forward with customers in mind.'

const styles = (theme: Theme) => createStyles({
});
class CollectPage extends Component<WithStyles<typeof styles, true>> {
  onboardingDemoRef: React.RefObject<any> = React.createRef();

  render() {
    return (
      <React.Fragment>
        {this.renderHero()}
        {this.renderOnboarding()}
        {this.renderEmbed(true)}
        {this.renderOnBehalf()}
        {this.renderSearch(true)}
      </React.Fragment>
    );
  }

  renderHero() {
    const opts: CreateTemplateOptions = {
      ...createTemplateOptionsDefault,
      fundingAllowed: false,
    };
    return (
      <Demo
        title={title}
        description={description}
        type='hero'
        scale={0.7}
        demoFixedHeight={400}
        template={templater => templater.demo(opts)}
        mock={mocker => mocker.templateMock(opts)}
      />
    );
  }

  renderEmbed(mirror?: boolean) {
    return (
      <Demo
        title='Integrate with your application, site or mobile app'
        description='sdfanfao fndsanjf klansflu girhguialh dfjij ad gjdl jglsdgjlsjgkljgkl dfjskghdfkghd fds'
        mirror={mirror}
        initialSubPath='/embed/demo'
        template={templater => templater.demoPrioritization('express')}
        mock={mocker => mocker.demoPrioritization()}
        controls={project => (<PrioritizationControlsExpressions templater={project.templater} />)}
      />
    );
  }

  renderOnboarding(mirror?: boolean) {
    return (
      <Demo
        scrollAnchor={{ scrollOnStateName: 'onboarding' }}
        title='Frictionless onboarding'
        description='New user sign up is optimized for conversion with several choices of options for users to receive updates. The best experience is using Single Sign-On with your existing account system.'
        initialSubPath='/embed/demo'
        demoFixedWidth={420}
        template={templater => {
          setInitSignupMethodsTemplate(templater);
          templater.styleWhite();
        }}
        controls={project => (<OnboardingControls onboardingDemoRef={this.onboardingDemoRef} templater={project.templater} />)}
        demo={project => (<OnboardingDemo defaultDevice={Device.Desktop} innerRef={this.onboardingDemoRef} server={project.server} />)}
      />
    );
  }

  renderOnBehalf(mirror?: boolean) {
    return (
      <Demo
        scrollAnchor={{ scrollOnStateName: 'on-behalf' }}
        title='Capture on-behalf of users'
        description='asfa sfa fasd fdas fdsa fads fadsf asd fads fasdf asd fads fads fas fasdf adsf dasfas '
        initialSubPath='/embed/demo'
        template={templater => templater.demoExplorer({
          allowCreate: { actionTitle: 'Suggest', actionTitleLong: 'Suggest an idea' },
          allowSearch: undefined,
        })}
        mock={mocker => mocker.demoExplorer()}
        scale={0.7}
        demoFixedHeight={300}
        settings={{
          demoBlurryShadow: true,
          demoCreateAnimate: {
            title: 'Add Dark Mode',
            description: 'To reduce eye-strain, please add a dark mode option',
          },
        }}
      />
    );
  }

  renderSearch(mirror?: boolean) {
    return (
      <Demo
        scrollAnchor={{ scrollOnStateName: 'search' }}
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
    );
  }
}

export default withStyles(styles, { withTheme: true })(CollectPage);

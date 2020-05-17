import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import * as Client from '../api/client';
import Block from './landing/Block';
import Demo from './landing/Demo';
import FundingControlDemo from './landing/FundingControlDemo';
import HorizontalPanels from './landing/HorizontalPanels';
import PrioritizationControlsCredits from './landing/PrioritizationControlsCredits';
import PrioritizationControlsExpressions from './landing/PrioritizationControlsExpressions';
import PrioritizationControlsVoting from './landing/PrioritizationControlsVoting';

export const prioritizationTitle = 'Give your customers a proportionate voice to drive your product';
export const prioritizationDescription = 'Assign each user voting power based on their value as a customer and let them prioritize the bulk of your roadmap. Your users will love knowing their voice has been heard.';

const styles = (theme: Theme) => createStyles({
});

class PrioritizePage extends Component<WithStyles<typeof styles, true>> {
  render() {
    return (
      <React.Fragment>
        {this.renderHero()}
        {this.renderTypesOfVoting()}
        {/* {this.renderRewardCustomers()} */}
        {this.renderCredit(true)}
        {this.renderCreditUseCases()}
        {this.renderVoting(true)}
        {this.renderExpressions()}
      </React.Fragment>
    );
  }

  renderHero() {
    return (
      <Demo
        title={prioritizationTitle}
        description={prioritizationDescription}
        type='hero'
        mirror={true}
        initialSubPath='/embed/demo'
        template={templater => templater.demoPrioritization('all')}
        mock={mocker => mocker.demoPrioritization()}
        settings={{
          demoFlashPostVotingControls: true,
        }}
      />
    );
  }

  renderTypesOfVoting(mirror?: boolean) {
    return (
      <HorizontalPanels wrapBelow='md' maxWidth='lg' maxContentWidth='xs' staggerHeight={-200}>
        <Demo
          variant='content'
          type='column'
          title='Keep it simple with voting'
          description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
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
        <Demo
          variant='content'
          type='column'
          title='Expressions for a wider range of feedback'
          description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
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
          title='Credit system for advanced prioritization'
          description='asdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf ad'
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
      </HorizontalPanels>
    );
  }

  renderVoting(mirror?: boolean) {
    return (
      <Demo
        title='Voting ideas'
        description='Simple upvote/downvote system with all users having equal voting power.'
        mirror={mirror}
        initialSubPath='/embed/demo'
        template={templater => templater.demoPrioritization('vote')}
        mock={mocker => mocker.demoPrioritization()}
        controls={project => (<PrioritizationControlsVoting templater={project.templater} />)}
      />
    );
  }

  renderCredit(mirror?: boolean) {
    return (
      <Demo
        title='Crowd-funding your ideas with real or virtual currency'
        // description='Let your users prioritize ideas by distributing credits. Assign credits to your users based on their value as a customer.'
        description='Assign credits to your users based on their value as a customer and let them prioritize ideas by distributing those credits.'
        mirror={mirror}
        initialSubPath='/embed/demo'
        template={templater => templater.demoPrioritization('fund')}
        mock={mocker => mocker.demoPrioritization()}
        controls={project => (<PrioritizationControlsCredits templater={project.templater} />)}
      />
    );
  }

  renderRewardCustomers(mirror?: boolean) {
    return (
      <Demo
        title='Reward valuable customers with proportionate voice'
        description='TODO Customer purchases (product purchase, subscription); loyalty, game rank'
        mirror={mirror}
        initialSubPath='/embed/demo'
        template={templater => templater.demoPrioritization('fund')}
        mock={mocker => mocker.demoPrioritization()}
        demoFixedHeight={330}
        demoFixedWidth={350}
        edgeType='outline'
        demo={project => (<FundingControlDemo server={project.server} />)}
      />
    );
  }

  renderCreditUseCases(mirror?: boolean) {
    return (
      <Block
        title='Credit use cases'
        description='TODO
        Commercial product, SAAS, Donation-based
         TODO Integrate with paying customers, Patreon, donation, mobile purchases, bounties, crowdfunding'
        mirror={mirror}
      />
    );
  }

  renderExpressions(mirror?: boolean) {
    return (
      <Demo
        title='Expressions'
        description='When you cannnot accurately express your feelings with simple upvotes, weighted emoji expressions is here to help.'
        mirror={mirror}
        initialSubPath='/embed/demo'
        template={templater => templater.demoPrioritization('express')}
        mock={mocker => mocker.demoPrioritization()}
        controls={project => (<PrioritizationControlsExpressions templater={project.templater} />)}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(PrioritizePage);

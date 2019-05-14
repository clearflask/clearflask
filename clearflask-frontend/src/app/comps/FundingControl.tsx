import React, { Component } from 'react';
import * as Client from '../../api/client';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import { ReduxState, Server, Status, getSearchKey } from '../../api/server';
import FundingBar from './FundingBar';
import { Divider, Typography } from '@material-ui/core';
import Loader from '../utils/Loader';
import TruncateMarkup from 'react-truncate-markup';
import { Slider } from '@material-ui/lab';
import { string } from 'prop-types';

interface SearchResult {
  status:Status;
  ideas:(Client.Idea&{vote:Client.Vote}|undefined)[];
  cursor:string|undefined,
}

const styles = (theme:Theme) => createStyles({
  container: {
  },
  fundingSlider: {
    padding: '22px 0px',
  },
});

interface Props {
  server:Server;
  style?:React.CSSProperties;
  idea?:Client.Idea;
  credits?:Client.Credits;
  vote?:Client.Vote;
  maxFundAmountSeen:number;
}

interface ConnectProps {
  configver?:string;
  otherFundedIdeas:SearchResult;
  balance:number;
  updateVote: (ideaId:string, voteUpdate:Partial<Client.VoteUpdate>)=>Promise<Client.VoteUpdateResponse>;
  callOnMount: ()=>void,
}

interface State {
  sliderCurrentIdeaId?:string;
  sliderFundAmountDiff?:number;
  sliderIsSubmitting?:boolean;
}

class FundingControl extends Component<Props&ConnectProps&WithStyles<typeof styles, true>, State> {
  state:State={};

  componentDidMount() {
    this.props.callOnMount();
  }

  render() {
    if(!this.props.idea
      || !this.props.credits) return null;

    return (
      <div style={this.props.style} className={this.props.classes.container}>
        <FundingBar
          idea={this.props.idea}
          credits={this.props.credits}
          vote={this.props.vote}
          maxFundAmountSeen={this.props.maxFundAmountSeen}
          fundAmountDiff={this.state.sliderCurrentIdeaId === this.props.idea.ideaId ? this.state.sliderFundAmountDiff : undefined}
        />
        {this.renderSlider(this.props.idea, this.props.vote)}
        <Loader loaded={this.props.otherFundedIdeas.status === Status.FULFILLED}>
          {this.props.otherFundedIdeas.ideas.filter(i => !!i).map((idea, index) => !idea ? null : (
            <div>
              {index === 0 && (<Divider />)}
              <Typography variant='subtitle1'>
                <TruncateMarkup lines={1}><div>{idea.title}</div></TruncateMarkup>
              </Typography>
              <FundingBar
                idea={idea}
                credits={this.props.credits}
                vote={this.props.vote}
                maxFundAmountSeen={this.props.maxFundAmountSeen}
                fundAmountDiff={this.state.sliderCurrentIdeaId === idea.ideaId ? this.state.sliderFundAmountDiff : undefined}
              />
              {this.renderSlider(idea, idea.vote)}
            </div>
          ))}
        </Loader>
      </div>
    );
  }

  renderSlider(idea:Client.Idea, vote?:Client.Vote) {
    const isSliding = this.state.sliderCurrentIdeaId === idea.ideaId;
    const fundAmount = vote && vote.fundAmount || 0;
    const min = 0;
    const max = fundAmount + this.props.balance;
    const value = isSliding ? fundAmount + (this.state.sliderFundAmountDiff || 0) : fundAmount;
    const step = this.props.credits && this.props.credits.increment || undefined;

    return (
      <Slider
        disabled={this.state.sliderIsSubmitting}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e, newFundAmount) => {
          if(!isSliding) return;
          const fundAmountDiff = newFundAmount - fundAmount;
          this.setState({sliderFundAmountDiff: fundAmountDiff});
        }}
        onDragStart={e => {
          this.setState({
            sliderCurrentIdeaId: idea.ideaId,
          });
        }}
        onDragEnd={e => {
          if(!this.state.sliderFundAmountDiff || this.state.sliderFundAmountDiff === 0) {
            this.setState({
              sliderCurrentIdeaId: undefined,
              sliderFundAmountDiff: undefined,
            });
            return;
          }
          this.setState({
            sliderIsSubmitting: true,
          });
          this.props.updateVote(idea.ideaId, {fundAmount: fundAmount + Math.min(this.state.sliderFundAmountDiff, this.props.balance)})
          .finally(() => this.setState({
            sliderCurrentIdeaId: undefined,
            sliderFundAmountDiff: undefined,
            sliderIsSubmitting: false,
          }));
        }}
        classes={{ container: this.props.classes.fundingSlider }}
      />
    );
  }
}

export default connect<ConnectProps,{},Props,ReduxState>((state:ReduxState, ownProps:Props):ConnectProps => {
  const search = { fundedByMeAndActive: true };
  var newProps = {
    configver: state.conf.ver, // force rerender on config change
    otherFundedIdeas: {
      status: Status.PENDING,
      ideas: [],
      cursor: undefined,
    } as SearchResult,
    balance: state.credits.myBalance.balance || 0,
    updateVote: (ideaId:string, voteUpdate:Partial<Client.VoteUpdate>):Promise<Client.VoteUpdateResponse> => ownProps.server.dispatch().voteUpdate({
      projectId: state.projectId,
      update: {
        ideaId: ideaId,
        voterUserId: state.users.loggedIn.user!.userId,
        ...voteUpdate,
      },
    }, {previousVote: ownProps.vote || null}),
    callOnMount: () => {
      ownProps.server.dispatch().ideaSearch({
        projectId: state.projectId,
        search: search,
      });
    }
  };

  const bySearch = state.ideas.bySearch[getSearchKey(search)];
  if(bySearch) {
    newProps.otherFundedIdeas.status = bySearch.status;
    newProps.otherFundedIdeas.cursor = bySearch.cursor;
    newProps.otherFundedIdeas.ideas = (bySearch.ideaIds || [])
    .filter(ideaId => ideaId !== (ownProps.idea && ownProps.idea.ideaId))
    .map(ideaId => {
      const idea = state.ideas.byId[ideaId];
      if(!idea || !idea.idea || idea.status !== Status.FULFILLED) return undefined;
      const vote = state.votes.byIdeaId[ideaId];
      if(!vote) return undefined;
      return {vote: vote.vote, ...idea.idea} as Client.Idea&{vote:Client.Vote};
    });
  }

  return newProps;
})(withStyles(styles, { withTheme: true })(FundingControl));

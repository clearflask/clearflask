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
import CreditView from '../../common/config/CreditView';

interface SearchResult {
  status:Status;
  ideas:(Client.Idea&{vote:Client.Vote}|undefined)[];
  cursor:string|undefined,
}

const styles = (theme:Theme) => createStyles({
  separatorMargin: {
    marginTop: theme.spacing.unit * 3,
  },
  slider: {
    paddingTop: theme.spacing.unit * 2,
    paddingBottom: theme.spacing.unit * 2,
  },
  sliderTransitionNone: {
    transition: theme.transitions.create(['width', 'transform', 'box-shadow'], {
      duration: 0,
      easing: theme.transitions.easing.easeOut,
    }),
  },
  sliderTransitionSmooth: {
    transition: theme.transitions.create(['width', 'transform', 'box-shadow'], {
      duration: theme.transitions.duration.shortest,
      easing: theme.transitions.easing.easeOut,
    }),
  },
});

interface Props {
  server:Server;
  style?:React.CSSProperties;
  idea?:Client.Idea;
  credits?:Client.Credits;
  vote?:Client.Vote;
  maxFundAmountSeen:number;
  onOtherFundedIdeasLoaded?:()=>void;
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
  fixedTarget?:number;
  maxTarget:number;
}

class FundingControl extends Component<Props&ConnectProps&WithStyles<typeof styles, true>, State> {
  state:State={maxTarget: 0};

  componentDidMount() {
    this.props.callOnMount();
  }

  static getDerivedStateFromProps(props:Props&ConnectProps&WithStyles<typeof styles, true>, state:State):Partial<State> | null {
    var maxTarget:number = (props.vote && props.vote.fundAmount || 0);
    props.otherFundedIdeas.ideas.forEach(i =>
      maxTarget = Math.max(maxTarget, i ? (i.vote.fundAmount || 0) : 0));
    maxTarget += props.balance;
    if(state.maxTarget !== maxTarget) {
      return {maxTarget};
    }
    return null;
  }

  componentDidUpdate(prevProps: Readonly<Props&ConnectProps&WithStyles<typeof styles, true>>): void {
    if(prevProps.otherFundedIdeas.status !== Status.FULFILLED
      && this.props.otherFundedIdeas.status === Status.FULFILLED) {
      this.props.onOtherFundedIdeasLoaded && this.props.onOtherFundedIdeasLoaded();
    }
  }

  render() {
    if(!this.props.idea
      || !this.props.credits) return null;

    return (
      <div style={this.props.style}>
        <FundingBar
          idea={this.props.idea}
          credits={this.props.credits}
          vote={this.props.vote}
          maxFundAmountSeen={this.props.maxFundAmountSeen}
          fundAmountDiff={this.state.sliderCurrentIdeaId === this.props.idea.ideaId ? this.state.sliderFundAmountDiff : undefined}
        />
        {this.renderSlider(this.props.idea, this.props.credits, this.props.vote)}
        <Loader loaded={this.props.otherFundedIdeas.status === Status.FULFILLED}>
          {this.props.otherFundedIdeas.ideas.length > 0 && (
            <Typography
              className={this.props.classes.separatorMargin}
              variant='overline'
              style={{textAlign: 'center'}}
            >
              Rank compare to your other choices
            </Typography>
          )}
          {this.props.otherFundedIdeas.ideas.filter(i => !!i).map((idea, index) => !idea ? null : (
            <div className={this.props.classes.separatorMargin}>
              {/* <Typography variant='subtitle1'>
                <TruncateMarkup lines={1}><div>{idea.title}</div></TruncateMarkup>
              </Typography> */}
              <FundingBar
                idea={idea}
                credits={this.props.credits}
                vote={this.props.vote}
                maxFundAmountSeen={this.props.maxFundAmountSeen}
                fundAmountDiff={this.state.sliderCurrentIdeaId === idea.ideaId ? this.state.sliderFundAmountDiff : undefined}
              />
              {this.renderSlider(idea, this.props.credits!, idea.vote)}
            </div>
          ))}
        </Loader>
      </div>
    );
  }

  renderSlider(idea:Client.Idea, credits:Client.Credits, vote?:Client.Vote) {
    const isSliding = this.state.sliderCurrentIdeaId === idea.ideaId;
    const fundAmount = vote && vote.fundAmount || 0;
    const min = 0;
    var max = fundAmount + this.props.balance;
    if(!isSliding) max -= (this.state.sliderFundAmountDiff || 0);
    const value = isSliding ? fundAmount + (this.state.sliderFundAmountDiff || 0) : fundAmount;
    const step = this.props.credits && this.props.credits.increment || undefined;
    const widthPerc = (100 * (max) / (this.state.fixedTarget || this.state.maxTarget))
    const transitionClassNamne = (this.state.sliderCurrentIdeaId && !this.state.sliderIsSubmitting) ? this.props.classes.sliderTransitionNone : this.props.classes.sliderTransitionSmooth
    const minMaxTitleOpacity = widthPerc > 25 ? 0.1 : 0;

    return (
      <div className={transitionClassNamne} style={{
        width: widthPerc + '%',
      }}>
        <Slider
          disabled={this.state.sliderIsSubmitting || min === max}
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
              fixedTarget: this.state.maxTarget,
            });
          }}
          onDragEnd={e => {
            const sliderFundAmountDiff = this.state.sliderFundAmountDiff;
            if(sliderFundAmountDiff === undefined || sliderFundAmountDiff === 0) {
              this.setState({
                sliderCurrentIdeaId: undefined,
                fixedTarget: undefined,
                sliderFundAmountDiff: undefined,
              });
              return;
            }
            this.setState({
              sliderIsSubmitting: true,
            });
            this.props.updateVote(idea.ideaId, {fundAmount: fundAmount + Math.min(sliderFundAmountDiff, this.props.balance)})
            .finally(() => this.setState({
              sliderCurrentIdeaId: undefined,
              fixedTarget: undefined,
              sliderFundAmountDiff: undefined,
              sliderIsSubmitting: false,
            }));
          }}
          classes={{
            container: this.props.classes.slider,
            thumbWrapper: transitionClassNamne,
            trackBefore: transitionClassNamne,
            trackAfter: transitionClassNamne,
          }}
        />
        <div style={{
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            width: '100%',
            display: 'flex',
            alignItems: 'baseline',
          }}>
            <div style={{flexGrow: value / max}}></div>
            <div style={{flexGrow: 0}}><CreditView val={value} credits={credits} /></div>
            <div style={{flexGrow: 1 - (value / max)}}></div>
          </div>
          <div style={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            alignItems: 'baseline',
          }}>
            <div style={{opacity: minMaxTitleOpacity}}><CreditView val={0} credits={credits} /></div>
            <div style={{flexGrow: 1}}>&nbsp;</div>
            <div style={{opacity: minMaxTitleOpacity}}><CreditView val={max} credits={credits} /></div>
          </div>
        </div>
      </div>
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

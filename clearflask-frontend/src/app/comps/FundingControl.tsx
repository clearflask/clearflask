import React, { Component } from 'react';
import * as Client from '../../api/client';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import { ReduxState, Server, Status, getSearchKey } from '../../api/server';
import FundingBar from './FundingBar';
import { Typography, Button } from '@material-ui/core';
import Loader from '../utils/Loader';
import Truncate from 'react-truncate';
import { Slider } from '@material-ui/lab';
import CreditView from '../../common/config/CreditView';
import { withRouter, RouteComponentProps } from 'react-router';

interface SearchResult {
  status:Status;
  ideas:(Client.Idea&{vote:Client.Vote}|undefined)[];
  cursor:string|undefined,
}

const styles = (theme:Theme) => createStyles({
  separatorMargin: {
    marginTop: theme.spacing(3),
  },
  slider: {
    marginTop: theme.spacing(-1),
    marginBottom: theme.spacing(-2),
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
  msg: {
    color: theme.palette.text.hint,
  },
});

interface Props {
  server:Server;
  className?:string;
  style?:React.CSSProperties;
  /** If you want to show a particular idea first, set idea and vote here */
  idea?:Client.Idea;
  vote?:Client.Vote;
  onOtherFundedIdeasLoaded?:()=>void;
}

interface ConnectProps {
  configver?:string;
  credits?:Client.Credits;
  otherFundedIdeas:SearchResult;
  balance:number;
  maxFundAmountSeen:number;
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

class FundingControl extends Component<Props&ConnectProps&WithStyles<typeof styles, true>&RouteComponentProps, State> {
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
    if(!this.props.credits) return null;

    const showFirstIdea = !!this.props.idea;
    var msg;
    if(showFirstIdea && this.props.otherFundedIdeas.ideas.length > 0) {
      msg = 'Prioritize against others';
    } else if(!showFirstIdea
      && this.props.otherFundedIdeas.status === Status.FULFILLED
      && this.props.otherFundedIdeas.ideas.length === 0) {
      msg = 'No items funded yet';
    }

    return (
      <div style={this.props.style} className={this.props.className}>
        {showFirstIdea && this.props.idea && (<div>
          <FundingBar
            idea={this.props.idea}
            credits={this.props.credits}
            vote={this.props.vote}
            maxFundAmountSeen={this.props.maxFundAmountSeen}
            fundAmountDiff={this.state.sliderCurrentIdeaId === this.props.idea.ideaId ? this.state.sliderFundAmountDiff : undefined}
          />
          {this.renderSlider(this.props.idea, this.props.credits, this.props.vote)}
        </div>)}
        {msg && (
          <Typography
            className={`${this.props.classes.separatorMargin} ${this.props.classes.msg}`}
            variant='overline'
          >{msg}</Typography>
        )}
        <Loader loaded={this.props.otherFundedIdeas.status === Status.FULFILLED}>
          {this.props.otherFundedIdeas.ideas.filter(i => !!i).map((idea, index) => !idea ? null : (
            <div className={this.props.classes.separatorMargin}>
              <Typography variant='subtitle1' style={{display: 'flex', alignItems: 'baseline'}}>
                <Truncate lines={1} style={{ opacity: 0.6 }}><div>{idea.title}</div></Truncate>
                {!showFirstIdea && (
                  <Button onClick={() => this.props.history.push(`/${this.props.server.getProjectId()}/post/${idea.ideaId}`)}>
                    View
                  </Button>
                )}
              </Typography>
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
    const target = this.state.fixedTarget || this.state.maxTarget;
    const widthPerc = (100 * (max) / target)
    const transitionClassName = (this.state.sliderCurrentIdeaId && !this.state.sliderIsSubmitting) ? this.props.classes.sliderTransitionNone : this.props.classes.sliderTransitionSmooth
    const minMaxTitleOpacity = widthPerc > 25 ? 0.1 : 0;

    return (
      <div>
        <Slider
          className={transitionClassName}
          style={{ width: widthPerc + '%' }}
          disabled={this.state.sliderIsSubmitting || min === max}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e, val) => {
            const newFundAmount = this.sticky(val, min, max, target, fundAmount, idea && idea.funded, idea.fundGoal ? idea.fundGoal : undefined);
            const fundAmountDiff = newFundAmount - fundAmount;
            this.setState({
              sliderFundAmountDiff: fundAmountDiff,
              ...(!isSliding ? {
                sliderCurrentIdeaId: idea.ideaId,
                fixedTarget: this.state.maxTarget,
              } : {}),
            });
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
            thumbWrapper: transitionClassName,
            trackBefore: transitionClassName,
            trackAfter: transitionClassName,
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
            <div style={{flexGrow: target > 0 ? (value / target) : 0}}></div>
            <div style={{flexGrow: 0}}>
              {(min !== max) && ( 
                <Typography variant='body1'>
                  <CreditView key='value' val={value} credits={credits} />
                </Typography>
              )}
            </div>
            <div style={{flexGrow: target > 0 ? (1 - (value / target)) : 0}}></div>
          </div>
          <div style={{
            position: 'absolute',
            width: '100%',
            display: 'flex',
            alignItems: 'baseline',
          }}>
            <div style={{flexGrow: max / target}}></div>
            <div style={{opacity: minMaxTitleOpacity}}>
              <Typography variant='body1'>
                <CreditView key='max' val={max} credits={credits} />
              </Typography>
            </div>
            <div style={{flexGrow: 1 - (max / target)}}></div>
          </div>
          <div style={{ opacity: minMaxTitleOpacity }}>
            <Typography variant='body1'>
              <CreditView key='min' val={min} credits={credits} />
            </Typography>
          </div>
        </div>
      </div>
    );
  }

  sticky(input:number, min:number, max:number, target:number, startValue:number, ideaFunded:number = 0, ideaGoal?:number):number {
    var pointOfNoReturn = (target - min) / 100;
    var output = input;
    var outputCloseness;
    const fundDiff = input - startValue;
    [ideaGoal, startValue].forEach(target => {
      if(target === undefined) return;
      const targetDiff = target - ideaFunded;
      const closeness = Math.abs(targetDiff - fundDiff);
      if(closeness <= pointOfNoReturn && (!outputCloseness || outputCloseness > closeness)) { 
        outputCloseness = closeness;
        output = targetDiff + startValue;
      }
    })
    return output;
  }
}

export default connect<ConnectProps,{},Props,ReduxState>((state:ReduxState, ownProps:Props):ConnectProps => {
  const search = { fundedByMeAndActive: true };
  var newProps = {
    configver: state.conf.ver, // force rerender on config change
    credits: state.conf.conf ? state.conf.conf.credits : undefined,
    maxFundAmountSeen: state.ideas.maxFundAmountSeen,
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
      if(!vote || !vote.vote) return undefined;
      return {vote: vote.vote, ...idea.idea};
    });
  }

  return newProps;
})(withStyles(styles, { withTheme: true })(withRouter(FundingControl)));

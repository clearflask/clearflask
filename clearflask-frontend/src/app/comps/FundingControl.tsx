// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, Link as MuiLink, Slider, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import TruncateEllipsis from 'react-truncate-markup';
import * as Client from '../../api/client';
import { getSearchKey, ReduxState, Server, StateSettings, Status } from '../../api/server';
import CreditView from '../../common/config/CreditView';
import Hr from '../../common/Hr';
import InViewObserver from '../../common/InViewObserver';
import { preserveEmbed } from '../../common/util/historyUtil';
import minmax from '../../common/util/mathutil';
import { MutableRef } from '../../common/util/refUtil';
import { animateWrapper } from '../../site/landing/animateUtil';
import FundingBar, { FundingMaxWidth } from './FundingBar';
import LoadMoreButton from './LoadMoreButton';
import { PanelTitle } from './Panel';

interface SearchResult {
  status: Status;
  ideas: (Client.IdeaWithVote | undefined)[];
  cursor: string | undefined,
}

const styles = (theme: Theme) => createStyles({
  container: {
    width: FundingMaxWidth,
  },
  separatorMargin: {
    marginTop: theme.spacing(3),
  },
  sliderContainer: {
    position: 'relative',
  },
  slider: {
    padding: 0,
    transition: theme.transitions.create('opacity'),
    opacity: 1,
  },
  sliderHide: {
    opacity: 0,
  },
  sliderTransitionNone: {
    transition: theme.transitions.create(['width', 'transform', 'box-shadow', 'opacity'], {
      duration: 0,
      easing: theme.transitions.easing.easeOut,
    }),
    color: theme.palette.text.primary,
  },
  sliderTransitionSmooth: {
    transition: theme.transitions.create(['width', 'transform', 'box-shadow', 'opacity'], {
      duration: theme.transitions.duration.shortest,
      easing: theme.transitions.easing.easeOut,
    }),
    color: theme.palette.text.primary,
  },
  msg: {
    color: theme.palette.text.secondary,
  },
  msgHover: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  linkGetMore: {
    color: theme.palette.text.primary,
  },
  link: {
    borderBottom: '1px dashed',
    textDecoration: 'none',
    '&:hover': {
      borderBottomStyle: 'solid',
    },
  },
});

interface Props {
  myRef?: MutableRef<FundingControl>;
  server: Server;
  className?: string;
  style?: React.CSSProperties;
  /** If you want to show a particular idea first, set idea id here */
  ideaId?: string;
  onOtherFundedIdeasLoaded?: () => void;
  maxOther?: number;
  isInsidePaper?: boolean;
  title?: string;
  hideIfEmpty?: boolean;
}
interface ConnectProps {
  idea?: Client.Idea;
  fundAmount?: number;
  configver?: string;
  credits?: Client.Credits;
  otherFundedIdeas: SearchResult;
  balance: number;
  maxFundAmountSeen: number;
  settings: StateSettings;
  updateVote: (ideaId: string, voteUpdate: Client.IdeaVoteUpdate) => Promise<Client.IdeaVoteUpdateResponse>;
  callOnMount?: () => void,
  loadMore?: () => void;
}
interface State {
  sliderCurrentIdeaId?: string;
  sliderFundAmountDiff?: number;
  sliderIsSubmitting?: boolean;
  fixedTarget?: number;
  maxTarget: number;
}
class FundingControl extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = { maxTarget: 0 };
  _isMounted: boolean = false;
  readonly inViewObserverRef = React.createRef<InViewObserver>();

  constructor(props) {
    super(props);

    this.props.callOnMount?.();

    if (this.props.myRef) this.props.myRef.current = this;
  }

  componentDidMount() {
    this._isMounted = true;
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  static getDerivedStateFromProps(props: Props & ConnectProps & WithStyles<typeof styles, true>, state: State): Partial<State> | null {
    var maxTarget: number = (props.fundAmount || 0);
    props.otherFundedIdeas.ideas.forEach(i =>
      maxTarget = Math.max(maxTarget, i ? (i.vote.fundAmount || 0) : 0));
    maxTarget += props.balance;
    if (state.maxTarget !== maxTarget) {
      return { maxTarget };
    }
    return null;
  }

  componentDidUpdate(prevProps: Readonly<Props & ConnectProps & WithStyles<typeof styles, true>>): void {
    if (prevProps.otherFundedIdeas.status !== Status.FULFILLED
      && this.props.otherFundedIdeas.status === Status.FULFILLED) {
      this.props.onOtherFundedIdeasLoaded && this.props.onOtherFundedIdeasLoaded();
    }
  }

  render() {
    if (!this.props.credits) return null;

    const showFirstIdea = !!this.props.idea;

    var msg;
    if (!showFirstIdea
      && this.props.otherFundedIdeas.status === Status.FULFILLED
      && this.props.otherFundedIdeas.ideas.length === 0) {
      if (this.props.hideIfEmpty) return null;
      msg = 'No items funded yet';
    }

    return (
      <InViewObserver ref={this.inViewObserverRef} disabled={!this.props.settings.demoFundingControlAnimate}>
        <div style={this.props.style} className={`${this.props.className || ''} ${this.props.classes.container}`}>
          {!!this.props.title && (
            <PanelTitle text='Funded' />
          )}
          {showFirstIdea && this.props.idea && (<div>
            <FundingBar
              idea={this.props.idea}
              credits={this.props.credits}
              maxFundAmountSeen={this.props.maxFundAmountSeen}
              fundAmountDiff={this.state.sliderCurrentIdeaId === this.props.idea.ideaId ? this.state.sliderFundAmountDiff : undefined}
            />
            {this.renderSlider(this.props.idea, this.props.credits, this.props.fundAmount || 0)}
          </div>)}
          {!!msg && (
            <Typography
              className={`${this.props.classes.separatorMargin} ${this.props.classes.msg}`}
              variant='overline'
              component='div'
            >{msg}</Typography>
          )}
          {showFirstIdea && this.props.otherFundedIdeas.ideas.length > 0 && (
            <Hr isInsidePaper={this.props.isInsidePaper} length='120px'>Prioritize</Hr>
          )}
          {this.props.otherFundedIdeas.ideas.filter(i => !!i).map((idea, index) => !idea ? null : (
            <div key={idea.ideaId} className={this.props.classes.separatorMargin}>
              <Typography variant='subtitle1' style={{ display: 'flex', alignItems: 'baseline' }}>
                <TruncateEllipsis ellipsis='…' lines={1}><div style={{ opacity: 0.6 }}>{idea.title}</div></TruncateEllipsis>
                {!showFirstIdea && (
                  <Button component={Link} to={preserveEmbed(`/post/${idea.ideaId}`)}>
                    View
                  </Button>
                )}
              </Typography>
              <FundingBar
                idea={idea}
                credits={this.props.credits}
                maxFundAmountSeen={this.props.maxFundAmountSeen}
                fundAmountDiff={this.state.sliderCurrentIdeaId === idea.ideaId ? this.state.sliderFundAmountDiff : undefined}
              />
              {this.renderSlider(idea, this.props.credits!, idea.vote.fundAmount || 0)}
            </div>
          ))}
          {this.props.loadMore && (
            <LoadMoreButton onClick={this.props.loadMore.bind(this)} />
          )}
        </div>
      </InViewObserver>
    );
  }

  renderSlider(idea: Client.Idea, credits: Client.Credits, fundAmount: number) {
    const isSliding = this.state.sliderCurrentIdeaId === idea.ideaId;
    const min = 0;
    var max = fundAmount + this.props.balance;
    if (!isSliding) max -= (this.state.sliderFundAmountDiff || 0);
    const value = isSliding ? fundAmount + (this.state.sliderFundAmountDiff || 0) : fundAmount;
    const step = 1;
    const target = this.state.fixedTarget || this.state.maxTarget;
    const widthPerc = (100 * (max) / target)
    const transitionClassName = (this.state.sliderCurrentIdeaId && !this.state.sliderIsSubmitting) ? this.props.classes.sliderTransitionNone : this.props.classes.sliderTransitionSmooth
    const minMaxTitleOpacity = widthPerc > 25 ? 0.1 : 0;

    return (
      <div
        className={this.props.classes.sliderContainer}
      >
        {min === max && (
          <Typography
            className={classNames(this.props.classes.msg, this.props.classes.msgHover)}
            variant='overline'
            component='div'
          >
            You have no balance.&nbsp;
            {!!this.props.credits?.creditPurchase?.redirectUrl && (
              <MuiLink
                className={classNames(this.props.classes.link, this.props.classes.linkGetMore)}
                color='inherit'
                href={this.props.credits.creditPurchase.redirectUrl}
                target='_blank'
                underline='none'
                rel='noopener nofollow'
              >
                {this.props.credits.creditPurchase.buttonTitle || 'Get more'}
              </MuiLink>
            )}
          </Typography>
        )}
        <Slider
          className={classNames(this.props.classes.slider, (min === max) && this.props.classes.sliderHide)}
          style={{ width: widthPerc + '%' }}
          disabled={this.state.sliderIsSubmitting || min === max}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e, val) => {
            const newFundAmount = this.sticky(val as any as number, min, max, target, fundAmount, idea && idea.funded, idea.fundGoal ? idea.fundGoal : undefined);
            const fundAmountDiff = newFundAmount - fundAmount;
            this.setState({
              sliderFundAmountDiff: fundAmountDiff,
              ...(!isSliding ? {
                sliderCurrentIdeaId: idea.ideaId,
                fixedTarget: this.state.maxTarget,
              } : {}),
            });
          }}
          onChangeCommitted={e => {
            const sliderFundAmountDiff = this.state.sliderFundAmountDiff;
            if (sliderFundAmountDiff === undefined || sliderFundAmountDiff === 0) {
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
            this.props.updateVote(idea.ideaId, {
              fundDiff: minmax(-fundAmount, sliderFundAmountDiff, this.props.balance),
            })
              .finally(() => this.setState({
                sliderCurrentIdeaId: undefined,
                fixedTarget: undefined,
                sliderFundAmountDiff: undefined,
                sliderIsSubmitting: false,
              }));
          }}
          classes={{
            thumb: transitionClassName,
            track: transitionClassName,
            root: transitionClassName,
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
            <div style={{ flexGrow: target > 0 ? (value / target) : 0 }}></div>
            <div style={{ flexGrow: 0 }}>
              {(min !== max) && (
                <Typography variant='body1'>
                  <CreditView key='value' val={value} credits={credits} />
                </Typography>
              )}
            </div>
            <div style={{ flexGrow: target > 0 ? (1 - (value / target)) : 0 }}></div>
          </div>
          <div style={{
            position: 'absolute',
            width: '100%',
            display: 'flex',
            alignItems: 'baseline',
          }}>
            <div style={{ flexGrow: max / target }}></div>
            <div style={{ opacity: minMaxTitleOpacity }}>
              <Typography variant='body1'>
                <CreditView key='max' val={max} credits={credits} />
              </Typography>
            </div>
            <div style={{ flexGrow: 1 - (max / target) }}></div>
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

  sticky(input: number, min: number, max: number, target: number, startValue: number, ideaFunded: number = 0, ideaGoal?: number): number {
    var pointOfNoReturn = (target - min) / 100;
    var output = input;
    var outputCloseness;
    const fundDiff = input - startValue;
    [ideaGoal, startValue].forEach(target => {
      if (target === undefined) return;
      const targetDiff = target - ideaFunded;
      const closeness = Math.abs(targetDiff - fundDiff);
      if (closeness <= pointOfNoReturn && (!outputCloseness || outputCloseness > closeness)) {
        outputCloseness = closeness;
        output = targetDiff + startValue;
      }
    })
    return output;
  }

  async demoFundingControlAnimate(changes: Array<{ index: number; fundDiff: number; }>, isReverse: boolean = false) {
    const animate = animateWrapper(
      () => this._isMounted,
      this.inViewObserverRef,
      () => this.props.settings,
      this.setState.bind(this));

    if (await animate({ sleepInMs: 500 })) return;

    for (const change of (isReverse ? [...changes].reverse() : changes)) {
      const fundDiff = change.fundDiff * (isReverse ? -1 : 1)

      const idea: Client.Idea | Client.IdeaWithVote | undefined = (change.index === 0 && !!this.props.idea)
        ? this.props.idea
        : this.props.otherFundedIdeas.ideas[change.index + (!!this.props.idea ? -1 : 0)];
      if (!idea) continue;

      const fundAmount = change.index === 0
        ? this.props.fundAmount
        : (idea as Client.IdeaWithVote).vote.fundAmount;

      const increment = fundDiff >= 0 ? 1 : -1;

      while ((this.state.sliderCurrentIdeaId === undefined || this.state.sliderCurrentIdeaId === idea.ideaId)
        && Math.abs((this.state.sliderFundAmountDiff || 0) + increment) <= Math.abs(fundDiff)
        && this.props.balance >= ((this.state.sliderFundAmountDiff || 0) + increment)
        && ((fundAmount || 0) + (this.state.sliderFundAmountDiff || 0) + increment) >= 0) {

        if (await animate({
          setState: {
            sliderCurrentIdeaId: idea.ideaId,
            sliderFundAmountDiff: (this.state.sliderFundAmountDiff || 0) + increment,
          }
        })) return;
        if (await animate({ sleepInMs: 50 })) return;
      }

      if (this.state.sliderCurrentIdeaId === idea.ideaId
        && this.state.sliderFundAmountDiff !== 0) {
        if (await animate({ setState: { sliderIsSubmitting: true } })) return;
        await this.props.updateVote(idea.ideaId, {
          fundDiff: this.state.sliderFundAmountDiff!,
        });
        if (await animate({
          setState: {
            sliderCurrentIdeaId: undefined,
            fixedTarget: undefined,
            sliderFundAmountDiff: undefined,
            sliderIsSubmitting: false,
          }
        })) return;
      }

      if (await animate({ sleepInMs: 500 })) return;
    }
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props): ConnectProps => {
  const search = {
    fundedByMeAndActive: true,
    limit: ownProps.maxOther,
  };
  const dispatchIdeaGetOnIdeaId = (ownProps.ideaId && state.ideas.byId[ownProps.ideaId]?.status === undefined) ? ownProps.ideaId : undefined;
  var newProps: ConnectProps = {
    idea: ownProps.ideaId ? state.ideas.byId[ownProps.ideaId]?.idea : undefined,
    fundAmount: ownProps.ideaId ? state.votes.fundAmountByIdeaId[ownProps.ideaId] : undefined,
    configver: state.conf.ver, // force rerender on config change
    credits: state.conf.conf ? state.conf.conf.users.credits : undefined,
    maxFundAmountSeen: state.ideas.maxFundAmountSeen,
    otherFundedIdeas: {
      status: Status.PENDING,
      ideas: [],
      cursor: undefined,
    } as SearchResult,
    balance: state.credits.myBalance.balance || 0,
    settings: state.settings,
    updateVote: (ideaId: string, ideaVoteUpdate: Client.IdeaVoteUpdate): Promise<Client.IdeaVoteUpdateResponse> => ownProps.server.dispatch().then(d => d.ideaVoteUpdate({
      projectId: state.projectId!,
      ideaId: ideaId,
      ideaVoteUpdate: ideaVoteUpdate,
    })),
    callOnMount: () => {
      if (dispatchIdeaGetOnIdeaId) {
        ownProps.server.dispatch().then(d => d.ideaGet({
          projectId: state.projectId!,
          ideaId: dispatchIdeaGetOnIdeaId,
        }));
      }
      ownProps.server.dispatch().then(d => d.ideaSearch({
        projectId: state.projectId!,
        ideaSearch: search,
      }));
    },
  };

  const bySearch = state.ideas.bySearch[getSearchKey(search)];
  if (bySearch) {
    newProps.otherFundedIdeas.status = bySearch.status;
    newProps.otherFundedIdeas.cursor = bySearch.cursor;
    newProps.otherFundedIdeas.ideas = (bySearch.ideaIds || [])
      .filter(ideaId => ideaId !== ownProps.ideaId)
      .map(ideaId => {
        const idea = state.ideas.byId[ideaId];
        if (!idea || !idea.idea || idea.status !== Status.FULFILLED) return undefined;
        return {
          ...idea.idea, vote: {
            vote: state.votes.votesByIdeaId[ideaId],
            expression: state.votes.expressionByIdeaId[ideaId],
            fundAmount: state.votes.fundAmountByIdeaId[ideaId],
          }
        };
      });
    if (bySearch.cursor) {
      newProps.loadMore = () => {
        ownProps.server.dispatch().then(d => d.ideaSearch({
          projectId: state.projectId!,
          ideaSearch: search,
          cursor: bySearch.cursor,
        }));
      }
    }
  }

  return newProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(FundingControl));

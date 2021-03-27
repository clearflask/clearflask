import loadable from '@loadable/component';
import { Button, Chip, Collapse, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { fade } from '@material-ui/core/styles/colorManipulator';
import AddIcon from '@material-ui/icons/Add';
/* alternatives: comment, chat bubble (outline), forum, mode comment, add comment */
import SpeechIcon from '@material-ui/icons/CommentOutlined';
import AddEmojiIcon from '@material-ui/icons/InsertEmoticon';
import classNames from 'classnames';
import { BaseEmoji } from 'emoji-mart/dist-es/index.js';
import { withSnackbar, WithSnackbarProps } from 'notistack';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import { Link } from 'react-router-dom';
import TimeAgo from 'react-timeago';
import TruncateEllipsis from 'react-truncate-markup';
import * as Client from '../../api/client';
import { cssBlurry, ReduxState, Server, StateSettings, Status } from '../../api/server';
import ClosablePopper from '../../common/ClosablePopper';
import GradientFade from '../../common/GradientFade';
import InViewObserver from '../../common/InViewObserver';
import ModAction from '../../common/ModAction';
import ModStar from '../../common/ModStar';
import RichViewer from '../../common/RichViewer';
import TruncateFade from '../../common/Truncate';
import UserDisplay from '../../common/UserDisplay';
import { notEmpty } from '../../common/util/arrayUtil';
import { preserveEmbed } from '../../common/util/historyUtil';
import { createMutableRef } from '../../common/util/refUtil';
import { importFailed, importSuccess } from '../../Main';
import { animateWrapper } from '../../site/landing/animateUtil';
import Delimited from '../utils/Delimited';
import Loader from '../utils/Loader';
import Loading from '../utils/Loading';
import CommentList from './CommentList';
import CommentReply from './CommentReply';
import FundingBar from './FundingBar';
import FundingControl from './FundingControl';
import LogIn from './LogIn';
import PostEdit from './PostEdit';
import VotingControl from './VotingControl';

const EmojiPicker = loadable(() => import(/* webpackChunkName: "EmojiPicker", webpackPrefetch: true */'../../common/EmojiPicker').then(importSuccess).catch(importFailed), { fallback: (<Loading />), ssr: false });

export type PostVariant = 'list' | 'page';
export const MaxContentWidth = 600;

const styles = (theme: Theme) => createStyles({
  comment: {
    margin: theme.spacing(1),
  },
  outer: {
    minWidth: 300,
  },
  post: {
    margin: theme.spacing(0.5),
    display: 'grid',
    width: (props: Props) => props.widthExpand ? MaxContentWidth : undefined,
    maxWidth: (props: Props) => props.widthExpand ? '100%' : MaxContentWidth,
    gridTemplateColumns: 'auto 1fr',
    gridTemplateRows: 'auto 1fr',
    gridTemplateAreas:
      "'. f'"
      + " 'v c'"
      + " 'bc bc'"
      + " 'o o'",
  },
  postContent: {
    gridArea: 'c',
    display: 'flex',
    flexDirection: 'column',
    margin: theme.spacing(1),
    minWidth: 0,
  },
  postVoting: {
    gridArea: 'v',
  },
  postFunding: {
    gridArea: 'f',
    minWidth: 0,
  },
  postContentBeforeComments: {
    gridArea: 'bc',
    minWidth: 0,
    paddingTop: theme.spacing(4),
  },
  postComments: {
    gridArea: 'o',
    minWidth: 0,
  },
  votingControl: {
    margin: theme.spacing(0, 0, 0, 0.5),
  },
  title: {
    lineHeight: 'unset',
  },
  titlePage: {
    ...theme.typography.h4,
  },
  titleList: {
    ...theme.typography.h4,
    fontSize: '1.25rem',
  },
  titleListWithoutDescription: {
    fontSize: '1rem',
  },
  titleContainer: {
    display: 'flex',
    alignItems: 'baseline',
  },
  titleAndDescription: {
    margin: theme.spacing(0.5),
    display: 'flex',
    flexDirection: 'column',
    textTransform: 'none',
  },
  expandable: {
    '&:hover $title': {
      textDecoration: 'underline',
    },
    cursor: 'pointer',
    textDecoration: 'none'
  },
  description: {
    marginTop: theme.spacing(1),
  },
  descriptionPage: {
    whiteSpace: 'pre-wrap',
  },
  descriptionList: {
    color: theme.palette.text.secondary,
  },
  pre: {
    whiteSpace: 'pre-wrap',
  },
  responseContainer: {
    paddingLeft: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
  },
  responsePrefixText: {
    fontSize: '0.8rem',
  },
  response: {
  },
  responsePage: {
    whiteSpace: 'pre-wrap',
  },
  responseList: {
    color: theme.palette.text.secondary,
  },
  editButton: {
    padding: `3px ${theme.spacing(0.5)}px`,
    whiteSpace: 'nowrap',
    minWidth: 'unset',
    color: theme.palette.text.secondary,
  },
  button: {
    padding: `3px ${theme.spacing(0.5)}px`,
    whiteSpace: 'nowrap',
    minWidth: 'unset',
    textTransform: 'unset',
  },
  timeAgo: {
    whiteSpace: 'nowrap',
    margin: theme.spacing(0.5),
  },
  commentCount: {
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    margin: theme.spacing(0.5),
  },
  author: {
    whiteSpace: 'nowrap',
    margin: theme.spacing(0.5),
  },
  editIconButton: {
    padding: '0px',
    color: theme.palette.text.secondary,
  },
  voteIconButton: {
    fontSize: '2em',
    padding: '0px',
    color: theme.palette.text.secondary,
  },
  voteIconButtonUp: {
    borderRadius: '80% 80% 50% 50%',
  },
  voteIconButtonDown: {
    borderRadius: '50% 50% 80% 80%',
  },
  voteIconVoted: {
    color: theme.palette.primary.main + '!important', // important overrides disabled
    transform: 'scale(1.25)',
  },
  voteCount: {
    lineHeight: '1em',
    fontSize: '0.9em',
  },
  expressionContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  expressionInner: {
    padding: '4px 6px',
  },
  expressionOuter: {
    height: 'auto',
    borderRadius: '18px',
  },
  expressionHasExpressed: {
    borderColor: theme.palette.primary.main,
    backgroundColor: fade(theme.palette.primary.main, 0.04),
  },
  expressionNotExpressed: {
    borderColor: 'rgba(0,0,0,0)',
  },
  expression: {
    filter: theme.expressionGrayscale ? `grayscale(${theme.expressionGrayscale}%)` : undefined,
    // Somehow commenting this centers the expression and count.
    // If something else becomes wonky, explore further later...
    // lineHeight: 1.15,
    fontSize: '1em',
    display: 'inline-block',
    width: 16,
    height: 16,
    transform: 'translate(-1px,-1px)',
    wordBreak: 'keep-all',
    fontFamily: '"Segoe UI Emoji", "Segoe UI Symbol", "Segoe UI", "Apple Color Emoji", "Twemoji Mozilla", "Noto Color Emoji", "EmojiOne Color", "Android Emoji"',
  },
  expressionExpressedNonButton: {
    border: '1px solid ' + theme.palette.primary.main,
    color: theme.palette.primary.main,
  },
  expressionPopperPaper: {
    paddingBottom: theme.spacing(1),
    flexWrap: 'wrap',
  },
  fundMoreButton: {
    height: 'auto',
    padding: 0,
    borderRadius: '18px',
    margin: theme.spacing(0.5),
  },
  fundThisButton: {
    alignSelf: 'flex-end',
    marginBottom: '-1px', // Fix baseline alignment when button is not present
  },
  fundThisButtonLabel: {
    display: 'flex',
    alignItems: 'center',
  },
  fundMoreLabel: {
    padding: '4px 6px',
  },
  fundMoreContainer: {
    width: 16,
    height: 16,
  },
  popover: {
    outline: '1px solid ' + theme.palette.grey[300],
  },
  moreContainer: {
    lineHeight: 'unset',
    display: 'flex',
    alignItems: 'center',
    color: theme.palette.text.secondary,
  },
  moreMainIcon: {
    position: 'relative',
    width: 14,
    height: 14,
    top: 3,
  },
  moreAddIcon: {
    borderRadius: 16,
    width: 12,
    height: 12,
    position: 'relative',
    top: -4,
    left: -6,
  },
  bottomBarLine: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center', // TODO properly center items, neither center nor baseline works here
  },
  grow: {
    flexGrow: 1,
  },
  bottomBar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  commentSection: {
    marginTop: theme.spacing(2),
  },
  addCommentForm: {
    display: 'inline-flex',
    flexDirection: 'column',
    margin: theme.spacing(2),
    marginBottom: 0,
    alignItems: 'flex-start',
  },
  addCommentField: {
    transition: theme.transitions.create('width'),
  },
  addCommentFieldCollapsed: {
    width: 73,
  },
  addCommentFieldExpanded: {
    width: 400,
  },
  addCommentButton: {
    margin: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
  nothing: {
    margin: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
  funding: {
    paddingTop: theme.spacing(1),
    paddingLeft: theme.spacing(1.5),
    paddingRight: theme.spacing(1.5),
    display: 'flex',
    alignItems: 'center',
    float: 'left', // Exclude from baseline calculation
    clear: 'left', // Exclude from baseline calculation
    width: '100%', // Exclude from baseline calculation
  },
  pulsateFunding: {
    opacity: 0.1,
    animation: `$postVotingPulsate 2000ms ${theme.transitions.easing.easeInOut} 0ms infinite`,
  },
  fundingPopper: {
    maxWidth: '100%',
  },
  fundingPopperPaper: {
    paddingBottom: theme.spacing(1),
  },
  pulsateVoting: {
    opacity: 0.1,
    animation: `$postVotingPulsate 2000ms ${theme.transitions.easing.easeInOut} 667ms infinite`,
  },
  pulsateExpressions: {
    opacity: 0.1,
    animation: `$postVotingPulsate 2000ms ${theme.transitions.easing.easeInOut} 1333ms infinite`,
  },
  pulsateHidden: {
    opacity: 0.1,
  },
  pulsateShown: {
    opacity: 1,
  },
  '@keyframes postVotingPulsate': {
    '0%': {
      opacity: 0.1,
    },
    '34%': {
      opacity: 0.1,
    },
    '67%': {
      opacity: 1,
    },
    '100%': {
      opacity: 0.1,
    },
  },
  ...cssBlurry,
});
interface Props {
  className?: string;
  server: Server;
  idea?: Client.Idea;
  variant: PostVariant;
  /**
   * If true, when post is clicked,
   * variant is switched from 'list' to 'page',
   * url is appended wZith /post/<postId>
   * and post is expanded to full screen.
   */
  expandable?: boolean;
  forceDisablePostExpand?: boolean;
  display?: Client.PostDisplay;
  widthExpand?: boolean;
  contentBeforeComments?: React.ReactNode;
  onClickTag?: (tagId: string) => void;
  onClickCategory?: (categoryId: string) => void;
  onClickStatus?: (statusId: string) => void;
  onClickPost?: (postId: string) => void;
  onUserClick?: (userId: string) => void;
}
interface ConnectProps {
  callOnMount?: () => void,
  configver?: string;
  projectId: string;
  settings: StateSettings;
  category?: Client.Category;
  credits?: Client.Credits;
  maxFundAmountSeen: number;
  vote?: Client.VoteOption;
  expression?: Array<string>;
  fundAmount?: number;
  loggedInUser?: Client.User;
  updateVote: (voteUpdate: Client.IdeaVoteUpdate) => Promise<Client.IdeaVoteUpdateResponse>;
}
interface State {
  currentVariant: PostVariant;
  fundingExpanded?: boolean;
  expressionExpanded?: boolean;
  logInOpen?: boolean;
  isSubmittingVote?: Client.VoteOption;
  isSubmittingFund?: boolean;
  isSubmittingExpression?: boolean;
  editExpanded?: boolean;
  commentExpanded?: boolean;
  demoFlashPostVotingControlsHovering?: 'vote' | 'fund' | 'express';
}
class Post extends Component<Props & ConnectProps & RouteComponentProps & WithStyles<typeof styles, true> & WithSnackbarProps, State> {
  onLoggedIn?: () => void;
  _isMounted: boolean = false;
  readonly fundingControlRef = createMutableRef<any>();
  readonly inViewObserverRef = React.createRef<InViewObserver>();
  priorToExpandDocumentTitle: string | undefined;

  constructor(props) {
    super(props);

    this.state = {
      currentVariant: props.variant,
    };

    props.callOnMount?.();
  }

  componentDidMount() {
    this._isMounted = true;
    if (!!this.props.settings.demoFundingControlAnimate) {
      this.demoFundingControlAnimate(this.props.settings.demoFundingControlAnimate);
    } else if (!!this.props.settings.demoFundingAnimate) {
      this.demoFundingAnimate(this.props.settings.demoFundingAnimate);
    }
    if (!!this.props.settings.demoVotingExpressionsAnimate) {
      this.demoVotingExpressionsAnimate(this.props.settings.demoVotingExpressionsAnimate);
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  render() {
    if (!this.props.idea) return (
      <Loader skipFade loaded={false}>
      </Loader>
    );

    const variant = this.state.currentVariant;

    return (
      <Loader skipFade className={classNames(this.props.className, this.props.classes.outer)} loaded={!!this.props.idea}>
        <InViewObserver ref={this.inViewObserverRef}>
          <div className={this.props.classes.post}>
            <div className={this.props.classes.postVoting}>
              {this.renderVoting(variant)}
            </div>
            <div className={this.props.classes.postFunding}>
              {this.renderFunding(variant)}
            </div>
            <div className={this.props.classes.postContent}>
              {this.renderTitleAndDescription(variant, (
                <React.Fragment>
                  <div className={this.props.classes.titleContainer}>
                    {this.renderTitle(variant)}
                    {this.renderStatus(variant)}
                  </div>
                  {this.renderDescription(variant)}
                  {this.renderResponse(variant)}
                </React.Fragment>
              ))}
              {this.renderBottomBar(variant)}
            </div>
            {this.props.contentBeforeComments && (
              <div className={this.props.classes.postContentBeforeComments}>
                {this.props.contentBeforeComments}
              </div>
            )}
            <div className={this.props.classes.postComments}>
              {this.renderComments(variant)}
            </div>
          </div>
          <LogIn
            actionTitle='Get notified of replies'
            server={this.props.server}
            open={this.state.logInOpen}
            onClose={() => this.setState({ logInOpen: false })}
            onLoggedInAndClose={() => {
              this.setState({ logInOpen: false });
              this.onLoggedIn && this.onLoggedIn();
              this.onLoggedIn = undefined;
            }}
          />
        </InViewObserver>
      </Loader>
    );
  }

  renderBottomBar(variant: PostVariant) {
    const leftSide = [
      this.renderExpression(variant),
    ].filter(notEmpty);
    const rightSide = [
      this.renderAuthor(variant),
      this.renderCategory(variant),
      ...(this.renderTags(variant) || []),
      this.renderCommentCount(variant),
      this.renderCreatedDatetime(variant),
    ].filter(notEmpty);
    // Only show edit button if something else is shown too in list variant
    if (variant === 'page' || leftSide.length + rightSide.length > 0) {
      const edit = this.renderEdit(variant);
      if (edit) rightSide.push(edit);
    }

    if (leftSide.length + rightSide.length === 0) return null;

    return (
      <div className={this.props.classes.bottomBar}>
        <div className={this.props.classes.bottomBarLine}>
          <Delimited>
            {leftSide}
          </Delimited>
        </div>
        <div className={this.props.classes.grow} />
        <div className={this.props.classes.bottomBarLine}>
          <Delimited>
            {rightSide}
          </Delimited>
        </div>
      </div>
    );
  }

  renderAuthor(variant: PostVariant) {
    if (variant !== 'page' && this.props.display && this.props.display.showAuthor === false
      || !this.props.idea) return null;

    return (
      <Typography key='author' className={this.props.classes.author} variant='caption'>
        <UserDisplay
          onClick={this.props.onUserClick}
          user={{
            userId: this.props.idea.authorUserId,
            name: this.props.idea.authorName,
            isMod: this.props.idea.authorIsMod
          }}
        />
      </Typography>
    );
  }

  renderCreatedDatetime(variant: PostVariant) {
    if (variant !== 'page' && this.props.display && this.props.display.showCreated === false
      || !this.props.idea) return null;

    return (
      <Typography key='createdDatetime' className={this.props.classes.timeAgo} variant='caption'>
        <TimeAgo date={this.props.idea.created} />
      </Typography>
    );
  }

  renderCommentCount(variant: PostVariant) {
    if (this.props.display?.showCommentCount === false
      || variant === 'page'
      || !this.props.idea
      || (this.props.display?.showCommentCount === undefined && !this.props.idea.commentCount)
      || !this.props.category
      || !this.props.category.support.comment) return null;

    return (
      <Typography key='commentCount' className={this.props.classes.commentCount} variant='caption'>
        <SpeechIcon fontSize='inherit' />
        &nbsp;
        {this.props.idea.commentCount || 0}
      </Typography>
    );
  }

  renderComments(variant: PostVariant) {
    if (variant !== 'page'
      || !this.props.idea
      || !this.props.category
      || !this.props.category.support.comment) return null;

    const commentsAllowed: boolean = !this.props.idea.statusId
      || this.props.category.workflow.statuses.find(s => s.statusId === this.props.idea!.statusId)?.disableComments !== true;

    const logIn = () => {
      if (this.props.loggedInUser) {
        return Promise.resolve();
      } else {
        return new Promise<void>(resolve => {
          this.onLoggedIn = resolve
          this.setState({ logInOpen: true });
        });
      }
    };

    return (
      <div className={this.props.classes.commentSection}>
        {commentsAllowed && (
          <Button key='addComment' variant='text' className={this.props.classes.addCommentButton}
            onClick={e => this.setState({ commentExpanded: true })}>
            <Typography variant='caption'>Comment</Typography>
          </Button>
        )}
        {this.props.idea.commentCount > 0 && (
          <CommentList
            server={this.props.server}
            logIn={logIn}
            ideaId={this.props.idea.ideaId}
            expectedCommentCount={this.props.idea.childCommentCount}
            parentCommentId={undefined}
            newCommentsAllowed={commentsAllowed}
            loggedInUser={this.props.loggedInUser}
            onAuthorClick={this.props.onUserClick ? (commentId, userId) => this.props.onUserClick && this.props.onUserClick(userId) : undefined}
          />
        )}
        {commentsAllowed && (
          <Collapse
            in={this.state.commentExpanded}
            mountOnEnter
            unmountOnExit
          >
            <CommentReply
              server={this.props.server}
              ideaId={this.props.idea.ideaId}
              focusOnMount
              logIn={logIn}
              onSubmitted={() => this.setState({ commentExpanded: undefined })}
              onBlurAndEmpty={() => this.setState({ commentExpanded: undefined })}
            />
          </Collapse>
        )}
      </div>
    );
  }

  renderEdit(variant: PostVariant) {
    const isMod = this.props.server.isModOrAdminLoggedIn();
    const isAuthor = this.props.idea && this.props.loggedInUser && this.props.idea.authorUserId === this.props.loggedInUser.userId;
    if (!this.props.idea
      || !this.props.category
      || (!isMod && !isAuthor)
      || this.props.display?.showEdit === false) return null;

    const labelEdit = isAuthor
      ? 'Edit'
      : (<ModAction label='Edit' />);
    return (
      <React.Fragment key='edit'>
        <Button variant='text' className={this.props.classes.editButton}
          onClick={e => this.setState({ editExpanded: !this.state.editExpanded })}>
          <Typography variant='caption'>{labelEdit}</Typography>
        </Button>
        {this.state.editExpanded !== undefined && (
          <PostEdit
            key={this.props.idea.ideaId}
            server={this.props.server}
            category={this.props.category}
            credits={this.props.credits}
            loggedInUser={this.props.loggedInUser}
            idea={this.props.idea}
            open={this.state.editExpanded}
            onClose={() => this.setState({ editExpanded: false })}
          />
        )}
      </React.Fragment>
    );
  }

  renderStatus(variant: PostVariant) {
    if (variant !== 'page' && this.props.display && this.props.display.showStatus === false
      || !this.props.idea
      || !this.props.idea.statusId
      || !this.props.category) return null;

    const status = this.props.category.workflow.statuses.find(s => s.statusId === this.props.idea!.statusId);
    if (!status) return null;

    return (
      <React.Fragment>
        &nbsp;
        <Button key='status' variant='text' className={this.props.classes.button} disabled={!this.props.onClickStatus || variant === 'page'}
          onClick={e => this.props.onClickStatus && this.props.onClickStatus(status.statusId)}>
          <Typography variant='caption' style={{ color: status.color }}>
            {status.name}
          </Typography>
        </Button>
      </React.Fragment>
    );
  }

  renderTags(variant: PostVariant) {
    if (variant !== 'page' && this.props.display && this.props.display.showTags === false
      || !this.props.idea
      || this.props.idea.tagIds.length === 0
      || !this.props.category) return null;

    return this.props.idea.tagIds
      .map(tagId => this.props.category!.tagging.tags.find(t => t.tagId === tagId))
      .filter(tag => !!tag)
      .map(tag => (
        <Button key={'tag' + tag!.tagId} variant="text" className={this.props.classes.button} disabled={!this.props.onClickTag || variant === 'page'}
          onClick={e => this.props.onClickTag && this.props.onClickTag(tag!.tagId)}>
          <Typography variant='caption' style={{ color: tag!.color }}>
            {tag!.name}
          </Typography>
        </Button>
      ));
  }

  renderCategory(variant: PostVariant) {
    if (variant === 'page'
      || this.props.display && this.props.display.showCategoryName === false
      || !this.props.idea
      || !this.props.category) return null;

    return (
      <Button key='category' variant="text" className={this.props.classes.button} disabled={!this.props.onClickCategory || variant !== 'list'}
        onClick={e => this.props.onClickCategory && this.props.onClickCategory(this.props.category!.categoryId)}>
        <Typography variant='caption' style={{ color: this.props.category.color }}>
          {this.props.category.name}
        </Typography>
      </Button>
    );
  }

  renderVoting(variant: PostVariant) {
    if (variant !== 'page' && this.props.display && this.props.display.showVoting === false
      || !this.props.idea
      || !this.props.category
      || !this.props.category.support.vote) return null;
    const votingAllowed: boolean = !this.props.idea.statusId
      || this.props.category.workflow.statuses.find(s => s.statusId === this.props.idea!.statusId)?.disableVoting !== true;
    if (!votingAllowed
      && !this.props.idea.voteValue) return null;

    return (
      <div
        className={classNames(
          this.props.classes.votingControl,
          !!this.props.settings.demoFlashPostVotingControls && (this.state.demoFlashPostVotingControlsHovering === undefined ? this.props.classes.pulsateVoting
            : (this.state.demoFlashPostVotingControlsHovering === 'vote' ? this.props.classes.pulsateShown : this.props.classes.pulsateHidden)))}
        onMouseOver={!!this.props.settings.demoFlashPostVotingControls ? () => this.setState({ demoFlashPostVotingControlsHovering: 'vote' }) : undefined}
        onMouseOut={!!this.props.settings.demoFlashPostVotingControls ? () => this.setState({ demoFlashPostVotingControlsHovering: undefined }) : undefined}
      >
        <VotingControl
          className={this.props.classes.votingControl}
          vote={this.props.vote}
          voteValue={this.props.idea.voteValue || 0}
          isSubmittingVote={this.state.isSubmittingVote}
          votingAllowed={votingAllowed}
          onUpvote={() => this.upvote()}
          onDownvote={this.props.category.support.vote.enableDownvotes ? () => this.downvote() : undefined}
        />
      </div>
    );
  }

  upvote() {
    const upvote = () => {
      if (this.state.isSubmittingVote) return;
      this.setState({ isSubmittingVote: Client.VoteOption.Upvote });
      this.props.updateVote({
        vote: (this.props.vote === Client.VoteOption.Upvote)
          ? Client.VoteOption.None : Client.VoteOption.Upvote
      })
        .then(() => this.setState({ isSubmittingVote: undefined }),
          () => this.setState({ isSubmittingVote: undefined }));
    };
    if (this.props.loggedInUser) {
      upvote();
    } else {
      this.onLoggedIn = upvote;
      this.setState({ logInOpen: true });
    }
  }

  downvote() {
    if (this.state.isSubmittingVote) return;
    const downvote = () => {
      this.setState({ isSubmittingVote: Client.VoteOption.Downvote });
      this.props.updateVote({
        vote: (this.props.vote === Client.VoteOption.Downvote)
          ? Client.VoteOption.None : Client.VoteOption.Downvote
      })
        .then(() => this.setState({ isSubmittingVote: undefined }),
          () => this.setState({ isSubmittingVote: undefined }));
    };
    if (this.props.loggedInUser) {
      downvote();
    } else {
      this.onLoggedIn = downvote;
      this.setState({ logInOpen: true });
    }
  }

  fundingExpand(callback?: () => void) {
    this.setState({
      fundingExpanded: true,
    }, callback);
  }

  fundingBarRef: React.RefObject<HTMLDivElement> = React.createRef();
  renderFunding(variant: PostVariant) {
    if (variant !== 'page' && this.props.display && this.props.display.showFunding === false
      || !this.props.idea
      || !this.props.credits
      || !this.props.category
      || !this.props.category.support.fund) return null;
    const fundingAllowed = !this.props.idea.statusId
      || this.props.category.workflow.statuses.find(s => s.statusId === this.props.idea!.statusId)?.disableFunding !== true;
    if (!fundingAllowed
      && !this.props.idea.fundGoal
      && !this.props.idea.funded
      && !this.props.idea.fundersCount) return null;

    const iFundedThis = !!this.props.fundAmount && this.props.fundAmount > 0;

    const fundThisButton = (
      <Button
        color={iFundedThis ? 'primary' : 'default'}
        classes={{
          root: `${this.props.classes.button} ${this.props.classes.fundThisButton}`,
        }}
        disabled={!fundingAllowed}
        onClick={!fundingAllowed ? undefined : (e => {
          const onLoggedInClick = () => {
            this.fundingExpand();
          };
          if (this.props.loggedInUser) {
            onLoggedInClick();
          } else {
            this.onLoggedIn = onLoggedInClick;
            this.setState({ logInOpen: true });
          }
        })}
      >
        <Typography
          variant='caption'
          className={this.props.classes.fundThisButtonLabel}
          color={fundingAllowed ? 'primary' : 'inherit'}
        >
          {fundingAllowed
            ? <span style={{ display: 'flex', alignItems: 'center' }}>
              <AddIcon fontSize='inherit' />
              {iFundedThis ? 'Adjust' : 'Fund'}
            </span>
            : 'Closed'}
        </Typography>
      </Button>
    );

    return (
      <div style={{ display: 'flex' }}>
        {fundingAllowed && (
          <ClosablePopper
            clickAway
            open={!!this.state.fundingExpanded}
            onClose={() => this.setState({ fundingExpanded: false })}
            className={this.props.classes.fundingPopper}
          >
            <div className={classNames(this.props.classes.funding, this.props.classes.fundingPopperPaper)}>
              <FundingControl
                myRef={this.fundingControlRef}
                server={this.props.server}
                ideaId={this.props.idea.ideaId}
                maxOther={2}
                isInsidePaper
              />
            </div>
          </ClosablePopper>
        )}
        <div
          className={classNames(
            this.props.classes.funding,
            !!this.props.settings.demoFlashPostVotingControls && (this.state.demoFlashPostVotingControlsHovering === undefined ? this.props.classes.pulsateFunding
              : (this.state.demoFlashPostVotingControlsHovering === 'fund' ? this.props.classes.pulsateShown : this.props.classes.pulsateHidden)))}
          onMouseOver={!!this.props.settings.demoFlashPostVotingControls ? () => this.setState({ demoFlashPostVotingControlsHovering: 'fund' }) : undefined}
          onMouseOut={!!this.props.settings.demoFlashPostVotingControls ? () => this.setState({ demoFlashPostVotingControlsHovering: undefined }) : undefined}
        >
          <FundingBar
            fundingBarRef={this.fundingBarRef}
            idea={this.props.idea}
            credits={this.props.credits}
            maxFundAmountSeen={this.props.maxFundAmountSeen}
            overrideRight={fundThisButton}
          />
        </div>
      </div>
    );
  }

  renderExpressionEmoji(key: string, display: string | React.ReactNode, hasExpressed: boolean, onLoggedInClick: ((currentTarget: HTMLElement) => void) | undefined = undefined, count: number = 0) {
    return (
      <Chip
        clickable={!!onLoggedInClick}
        key={key}
        variant='outlined'
        color={hasExpressed ? 'primary' : 'default'}
        onClick={onLoggedInClick ? e => {
          const currentTarget = e.currentTarget;
          if (this.props.loggedInUser) {
            onLoggedInClick && onLoggedInClick(currentTarget);
          } else {
            this.onLoggedIn = () => onLoggedInClick && onLoggedInClick(currentTarget);
            this.setState({ logInOpen: true });
          }
        } : undefined}
        classes={{
          label: this.props.classes.expressionInner,
          root: `${this.props.classes.expressionOuter} ${hasExpressed ? this.props.classes.expressionHasExpressed : this.props.classes.expressionNotExpressed}`,
        }}
        label={(
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className={this.props.classes.expression}>{display}</span>
            {count > 0 && (<Typography variant='caption' color={hasExpressed ? 'primary' : undefined}>&nbsp;{count}</Typography>)}
          </div>
        )}
      />
    );
  }

  expressExpand(callback?: () => void) {
    this.setState({
      expressionExpanded: true,
    }, callback);
  }

  expressBarRef: React.RefObject<HTMLDivElement> = React.createRef();
  renderExpression(variant: PostVariant) {
    if (variant !== 'page' && this.props.display && this.props.display.showExpression === false
      || !this.props.idea
      || !this.props.category
      || !this.props.category.support.express) return null;
    const expressionAllowed: boolean = !this.props.idea.statusId
      || this.props.category.workflow.statuses.find(s => s.statusId === this.props.idea!.statusId)?.disableExpressions !== true;
    if (!expressionAllowed
      && (!this.props.idea.expressions || Object.keys(this.props.idea.expressions).length === 0)
      && !this.props.idea.expressionsValue) return null;

    const limitEmojiPerIdea = this.props.category.support.express.limitEmojiPerIdea;
    const reachedLimitPerIdea = limitEmojiPerIdea && (!!this.props.expression && Object.keys(this.props.expression).length || 0) > 0;

    const getHasExpressed = (display: string): boolean => {
      return this.props.expression
        && this.props.expression.includes(display)
        || false;
    };
    const clickExpression = (display: string) => {
      if (!expressionAllowed) return;
      var expressionDiff: Client.IdeaVoteUpdateExpressions | undefined = undefined;
      const hasExpressed = getHasExpressed(display);
      if (limitEmojiPerIdea) {
        if (hasExpressed) {
          expressionDiff = { action: Client.IdeaVoteUpdateExpressionsActionEnum.Unset, expression: display };
        } else {
          expressionDiff = { action: Client.IdeaVoteUpdateExpressionsActionEnum.Set, expression: display };
        }
      } else if (!hasExpressed && reachedLimitPerIdea) {
        this.props.enqueueSnackbar("Whoa, that's too many", { variant: 'warning', preventDuplicate: true });
        return;
      } else if (hasExpressed) {
        expressionDiff = { action: Client.IdeaVoteUpdateExpressionsActionEnum.Remove, expression: display };
      } else {
        expressionDiff = { action: Client.IdeaVoteUpdateExpressionsActionEnum.Add, expression: display };
      }
      this.props.updateVote({ expressions: expressionDiff });
      if (this.state.expressionExpanded
        && !!this.props.category?.support.express?.limitEmojiPerIdea) {
        this.setState({ expressionExpanded: false });
      }
    };

    const limitEmojiSet = this.props.category.support.express.limitEmojiSet
      ? new Set<string>(this.props.category.support.express.limitEmojiSet.map(e => e.display))
      : undefined;
    const unusedEmoji = new Set<string>(limitEmojiSet || []);
    const expressionsExpressed: React.ReactNode[] = [];
    this.props.idea.expressions && Object.entries(this.props.idea.expressions).forEach(([expression, count]) => {
      if (limitEmojiSet) {
        if (!limitEmojiSet.has(expression)) {
          return; // expression not in the list of approved expressions
        }
        unusedEmoji.delete(expression)
      };
      expressionsExpressed.push(this.renderExpressionEmoji(
        expression,
        expression,
        getHasExpressed(expression),
        expressionAllowed ? () => clickExpression(expression) : undefined,
        count));
    });
    const expressionsUnused: React.ReactNode[] = [...unusedEmoji].map(expressionDisplay =>
      this.renderExpressionEmoji(
        expressionDisplay,
        expressionDisplay,
        getHasExpressed(expressionDisplay),
        expressionAllowed ? () => clickExpression(expressionDisplay) : undefined,
        0));
    const picker = limitEmojiSet ? undefined : (
      <EmojiPicker
        key='picker'
        inline
        onSelect={emoji => clickExpression(((emoji as BaseEmoji).native) as never)}
      />
    );

    const maxItems = 3;
    const summaryItems: React.ReactNode[] = expressionsExpressed.length > 0 ? expressionsExpressed.slice(0, Math.min(maxItems, expressionsExpressed.length)) : [];

    const showMoreButton: boolean = !limitEmojiSet || summaryItems.length !== expressionsExpressed.length + expressionsUnused.length;

    return (
      <div key='renderExpression' style={{ display: 'flex' }}>
        <ClosablePopper
          clickAway
          style={{
            width: limitEmojiSet ? 'max-content' : 'min-content',
          }}
          open={!!this.state.expressionExpanded}
          onClose={() => this.setState({ expressionExpanded: false })}
        >
          <div className={classNames(this.props.classes.expressionPopperPaper, this.props.classes.funding)}>
            {[
              ...expressionsExpressed,
              ...expressionsUnused,
            ]}
          </div>
          {picker}
        </ClosablePopper>
        <div
          key='expression'
          ref={this.expressBarRef}
          className={classNames(
            this.props.classes.funding,
            !!this.props.settings.demoFlashPostVotingControls && (this.state.demoFlashPostVotingControlsHovering === undefined ? this.props.classes.pulsateExpressions
              : (this.state.demoFlashPostVotingControlsHovering === 'express' ? this.props.classes.pulsateShown : this.props.classes.pulsateHidden)))}
          onMouseOver={!!this.props.settings.demoFlashPostVotingControls ? () => this.setState({ demoFlashPostVotingControlsHovering: 'express' }) : undefined}
          onMouseOut={!!this.props.settings.demoFlashPostVotingControls ? () => this.setState({ demoFlashPostVotingControlsHovering: undefined }) : undefined}
          style={{
            position: 'relative',
          }}
        >
          <GradientFade
            disabled={summaryItems.length < maxItems}
            start={'50%'}
            opacity={0.3}
            style={{
              display: 'flex',
            }}
          >
            {summaryItems}
          </GradientFade>
          {expressionAllowed && showMoreButton && this.renderExpressionEmoji(
            'showMoreButton',
            (
              <span className={this.props.classes.moreContainer}>
                <AddEmojiIcon fontSize='inherit' className={this.props.classes.moreMainIcon} />
                <AddIcon fontSize='inherit' className={this.props.classes.moreAddIcon} />
              </span>
            ),
            false,
            () => this.expressExpand(),
          )}
        </div>
      </div>
    );
  }

  renderTitle(variant: PostVariant) {
    if (!this.props.idea
      || !this.props.idea.title) return null;
    return (
      <Typography variant='h5' component='h1' className={`${this.props.classes.title} ${variant === 'page' ? this.props.classes.titlePage : ((this.props.display?.descriptionTruncateLines || 0) <= 0 ? this.props.classes.titleListWithoutDescription : this.props.classes.titleList)} ${this.props.settings.demoBlurryShadow ? this.props.classes.blurry : ''}`}>
        {variant !== 'page' && this.props.display && this.props.display.titleTruncateLines !== undefined && this.props.display.titleTruncateLines > 0
          ? (<TruncateEllipsis ellipsis='…' lines={this.props.display.titleTruncateLines}><div>{this.props.idea.title}</div></TruncateEllipsis>)
          : this.props.idea.title}
      </Typography>
    );
  }

  renderDescription(variant: PostVariant) {
    if (variant !== 'page' && this.props.display && this.props.display.descriptionTruncateLines !== undefined && this.props.display.descriptionTruncateLines <= 0
      || !this.props.idea
      || !this.props.idea.description) return null;
    return (
      <Typography variant='body1' component={'span'} className={`${this.props.classes.description} ${variant === 'page' ? this.props.classes.descriptionPage : this.props.classes.descriptionList} ${this.props.settings.demoBlurryShadow ? this.props.classes.blurry : ''}`}>
        {variant !== 'page' && this.props.display && this.props.display.descriptionTruncateLines !== undefined && this.props.display.descriptionTruncateLines > 0
          ? (<TruncateFade variant='body1' lines={this.props.display.descriptionTruncateLines}>
            <div><RichViewer key={this.props.idea.description} iAgreeInputIsSanitized html={this.props.idea.description} toneDownHeadings={variant === 'list'} /></div>
          </TruncateFade>)
          : <RichViewer key={this.props.idea.description} iAgreeInputIsSanitized html={this.props.idea.description} toneDownHeadings={variant === 'list'} />}
      </Typography>
    );
  }

  renderResponse(variant: PostVariant) {
    if (variant !== 'page' && this.props.display && this.props.display.responseTruncateLines !== undefined && this.props.display.responseTruncateLines <= 0
      || !this.props.idea
      || !this.props.idea.response) return null;
    return (
      <div className={this.props.classes.responseContainer}>
        <Typography variant='caption' component={'span'} className={this.props.classes.responsePrefixText}>
          {this.props.idea.responseAuthorUserId && this.props.idea.responseAuthorName ? (
            <React.Fragment>
              {variant === 'list' ? (
                <ModStar name={this.props.idea.responseAuthorName} isMod />
              ) : (
                <UserDisplay
                  onClick={this.props.onUserClick}
                  user={{
                    userId: this.props.idea.responseAuthorUserId,
                    name: this.props.idea.responseAuthorName,
                    isMod: true
                  }}
                />
              )}
              :&nbsp;&nbsp;
            </React.Fragment>
          ) : (
            <React.Fragment>Admin reply:&nbsp;&nbsp;</React.Fragment>
          )}
        </Typography>
        <Typography variant='body1' component={'span'} className={`${this.props.classes.response} ${variant === 'page' ? this.props.classes.responsePage : this.props.classes.responseList} ${this.props.settings.demoBlurryShadow ? this.props.classes.blurry : ''}`}>
          {variant !== 'page' && this.props.display && this.props.display.responseTruncateLines !== undefined && this.props.display.responseTruncateLines > 0
            ? (<TruncateFade variant='body1' lines={this.props.display.responseTruncateLines}>
              <div><RichViewer key={this.props.idea.response} iAgreeInputIsSanitized html={this.props.idea.response} toneDownHeadings={variant === 'list'} /></div>
            </TruncateFade>)
            : <RichViewer key={this.props.idea.response} iAgreeInputIsSanitized html={this.props.idea.response} toneDownHeadings={variant === 'list'} />}
        </Typography>
      </div>
    );
  }

  renderTitleAndDescription(variant: PostVariant, children: React.ReactNode) {
    if (variant === 'page'
      || !this.props.expandable
      || !!this.props.onClickPost
      || !this.props.idea
      || !!this.props.settings.demoDisablePostOpen) return (
        <div
          className={classNames(this.props.classes.titleAndDescription, this.props.onClickPost && this.props.classes.expandable)}
          onClick={this.props.onClickPost ? () => this.props.onClickPost && this.props.idea
            && this.props.onClickPost(this.props.idea.ideaId) : undefined}
        >
          {children}
        </div>
      );

    return (
      <Link
        className={classNames(this.props.classes.titleAndDescription, this.props.classes.expandable)}
        to={preserveEmbed(`/post/${this.props.idea.ideaId}`, this.props.location)}
      >
        {children}
      </Link>
    );
  }

  async demoFundingAnimate(fundAmount: number) {
    const animate = animateWrapper(
      () => this._isMounted,
      this.inViewObserverRef,
      () => this.props.settings,
      this.setState.bind(this));

    if (await animate({ sleepInMs: 1000 })) return;
    const ideaId = this.props.idea!.ideaId;
    const ideaWithVote: Client.IdeaWithVote = {
      ...this.props.idea!,
      vote: {
        vote: this.props.server.getStore().getState().votes.votesByIdeaId[ideaId],
        expression: this.props.server.getStore().getState().votes.expressionByIdeaId[ideaId],
        fundAmount: this.props.server.getStore().getState().votes.fundAmountByIdeaId[ideaId],
      },
    }
    const initialFundAmount = ideaWithVote.funded || 0;
    const targetFundAmount = initialFundAmount + fundAmount;
    var currFundAmount = initialFundAmount;
    var stepFundAmount = (fundAmount >= 0 ? 1 : -1);

    for (; ;) {
      if (await animate({ sleepInMs: 150 })) return;
      if (currFundAmount + stepFundAmount < Math.min(initialFundAmount, targetFundAmount)
        || currFundAmount + stepFundAmount > Math.max(initialFundAmount, targetFundAmount)) {
        stepFundAmount = -stepFundAmount;
        continue;
      }
      currFundAmount = currFundAmount + stepFundAmount;
      const msg: Client.ideaGetActionFulfilled = {
        type: Client.ideaGetActionStatus.Fulfilled,
        meta: {
          action: Client.Action.ideaGet,
          request: {
            projectId: this.props.projectId,
            ideaId: ideaId,
          },
        },
        payload: {
          ...ideaWithVote,
          funded: currFundAmount,
        },
      };
      // Private API just for this animation
      Server._dispatch(msg, this.props.server.store);
    }
  }

  async demoFundingControlAnimate(changes: Array<{ index: number; fundDiff: number; }>) {
    const animate = animateWrapper(
      () => this._isMounted,
      this.inViewObserverRef,
      () => this.props.settings,
      this.setState.bind(this));

    if (await animate({ sleepInMs: 1000 })) return;
    var isReverse = false;

    for (; ;) {
      if (await animate({ sleepInMs: 500 })) return;
      await new Promise<void>(resolve => this.fundingExpand(resolve));

      if (!this.fundingControlRef.current) return;
      await this.fundingControlRef.current.demoFundingControlAnimate(changes, isReverse);

      if (await animate({ setState: { fundingExpanded: false } })) return;

      isReverse = !isReverse;
    }
  }

  async demoVotingExpressionsAnimate(changes: Array<{
    type: 'vote';
    upvote: boolean;
  } | {
    type: 'express';
    update: Client.IdeaVoteUpdateExpressions;
  }>) {
    const animate = animateWrapper(
      () => this._isMounted,
      this.inViewObserverRef,
      () => this.props.settings,
      this.setState.bind(this));

    if (await animate({ sleepInMs: 500 })) return;
    for (; ;) {
      for (const change of changes) {
        if (await animate({ sleepInMs: 1000 })) return;
        switch (change.type) {
          case 'vote':
            if (change.upvote) {
              this.upvote();
            } else {
              this.downvote();
            }
            break;
          case 'express':
            await new Promise<void>(resolve => this.expressExpand(resolve));

            if (await animate({ sleepInMs: 1000 })) return;

            await this.props.updateVote({ expressions: change.update });

            if (await animate({ sleepInMs: 1000, setState: { expressionExpanded: false } })) return;

            break;
        }
      }
    }
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props): ConnectProps => {
  var vote: Client.VoteOption | undefined;
  var expression: Array<string> | undefined;
  var fundAmount: number | undefined;
  var callOnMount;
  if (ownProps.idea) {
    const voteStatus = state.votes.statusByIdeaId[ownProps.idea.ideaId];
    if (voteStatus === undefined) {
      // Don't refresh votes if inside a panel which will refresh votes for us
      if (ownProps.variant === 'page'
        && state.users.loggedIn.status === Status.FULFILLED
        && state.users.loggedIn.user) {
        callOnMount = () => {
          ownProps.server.dispatch().then(d => d.ideaVoteGetOwn({
            projectId: state.projectId!,
            ideaIds: [ownProps.idea!.ideaId],
            myOwnIdeaIds: ownProps.idea!.authorUserId === state.users.loggedIn.user?.userId
              ? [ownProps.idea!.ideaId] : [],
          }));
        };
      }
    } else {
      vote = state.votes.votesByIdeaId[ownProps.idea.ideaId];
      expression = state.votes.expressionByIdeaId[ownProps.idea.ideaId];
      fundAmount = state.votes.fundAmountByIdeaId[ownProps.idea.ideaId];
    }
  }
  return {
    callOnMount,
    configver: state.conf.ver, // force rerender on config change
    projectId: state.projectId!,
    settings: state.settings,
    vote,
    expression,
    fundAmount,
    category: (ownProps.idea && state.conf.conf)
      ? state.conf.conf.content.categories.find(c => c.categoryId === ownProps.idea!.categoryId)
      : undefined,
    credits: state.conf.conf?.users.credits,
    maxFundAmountSeen: state.ideas.maxFundAmountSeen,
    loggedInUser: state.users.loggedIn.user,
    updateVote: (ideaVoteUpdate: Client.IdeaVoteUpdate): Promise<Client.IdeaVoteUpdateResponse> => ownProps.server.dispatch().then(d => d.ideaVoteUpdate({
      projectId: state.projectId!,
      ideaId: ownProps.idea!.ideaId,
      ideaVoteUpdate,
    })),
  };
})(withStyles(styles, { withTheme: true })(withRouter(withSnackbar(Post))));

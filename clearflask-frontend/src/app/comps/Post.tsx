import loadable from '@loadable/component';
import { Button, Chip, Typography } from '@material-ui/core';
import { createStyles, makeStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { fade } from '@material-ui/core/styles/colorManipulator';
import AddIcon from '@material-ui/icons/Add';
import DownvoteIcon from '@material-ui/icons/ArrowDownwardRounded';
import UpvoteIcon from '@material-ui/icons/ArrowUpwardRounded';
/* alternatives: comment, chat bubble (outline), forum, mode comment, add comment */
import SpeechIcon from '@material-ui/icons/ChatBubbleOutlineRounded';
import EditIcon from '@material-ui/icons/Edit';
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
import HelpPopper from '../../common/HelpPopper';
import LinkAltIcon from '../../common/icon/LinkAltIcon';
import PinIcon from '../../common/icon/PinIcon';
import InViewObserver from '../../common/InViewObserver';
import RichViewer from '../../common/RichViewer';
import TruncateFade from '../../common/TruncateFade';
import UserWithAvatarDisplay from '../../common/UserWithAvatarDisplay';
import { notEmpty } from '../../common/util/arrayUtil';
import { preserveEmbed } from '../../common/util/historyUtil';
import { customShouldComponentUpdate } from '../../common/util/reactUtil';
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
import MyButton from './MyButton';
import PostAsLink from './PostAsLink';
import PostEdit from './PostEdit';
import VotingControl from './VotingControl';

const EmojiPicker = loadable(() => import(/* webpackChunkName: "EmojiPicker", webpackPrefetch: true */'../../common/EmojiPicker').then(importSuccess).catch(importFailed), { fallback: (<Loading />), ssr: false });

export type PostVariant = 'list' | 'page' | 'dashboard';
export const MinContentWidth = 300;
export const MaxContentWidth = 600;

const styles = (theme: Theme) => createStyles({
  comment: {
    margin: theme.spacing(1),
  },
  post: {
    display: 'flex',
    flexDirection: 'column',
    margin: theme.spacing(0.5),
  },
  postContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  postFunding: {
  },
  postContentBeforeComments: {
    paddingTop: theme.spacing(4),
  },
  postComments: {
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
    display: 'flex',
    flexDirection: 'column',
    textTransform: 'none',
  },
  clickable: {
    cursor: 'pointer',
    textDecoration: 'none',
  },
  description: {
    // marginTop: theme.spacing(1),
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
  linkedPosts: {
    marginTop: theme.spacing(2),
  },
  responseHeader: {
    display: 'flex',
    alignItems: 'baseline',
  },
  responseContainerList: {
    marginTop: theme.spacing(2),
    paddingLeft: theme.spacing(3),
  },
  responseContainerPage: {
    marginTop: theme.spacing(6),
  },
  responseContainer: {
    display: 'flex',
    flexDirection: 'column',
  },
  pinIcon: {
    color: theme.palette.text.hint,
    fontSize: '1.4em',
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
  button: {
    padding: `3px ${theme.spacing(0.5)}px`,
    whiteSpace: 'nowrap',
    minWidth: 'unset',
    textTransform: 'unset',
  },
  timeAgo: {
    color: theme.palette.text.hint,
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
  expressionEmojiAsIcon: {
    filter: 'grayscale(100%)',
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
    outline: '1px solid ' + theme.palette.divider,
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
    alignItems: 'center',
  },
  headerBarLine: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  grow: {
    flexGrow: 1,
  },
  commentSection: {
    marginTop: theme.spacing(6),
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
  properties: {
    display: 'flex',
    flexDirection: 'column',
  },
  blurry: {
    ...(cssBlurry as any), // have to cast, doesnt play nice with makeStyles. Im sure there is a right type for this, but i didnt find it, well I could find it, i just dont have time. I do have time, but its not as important. Okay its not important. Thats it.
  }
});
const useStyles = makeStyles(styles);
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
  disableOnClick?: boolean;
  display?: Client.PostDisplay;
  widthExpand?: boolean;
  contentBeforeComments?: React.ReactNode;
  isLink?: boolean;
  onClickTag?: (tagId: string) => void;
  onClickCategory?: (categoryId: string) => void;
  onClickStatus?: (statusId: string) => void;
  onClickPost?: (postId: string) => void;
  onUserClick?: (userId: string) => void;
}
interface ConnectProps {
  configver?: string;
  projectId: string;
  settings: StateSettings;
  category?: Client.Category;
  credits?: Client.Credits;
  maxFundAmountSeen: number;
  voteStatus?: Status;
  vote?: Client.VoteOption;
  expression?: Array<string>;
  fundAmount?: number;
  loggedInUser?: Client.User;
  linkedPosts?: Array<Client.Idea>;
  fetchPostIds?: Array<string>;
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
  iWantThisCommentExpanded?: boolean;
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

    // Refresh votes from server if missing
    if (props.idea
      && props.voteStatus === undefined
      // Don't refresh votes if inside a panel which will refresh votes for us
      && props.variant === 'page'
      && props.loggedInUser) {
      props.server.dispatch().then(d => d.ideaVoteGetOwn({
        projectId: props.projectId,
        ideaIds: [props.idea!.ideaId],
        myOwnIdeaIds: props.idea!.authorUserId === props.loggedInUser!.userId
          ? [props.idea!.ideaId] : [],
      }));
    }

    if (props.fetchPostIds?.length) {
      props.server.dispatch({ ssr: true }).then(d => d.ideaGetAll({
        projectId: props.projectId,
        ideaGetAll: {
          postIds: props.fetchPostIds!,
        },
      }));
    }
  }

  shouldComponentUpdate = customShouldComponentUpdate({
    nested: new Set(['display', 'linkedPosts']),
    ignored: new Set(['fetchPostIds']),
  });

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

    const isOnlyPostOnClick = (this.props.onClickPost && !this.props.onClickTag && !this.props.onClickCategory && !this.props.onClickStatus && !this.props.onUserClick);
    return (
      <Loader skipFade className={classNames(this.props.className)} loaded={!!this.props.idea}>
        <InViewObserver ref={this.inViewObserverRef}>
          <div
            className={classNames(
              this.props.classes.post,
              (isOnlyPostOnClick && !this.props.disableOnClick) && this.props.classes.clickable,
            )}
            style={{
              minWidth: MinContentWidth,
              width: this.props.widthExpand ? MaxContentWidth : (this.props.variant !== 'list' ? 'max-content' : MinContentWidth),
              maxWidth: this.props.widthExpand ? '100%' : MaxContentWidth,
            }}
            onClick={(isOnlyPostOnClick && !this.props.disableOnClick) ? () => this.props.onClickPost && this.props.idea && this.props.onClickPost(this.props.idea.ideaId) : undefined}
          >
            <div className={this.props.classes.postFunding}>
              {this.renderFunding()}
            </div>
            <div className={this.props.classes.postContent}>
              {this.renderTitleAndDescription((
                <>
                  {this.renderHeader()}
                  {this.renderTitle()}
                  {this.renderDescription()}
                </>
              ))}
              {this.renderBottomBar()}
              {this.renderIWantThisCommentAdd()}
              {this.renderResponse()}
              {this.renderLinks()}
            </div>
            {this.props.contentBeforeComments && (
              <div className={this.props.classes.postContentBeforeComments}>
                {this.props.contentBeforeComments}
              </div>
            )}
          </div>
          <div className={this.props.classes.postComments}>
            {this.renderComments()}
          </div>
          <LogIn
            actionTitle='Get notified of updates'
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

  renderBottomBar() {
    var leftSide: React.ReactNode[] | undefined;
    var rightSide: React.ReactNode[] | undefined;

    if (this.props.variant !== 'list') {
      leftSide = [
        this.renderVoting(),
        this.renderExpression(),
      ].filter(notEmpty);

      rightSide = [
        this.renderCommentAdd(),
        this.renderEdit(),
      ].filter(notEmpty);
    } else {
      leftSide = [
        this.renderVoting() || this.renderVotingCount(),
        this.renderExpressionCount(),
        this.renderCommentCount(),
      ].filter(notEmpty);

      rightSide = [
        this.renderStatus(),
        ...(this.renderTags() || []),
        this.renderCategory(),
      ].filter(notEmpty);
    }

    if ((leftSide?.length || 0) + (rightSide?.length || 0) === 0) return null;

    return (
      <div className={this.props.classes.bottomBarLine}>
        <div className={this.props.classes.bottomBarLine}>
          <Delimited delimiter={(<>&nbsp;&nbsp;&nbsp;</>)}>
            {leftSide}
          </Delimited>
        </div>
        <div className={this.props.classes.grow} />
        <div className={this.props.classes.bottomBarLine}>
          <Delimited delimiter={(<>&nbsp;&nbsp;&nbsp;</>)}>
            {rightSide}
          </Delimited>
        </div>
      </div>
    );
  }

  renderHeader() {
    var header: React.ReactNode[] | undefined;

    if (this.props.variant !== 'list') {
      header = [
        this.renderIsLink(),
        this.renderAuthor(),
        this.renderCreatedDatetime(),
        this.renderStatus(),
        ...(this.renderTags() || []),
        this.renderCategory(),
      ].filter(notEmpty);
    } else {
      header = [
        this.renderIsLink(),
        this.renderAuthor(),
        this.renderCreatedDatetime(),
      ].filter(notEmpty);
    }

    if (!header.length) return null;

    return (
      <div className={this.props.classes.headerBarLine}>
        <Delimited delimiter=' '>
          {header}
        </Delimited>
      </div>
    );
  }

  renderAuthor() {
    if (this.props.variant === 'dashboard'
      || this.props.variant === 'list' && this.props.display && this.props.display.showAuthor === false
      || !this.props.idea) return null;

    return (
      <Typography key='author' className={this.props.classes.author} variant='caption'>
        <UserWithAvatarDisplay
          onClick={this.props.disableOnClick ? this.props.onUserClick : undefined}
          user={{
            userId: this.props.idea.authorUserId,
            name: this.props.idea.authorName,
            isMod: this.props.idea.authorIsMod
          }}
          baseline
        />
      </Typography>
    );
  }

  renderCreatedDatetime() {
    if (this.props.variant === 'dashboard'
      || this.props.variant === 'list' && this.props.display && this.props.display.showCreated === false
      || !this.props.idea) return null;

    return (
      <Typography key='createdDatetime' className={this.props.classes.timeAgo} variant='caption'>
        <TimeAgo date={this.props.idea.created} />
      </Typography>
    );
  }

  renderCommentCount() {
    if (this.props.variant === 'dashboard'
      || this.props.display?.showCommentCount === false
      || this.props.variant !== 'list'
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

  renderCommentAdd() {
    if (this.props.variant === 'list'
      || !this.props.idea
      || !this.props.category
      || !this.props.category.support.comment) return null;
    const commentsAllowed: boolean = !this.props.idea.statusId
      || this.props.category.workflow.statuses.find(s => s.statusId === this.props.idea!.statusId)?.disableComments !== true;
    if (!commentsAllowed) return null;

    return (
      <MyButton
        key='addComment'
        buttonVariant='post'
        Icon={SpeechIcon}
        disabled={!!this.state.commentExpanded}
        onClick={e => this.setState({ commentExpanded: true })}
      >
        Comment
      </MyButton>
    );
  }

  renderIWantThisCommentAdd() {
    if (!this.props.category?.support.vote?.iWantThis
      || !this.props.idea
      || !this.shouldRenderVoting()
      || !this.areCommentsAllowed()
    ) return null;

    return (
      <CommentReply
        server={this.props.server}
        ideaId={this.props.idea.ideaId}
        collapseIn={!!this.state.iWantThisCommentExpanded}
        focusOnIn
        logIn={this.logIn.bind(this)}
        inputLabel={this.props.category.support.vote.iWantThis.encourageLabel || 'Tell us why'}
        onSubmitted={() => this.setState({ iWantThisCommentExpanded: undefined })}
        onBlurAndEmpty={() => this.setState({ iWantThisCommentExpanded: undefined })}
      />
    );
  }

  areCommentsAllowed() {
    return !this.props.idea?.statusId
      || this.props.category?.workflow.statuses.find(s => s.statusId === this.props.idea!.statusId)?.disableComments !== true;
  }

  logIn() {
    if (this.props.loggedInUser) {
      return Promise.resolve();
    } else {
      return new Promise<void>(resolve => {
        this.onLoggedIn = resolve
        this.setState({ logInOpen: true });
      });
    }
  }

  renderComments() {
    if (this.props.variant === 'list'
      || !this.props.idea
      || !this.props.category
      || !this.props.category.support.comment) return null;

    const commentsAllowed: boolean = this.areCommentsAllowed();

    return (
      <div key='comments' className={this.props.classes.commentSection}>
        {commentsAllowed && (
          <CommentReply
            server={this.props.server}
            ideaId={this.props.idea.ideaId}
            collapseIn={!!this.state.commentExpanded}
            focusOnIn
            logIn={this.logIn.bind(this)}
            onSubmitted={() => this.setState({ commentExpanded: undefined })}
            onBlurAndEmpty={() => this.setState({ commentExpanded: undefined })}
          />
        )}
        {(this.props.idea.commentCount || this.props.idea.mergedPostIds?.length) && (
          <CommentList
            server={this.props.server}
            logIn={this.logIn.bind(this)}
            ideaId={this.props.idea.ideaId}
            expectedCommentCount={this.props.idea.childCommentCount + (this.props.idea.mergedPostIds?.length || 0)}
            parentCommentId={undefined}
            newCommentsAllowed={commentsAllowed}
            loggedInUser={this.props.loggedInUser}
            disableOnClick={this.props.disableOnClick}
            onAuthorClick={(this.props.onUserClick && !this.props.disableOnClick) ? (commentId, userId) => this.props.onUserClick && this.props.onUserClick(userId) : undefined}
          />
        )}
      </div>
    );
  }

  renderEdit() {
    const isMod = this.props.server.isModOrAdminLoggedIn();
    const isAuthor = this.props.idea && this.props.loggedInUser && this.props.idea.authorUserId === this.props.loggedInUser.userId;
    if (!this.props.idea
      || !this.props.category
      || (!isMod && !isAuthor)
      || this.props.display?.showEdit === false) return null;

    return (
      <React.Fragment key='edit'>
        <MyButton
          buttonVariant='post'
          Icon={EditIcon}
          onClick={e => this.setState({ editExpanded: !this.state.editExpanded })}
        >
          Edit
        </MyButton>
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

  renderStatus() {
    if (this.props.variant === 'dashboard'
      || this.props.variant === 'list' && this.props.display && this.props.display.showStatus === false
      || !this.props.idea
      || !this.props.idea.statusId
      || !this.props.category) return null;

    const status = this.props.category.workflow.statuses.find(s => s.statusId === this.props.idea!.statusId);
    if (!status) return null;

    return (
      <>
        &nbsp;
        <Button key='status' variant='text' className={this.props.classes.button} disabled={!this.props.onClickStatus || this.props.disableOnClick || this.props.variant !== 'list'}
          onClick={e => this.props.onClickStatus && !this.props.disableOnClick && this.props.onClickStatus(status.statusId)}>
          <Typography variant='caption' style={{ color: status.color }}>
            {status.name}
          </Typography>
        </Button>
      </>
    );
  }

  renderTags() {
    if (this.props.variant === 'list' && this.props.display && this.props.display.showTags === false
      || !this.props.idea
      || this.props.idea.tagIds.length === 0
      || !this.props.category) return null;

    return this.props.idea.tagIds
      .map(tagId => this.props.category!.tagging.tags.find(t => t.tagId === tagId))
      .filter(tag => !!tag)
      .map(tag => (
        <Button key={'tag' + tag!.tagId} variant="text" className={this.props.classes.button} disabled={!this.props.onClickTag || this.props.disableOnClick || this.props.variant !== 'list'}
          onClick={e => this.props.onClickTag && !this.props.disableOnClick && this.props.onClickTag(tag!.tagId)}>
          <Typography variant='caption' style={{ color: tag!.color }}>
            {tag!.name}
          </Typography>
        </Button>
      ));
  }

  renderCategory() {
    // Don't show unlesss explictly asked for
    if (this.props.display?.showCategoryName !== true
      || !this.props.idea
      || !this.props.category) return null;

    return (
      <PostClassification
        title={this.props.category.name}
        color={this.props.category.color}
        onClick={!this.props.onClickCategory || this.props.disableOnClick || this.props.variant !== 'list' ? undefined
          : (() => this.props.onClickCategory && !this.props.disableOnClick && this.props.onClickCategory(this.props.category!.categoryId))}
      />
    );
  }

  renderVotingCount() {
    if ((this.props.variant === 'list' && this.props.display?.showVoting === true)
      || this.props.variant !== 'list'
      || this.props.display?.showVotingCount === false
      || !this.props.idea
      || !this.props.category
      || !this.props.category.support.vote
      || (this.props.display?.showVotingCount === undefined && (this.props.idea.voteValue || 1) === 1)
    ) return null;

    const Icon = (this.props.idea.voteValue || 0) >= 0 ? UpvoteIcon : DownvoteIcon;
    return (
      <Typography className={this.props.classes.commentCount} variant='caption'>
        <Icon fontSize='inherit' />
        &nbsp;
        {Math.abs(this.props.idea.voteValue || 0)}
      </Typography>
    );
  }

  shouldRenderVoting(): boolean {
    return !((this.props.variant === 'list' && this.props.display?.showVoting !== true)
      || !this.props.idea
      || !this.props.category
      || !this.props.category.support.vote
    );
  }
  renderVoting() {
    if (!this.shouldRenderVoting()) return null;
    const votingAllowed: boolean = !this.props.idea?.statusId
      || this.props.category?.workflow.statuses.find(s => s.statusId === this.props.idea!.statusId)?.disableVoting !== true;

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
          voteValue={this.props.idea?.voteValue || 0}
          isSubmittingVote={this.state.isSubmittingVote}
          votingAllowed={votingAllowed}
          onUpvote={() => this.upvote()}
          iWantThis={this.props.category?.support.vote?.iWantThis}
          onDownvote={!this.props.category?.support.vote?.enableDownvotes ? undefined : () => this.downvote()}
        />
      </div>
    );
  }

  upvote() {
    const upvote = () => {
      if (this.state.isSubmittingVote) return;
      if (!!this.props.category?.support.vote?.iWantThis
        && this.props.vote !== Client.VoteOption.Upvote) {
        this.setState({ iWantThisCommentExpanded: true });
      }
      this.setState({ isSubmittingVote: Client.VoteOption.Upvote });
      this.updateVote({
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
    const downvote = () => {
      if (this.state.isSubmittingVote) return;
      if (!!this.props.category?.support.vote?.iWantThis
        && this.props.vote !== Client.VoteOption.Downvote) {
        this.setState({ iWantThisCommentExpanded: true });
      }
      this.setState({ isSubmittingVote: Client.VoteOption.Downvote });
      this.updateVote({
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
  renderFunding() {
    if (this.props.variant === 'dashboard'
      || this.props.variant === 'list' && this.props.display && this.props.display.showFunding === false
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

  renderExpressionCount() {
    if (this.props.variant !== 'list'
      || this.props.display?.showExpression === false
      || !this.props.idea
      || !this.props.category?.support.express
      || (this.props.display?.showExpression === undefined && Object.keys(this.props.idea.expressions || {}).length === 0)
    ) return null;

    const [topEmoji, topEmojiCount] = Object.entries(this.props.idea.expressions || {})
      .reduce((l, r) => l[1] > r[1] ? l : r, ['', 0]);
    return (
      <Typography key='expressionTop' className={this.props.classes.commentCount} variant='caption'>
        {(!!topEmoji && !!topEmojiCount) ? (
          <span className={this.props.classes.expressionEmojiAsIcon}>
            {topEmoji}
          </span>
        ) : (
          <AddEmojiIcon fontSize='inherit' />
        )}
        &nbsp;
        {topEmojiCount || 0}
      </Typography>
    );
  }

  expressBarRef: React.RefObject<HTMLDivElement> = React.createRef();
  renderExpression() {
    if (this.props.variant === 'list'
      || this.props.display?.showExpression === false
      || !this.props.idea
      || !this.props.category?.support.express
    ) return null;
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
      this.updateVote({ expressions: expressionDiff });
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

    const maxItems = 30;
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

  renderTitle() {
    if (!this.props.idea) return null;
    return (
      <PostTitle
        variant={this.props.variant}
        title={this.props.idea.title}
        titleTruncateLines={this.props.display?.titleTruncateLines}
        descriptionTruncateLines={this.props.display?.descriptionTruncateLines}
        demoBlurryShadow={this.props.settings.demoBlurryShadow}
      />
    );
  }

  renderDescription() {
    if (!this.props.idea) return null;
    return (
      <PostDescription
        variant={this.props.variant}
        description={this.props.idea.description}
        descriptionTruncateLines={this.props.display?.descriptionTruncateLines}
        demoBlurryShadow={this.props.settings.demoBlurryShadow}
      />
    );
  }

  renderIsLink() {
    if (!this.props.isLink) return null;

    return (
      <HelpPopper description='Links to this post'>
        <LinkAltIcon color='inherit' fontSize='inherit' className={this.props.classes.pinIcon} />
      </HelpPopper>
    );
  }

  renderLinks() {
    if (this.props.variant === 'list'
      || !this.props.linkedPosts?.length) return null;

    return (
      <div className={this.props.classes.linkedPosts}>
        {this.props.linkedPosts.map(post => (
          <PostAsLink
            key={post.ideaId}
            server={this.props.server}
            post={post}
            onClickPost={this.props.onClickPost}
            onUserClick={this.props.onUserClick}
          />
        ))}
      </div>
    );
  }

  renderResponse() {
    if (this.props.variant === 'list' && this.props.display && this.props.display.responseTruncateLines !== undefined && this.props.display.responseTruncateLines <= 0
      || !this.props.idea
      || !this.props.idea.response) return null;
    const responseRichViewer = (
      <RichViewer
        key={this.props.idea.response}
        iAgreeInputIsSanitized
        html={this.props.idea.response}
        toneDownHeadings={this.props.variant === 'list'}
      />
    );
    return (
      <div className={classNames(
        this.props.classes.responseContainer,
        this.props.variant === 'list' ? this.props.classes.responseContainerList : this.props.classes.responseContainerPage,
      )}>
        <div className={this.props.classes.responseHeader}>
          {this.props.variant !== 'list' && (
            <HelpPopper description='Admin response'>
              <PinIcon alt='Admin response' color='inherit' fontSize='inherit' className={this.props.classes.pinIcon} />
            </HelpPopper>
          )}
          <UserWithAvatarDisplay
            onClick={this.props.onUserClick}
            user={(this.props.idea.responseAuthorUserId && this.props.idea.responseAuthorName) ? {
              userId: this.props.idea.responseAuthorUserId,
              name: this.props.idea.responseAuthorName,
              isMod: true
            } : undefined}
            baseline
          />
        </div>
        <Typography variant='body1' component={'span'} className={`${this.props.classes.response} ${this.props.variant !== 'list' ? this.props.classes.responsePage : this.props.classes.responseList} ${this.props.settings.demoBlurryShadow ? this.props.classes.blurry : ''}`}>
          {this.props.variant === 'list'
            ? (<TruncateFade variant='body1' lines={this.props.display?.responseTruncateLines}>
              <div>{responseRichViewer}</div>
            </TruncateFade>)
            : responseRichViewer}
        </Typography>
      </div>
    );
  }

  renderTitleAndDescription(children: React.ReactNode) {
    if (this.props.variant !== 'list'
      || !this.props.expandable
      || !!this.props.onClickPost
      || !!this.props.disableOnClick
      || !this.props.idea
      || !!this.props.settings.demoDisablePostOpen) return (
        <div
          className={classNames(
            this.props.classes.titleAndDescription,
            this.props.onClickPost && !this.props.disableOnClick && this.props.classes.clickable,
          )}
          onClick={(this.props.onClickPost && !this.props.disableOnClick) ? () => this.props.onClickPost && this.props.idea
            && this.props.onClickPost(this.props.idea.ideaId) : undefined}
        >
          {children}
        </div>
      );

    return (
      <Link
        className={classNames(this.props.classes.titleAndDescription, this.props.classes.clickable)}
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

            await this.updateVote({ expressions: change.update });

            if (await animate({ sleepInMs: 1000, setState: { expressionExpanded: false } })) return;

            break;
        }
      }
    }
  }

  async updateVote(ideaVoteUpdate: Client.IdeaVoteUpdate): Promise<Client.IdeaVoteUpdateResponse> {
    const dispatcher = await this.props.server.dispatch();
    const response = await dispatcher.ideaVoteUpdate({
      projectId: this.props.projectId,
      ideaId: this.props.idea!.ideaId,
      ideaVoteUpdate,
    });
    return response;
  }
}

export const PostTitle = (props: {
  variant: PostVariant,
} & Pick<Client.Idea, 'title'>
  & Partial<Pick<Client.PostDisplay, 'titleTruncateLines' | 'descriptionTruncateLines'>>
  & Pick<StateSettings, 'demoBlurryShadow'>
) => {
  const classes = useStyles();
  if (!props.title) return null;
  return (
    <div className={classes.titleContainer}>
      <Typography variant='h5' component='h1' className={classNames(
        classes.title,
        props.variant !== 'list'
          ? classes.titlePage
          : ((props.descriptionTruncateLines !== undefined && props.descriptionTruncateLines <= 0)
            ? classes.titleListWithoutDescription
            : classes.titleList),
        props.demoBlurryShadow ? classes.blurry : '',
      )}>
        {props.variant === 'list'
          ? (<TruncateEllipsis ellipsis='…' lines={props.titleTruncateLines}><div>{props.title}</div></TruncateEllipsis>)
          : props.title}
      </Typography>
    </div>
  );
}

export const PostDescription = (props: {
  variant: PostVariant,
} & Pick<Client.Idea, 'description'>
  & Partial<Pick<Client.PostDisplay, 'descriptionTruncateLines'>>
  & Pick<StateSettings, 'demoBlurryShadow'>
) => {
  const classes = useStyles();
  if (!props.description) return null;
  if (props.variant === 'list' && props.descriptionTruncateLines !== undefined && props.descriptionTruncateLines <= 0) return null;
  const descriptionRichViewer = (
    <RichViewer
      key={props.description}
      iAgreeInputIsSanitized
      html={props.description}
      toneDownHeadings={props.variant === 'list'}
    />
  );
  return (
    <Typography variant='body1' component={'span'} className={classNames(
      classes.description,
      props.variant !== 'list' ? classes.descriptionPage : classes.descriptionList,
      props.demoBlurryShadow ? classes.blurry : '',
    )}>
      {props.variant === 'list'
        ? (<TruncateFade variant='body1' lines={props.descriptionTruncateLines}>
          <div>{descriptionRichViewer}</div>
        </TruncateFade>)
        : descriptionRichViewer}
    </Typography>
  );
}

export const PostClassification = (props: {
  title: string;
  color?: string;
  onClick?: () => void;
} & Pick<Client.Idea, 'description'>
  & Partial<Pick<Client.PostDisplay, 'descriptionTruncateLines'>>
  & Pick<StateSettings, 'demoBlurryShadow'>
) => {
  const classes = useStyles();
  return (
    <Button key='category' variant="text" className={classes.button} disabled={!props.onClick}
      onClick={e => props.onClick?.()}>
      <Typography variant='caption' style={{ color: props.color }}>
        {props.title}
      </Typography>
    </Button>
  );
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props): ConnectProps => {
  var voteStatus: Status | undefined;
  var vote: Client.VoteOption | undefined;
  var expression: Array<string> | undefined;
  var fundAmount: number | undefined;
  if (ownProps.idea) {
    voteStatus = state.votes.statusByIdeaId[ownProps.idea.ideaId];
    if (voteStatus !== undefined) {
      vote = state.votes.votesByIdeaId[ownProps.idea.ideaId];
      expression = state.votes.expressionByIdeaId[ownProps.idea.ideaId];
      fundAmount = state.votes.fundAmountByIdeaId[ownProps.idea.ideaId];
    }
  }
  const fetchPostIds: string[] = [];
  var linkedPosts = ownProps.idea?.linkedPostIds?.map(linkedPostId => {
    const linkedPost = state.ideas.byId[linkedPostId];
    if (!linkedPost) fetchPostIds.push(linkedPostId);
    return linkedPost?.idea;
  }).filter(notEmpty);
  return {
    configver: state.conf.ver, // force rerender on config change
    projectId: state.projectId!,
    settings: state.settings,
    voteStatus,
    vote,
    expression,
    fundAmount,
    category: (ownProps.idea && state.conf.conf)
      ? state.conf.conf.content.categories.find(c => c.categoryId === ownProps.idea!.categoryId)
      : undefined,
    credits: state.conf.conf?.users.credits,
    maxFundAmountSeen: state.ideas.maxFundAmountSeen,
    loggedInUser: state.users.loggedIn.user,
    linkedPosts,
    fetchPostIds,
  };
})(withStyles(styles, { withTheme: true })(withRouter(withSnackbar(Post))));

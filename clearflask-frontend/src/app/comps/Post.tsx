// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import loadable from '@loadable/component';
import { Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Link as MuiLink, Typography } from '@material-ui/core';
import { createStyles, makeStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { fade } from '@material-ui/core/styles/colorManipulator';
import AddIcon from '@material-ui/icons/Add';
import UnmergeIcon from '@material-ui/icons/CallSplit';
/* alternatives: comment, chat bubble (outline), forum, mode comment, add comment */
import SpeechIcon from '@material-ui/icons/ChatBubbleOutlineRounded';
import DeleteIcon from '@material-ui/icons/DeleteOutline';
import RespondIcon from '@material-ui/icons/FeedbackOutlined';
import ImgIcon from '@material-ui/icons/Image';
import AddEmojiIcon from '@material-ui/icons/InsertEmoticon';
import classNames from 'classnames';
import { BaseEmoji } from 'emoji-mart/dist-es/index.js';
import { useSnackbar, withSnackbar, WithSnackbarProps } from 'notistack';
import React, { Component, useRef } from 'react';
import Dropzone from 'react-dropzone';
import { withTranslation, WithTranslation } from 'react-i18next';
import { connect, Provider } from 'react-redux';
import { Link } from 'react-router-dom';
import TimeAgo from 'react-timeago';
import TruncateEllipsis from 'react-truncate-markup';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { cssBlurry, ReduxState, Server, StateSettings, Status } from '../../api/server';
import ClosablePopper from '../../common/ClosablePopper';
import GradientFade from '../../common/GradientFade';
import HelpPopper from '../../common/HelpPopper';
import LinkAltIcon from '../../common/icon/LinkAltIcon';
import PinIcon from '../../common/icon/PinIcon';
import UnLinkAltIcon from '../../common/icon/UnLinkAltIcon';
import InViewObserver from '../../common/InViewObserver';
import RichEditorImageUpload from '../../common/RichEditorImageUpload';
import RichViewer from '../../common/RichViewer';
import SubmitButton from '../../common/SubmitButton';
import TruncateFade from '../../common/TruncateFade';
import UserWithAvatarDisplay from '../../common/UserWithAvatarDisplay';
import { notEmpty } from '../../common/util/arrayUtil';
import { preserveEmbed } from '../../common/util/historyUtil';
import { customShouldComponentUpdate } from '../../common/util/reactUtil';
import { createMutableRef } from '../../common/util/refUtil';
import { ThisOrThat } from '../../common/util/typeUtil';
import { importFailed, importSuccess } from '../../Main';
import { animateWrapper } from '../../site/landing/animateUtil';
import Delimited from '../utils/Delimited';
import Loading from '../utils/Loading';
import CommentList from './CommentList';
import CommentReply from './CommentReply';
import ConnectedPost, { ConnectedPostsContainer, ConnectType, LinkDirection, OutlinePostContent } from './ConnectedPost';
import FundingBar from './FundingBar';
import FundingControl from './FundingControl';
import LogIn from './LogIn';
import MyButton from './MyButton';
import PostConnectDialog from './PostConnectDialog';
import { ClickToEdit, PostEditDescriptionInline, PostEditResponse, PostEditStatus, PostEditTagsInline, PostEditTitleInline, postSave, PostSaveButton } from './PostEdit';
import VotingControl from './VotingControl';

const EmojiPicker = loadable(() => import(/* webpackChunkName: "EmojiPicker", webpackPreload: true */'../../common/EmojiPicker').then(importSuccess).catch(importFailed), { fallback: (<Loading />), ssr: false });

export type PostVariant = 'list' | 'page';
export const MinContentWidth = 300;
export const MaxContentWidth = 600;

const styles = (theme: Theme) => createStyles({
  comment: {
    margin: theme.spacing(1),
  },
  post: {
    display: 'flex',
    flexDirection: 'column',
  },
  postPadding: {
    padding: theme.spacing(0.5),
  },
  postContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  postContentSingleLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postContentSingleLineDivider: {
    flexGrow: 1,
    minWidth: theme.spacing(2),
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
  responseHeader: {
    display: 'flex',
    alignItems: 'baseline',
  },
  responseContainerList: {
    marginTop: theme.spacing(2),
    paddingLeft: theme.spacing(3),
  },
  responseContainerPage: {
    marginTop: theme.spacing(3),
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
  links: {
    marginTop: theme.spacing(3),
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
  itemCount: {
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
  },
  noContentLabel: {
    color: theme.palette.text.hint,
    whiteSpace: 'nowrap',
    fontStyle: 'italic',
  },
  dropzone: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: theme.spacing(1, 0),
    padding: theme.spacing(2),
    width: theme.spacing(30),
    color: theme.palette.text.hint,
    textAlign: 'center',
    borderStyle: 'dashed',
    borderColor: theme.palette.text.hint,
    borderWidth: 2,
    borderRadius: 6,
    outline: 'none',
    transition: theme.transitions.create(['border', 'color']),
    '&:hover': {
      color: theme.palette.text.primary,
      borderColor: theme.palette.text.primary,
    },
  },
  uploadIcon: {
    marginRight: theme.spacing(2),
  },
  coverImg: {
    width: 'auto',
    maxWidth: 'max-content',
  },
});
const useStyles = makeStyles(styles);
type Props = {
  className?: string;
  classNamePadding?: string;
  server: Server;
  idea?: ThisOrThat<Client.Idea, Partial<Admin.IdeaDraftAdmin>>;
  variant: PostVariant;
  expandable?: boolean;
  disableOnClick?: boolean;
  display?: Client.PostDisplay;
  widthExpand?: boolean;
  contentBeforeComments?: React.ReactNode;
  onClickTag?: (tagId: string) => void;
  onClickCategory?: (categoryId: string) => void;
  onClickStatus?: (statusId: string) => void;
  onClickPost?: (postId: string) => void;
  onUserClick?: (userId: string) => void;
  onDeleted?: () => void;
  isSubmittingDisconnect?: boolean;
  onDisconnect?: () => void;
  disconnectType?: ConnectType;
  postContentSingleLine?: boolean;
};
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
  mergedToPost?: Client.Idea;
  linkedToPosts?: Array<Client.Idea>;
  linkedFromPosts?: Array<Client.Idea>;
  fetchPostIds?: Array<string>;
}
interface State {
  currentVariant: PostVariant;
  fundingExpanded?: boolean;
  expressionExpanded?: boolean;
  logInOpen?: boolean;
  deleteDialogOpen?: boolean;
  isSubmittingDelete?: boolean;
  isSubmittingVote?: Client.VoteOption;
  isSubmittingFund?: boolean;
  isSubmittingExpression?: boolean;
  showEditingStatusAndResponse?: false | 'status' | 'response';
  showEditingConnect?: boolean;
  isSubmittingStatusAndResponse?: boolean;
  editingResponse?: string;
  editingStatusId?: string;
  commentExpanded?: boolean;
  iWantThisCommentExpanded?: boolean;
  demoFlashPostVotingControlsHovering?: 'vote' | 'fund' | 'express';
}
class Post extends Component<Props & ConnectProps & WithTranslation<'app'> & WithStyles<typeof styles, true> & WithSnackbarProps, State> {
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
    nested: new Set(['display', 'idea']),
    presence: new Set(['onClickTag', 'onClickCategory', 'onClickStatus', 'onClickPost', 'onUserClick', 'onDisconnect']),
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
      <Loading />
    );

    const isOnlyPostOnClick = (!!this.props.onClickPost && !this.props.onClickTag && !this.props.onClickCategory && !this.props.onClickStatus && !this.props.onUserClick);
    return (
      <div className={classNames(this.props.className)}>
        <InViewObserver ref={this.inViewObserverRef} disabled={
          !this.props.settings.demoFundingControlAnimate && !this.props.settings.demoFundingAnimate && !this.props.settings.demoVotingExpressionsAnimate
        }>
          <div
            className={classNames(
              this.props.classes.post,
              this.props.classNamePadding || this.props.classes.postPadding,
              (isOnlyPostOnClick && !this.props.disableOnClick) && this.props.classes.clickable,
            )}
            style={{
              minWidth: MinContentWidth,
              width: this.props.widthExpand ? MaxContentWidth : (this.props.variant !== 'list' ? MaxContentWidth : MinContentWidth),
              maxWidth: this.props.widthExpand ? '100%' : MaxContentWidth,
            }}
            onClick={(isOnlyPostOnClick && !this.props.disableOnClick) ? () => this.props.onClickPost && !!this.props.idea?.ideaId && this.props.onClickPost(this.props.idea.ideaId) : undefined}
          >
            <div className={this.props.classes.postFunding}>
              {this.renderFunding()}
            </div>
            <div className={classNames(
              this.props.classes.postContent,
              this.props.postContentSingleLine && this.props.classes.postContentSingleLine,
            )}>
              {this.renderTitleAndDescription((
                <>
                  {this.renderHeader()}
                  {this.renderCover()}
                  {this.renderTitle()}
                  {this.renderDescription()}
                </>
              ), isOnlyPostOnClick)}
              {this.props.postContentSingleLine && (<div className={this.props.classes.postContentSingleLineDivider} />)}
              {this.renderBottomBar()}
              {this.renderIWantThisCommentAdd()}
              {this.renderResponseAndStatus()}
              {this.renderMerged()}
              {this.renderLinkedToGitHub()}
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
            actionTitle={this.props.t('get-notified-of-updates')}
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
      </div>
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
        this.renderDisconnect(),
        this.renderRespond(),
        this.renderCommentAdd(),
        this.renderConnect(),
        this.renderDelete(),
      ].filter(notEmpty);
    } else {
      leftSide = [
        this.renderVoting() || this.renderVotingCount(),
        this.renderExpressionCount(),
        this.renderCommentCount(),
      ].filter(notEmpty);

      rightSide = [
        this.renderStatus(),
        this.renderTags(),
        this.renderCategory(),
        this.renderDisconnect(),
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
        this.renderAuthor(),
        this.renderCreatedDatetime(),
        this.renderStatus(),
        this.renderTags(),
        this.renderCategory(),
      ].filter(notEmpty);
    } else {
      header = [
        this.renderAuthor(),
        this.renderCreatedDatetime(),
      ].filter(notEmpty);
    }

    if (!header.length) return null;

    return (
      <div className={this.props.classes.headerBarLine}>
        <Delimited delimiter={(<>&nbsp;&nbsp;&nbsp;</>)}>
          {header}
        </Delimited>
      </div>
    );
  }

  renderAuthor() {
    if (this.props.variant === 'list' && this.props.display && this.props.display.showAuthor === false
      || !this.props.idea?.authorUserId) return null;

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
    if (this.props.variant === 'list' && this.props.display && this.props.display.showCreated === false
      || !this.props.idea?.created) return null;

    return (
      <Typography key='createdDatetime' className={this.props.classes.timeAgo} variant='caption'>
        <TimeAgo date={this.props.idea.created} />
      </Typography>
    );
  }

  renderCommentCount() {
    if (this.props.display?.showCommentCount === false
      || this.props.variant !== 'list'
      || !this.props.idea
      || (this.props.display?.showCommentCount === undefined && !this.props.idea.commentCount)
      || !this.props.category
      || !this.props.category.support.comment) return null;

    return (
      <Typography key='commentCount' className={this.props.classes.itemCount} variant='caption'>
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
        {this.props.t('comment')}
      </MyButton>
    );
  }

  renderIWantThisCommentAdd() {
    if (!this.props.category?.support.vote?.iWantThis
      || !this.props.idea?.ideaId
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
        inputLabel={this.props.t(this.props.category.support.vote.iWantThis.encourageLabel as any || 'tell-us-why')}
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
      || !this.props.idea?.ideaId
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
        {(!!this.props.idea.commentCount || !!this.props.idea.mergedPostIds?.length) && (
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

  renderRespond() {
    const isMod = this.props.server.isModOrAdminLoggedIn();
    if (this.props.variant === 'list'
      || !this.props.idea
      || !this.props.category
      || !isMod
      || !!this.props.idea.response
      || this.props.display?.showEdit === false) return null;

    return (
      <React.Fragment key='edit-response'>
        <MyButton
          buttonVariant='post'
          disabled={!!this.state.showEditingStatusAndResponse}
          Icon={RespondIcon}
          onClick={e => this.setState({ showEditingStatusAndResponse: 'response' })}
        >
          {this.props.t('respond')}
        </MyButton>
      </React.Fragment>
    );
  }

  renderConnect() {
    const isMod = this.props.server.isModOrAdminLoggedIn();
    if (this.props.variant === 'list'
      || !this.props.idea?.ideaId
      || !this.props.category
      || !isMod
      || this.props.display?.showEdit === false) return null;

    return (
      <React.Fragment key='edit-connect'>
        <MyButton
          buttonVariant='post'
          disabled={!!this.state.showEditingConnect}
          Icon={LinkAltIcon}
          onClick={e => this.setState({ showEditingConnect: true })}
        >
          {this.props.t('link')}
        </MyButton>
        <Provider key={this.props.server.getProjectId()} store={this.props.server.getStore()}>
          <PostConnectDialog
            server={this.props.server}
            post={this.props.idea}
            open={!!this.state.showEditingConnect}
            onClose={() => this.setState({ showEditingConnect: false })}
          />
        </Provider>
      </React.Fragment>
    );
  }

  renderDelete() {
    const isMod = this.props.server.isModOrAdminLoggedIn();
    if (this.props.variant === 'list'
      || !this.props.idea?.ideaId
      || !isMod) return null;

    return (
      <>
        <MyButton
          key='delete'
          buttonVariant='post'
          Icon={DeleteIcon}
          onClick={e => this.setState({ deleteDialogOpen: true })}
        >
          {this.props.t('delete')}
        </MyButton>
        <Dialog
          open={!!this.state.deleteDialogOpen}
          onClose={() => this.setState({ deleteDialogOpen: false })}
        >
          <DialogTitle>{this.props.t('delete-post')}</DialogTitle>
          <DialogContent>
            <DialogContentText>{this.props.t('are-you-sure-permanently-delete-post')}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ deleteDialogOpen: false })}
            >{this.props.t('cancel')}</Button>
            <SubmitButton
              isSubmitting={this.state.isSubmittingDelete}
              style={{ color: !this.state.isSubmittingDelete ? this.props.theme.palette.error.main : undefined }}
              onClick={async () => {
                this.setState({ isSubmittingDelete: true });
                try {
                  if (!this.props.idea?.ideaId) return;
                  await (await this.props.server.dispatchAdmin()).ideaDeleteAdmin({
                    projectId: this.props.server.getProjectId(),
                    ideaId: this.props.idea.ideaId,
                  });
                  this.props.onDeleted?.();
                } finally {
                  this.setState({ isSubmittingDelete: false });
                }
              }}>
              {this.props.t('delete')}
            </SubmitButton>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  renderStatus(isInResponse?: boolean, isEditing?: boolean) {
    if (this.props.variant === 'list' && this.props.display && this.props.display.showStatus === false
      || !this.props.idea
      || !this.props.idea.statusId
      || !this.props.category) return null;

    const status = this.props.category.workflow.statuses.find(s => s.statusId === this.props.idea!.statusId);

    var content;

    if (isEditing && !!this.props.idea.categoryId) {
      content = (
        <PostEditStatus
          server={this.props.server}
          autoFocusAndSelect={this.state.showEditingStatusAndResponse === 'status'}
          categoryId={this.props.idea.categoryId}
          initialValue={this.props.idea.statusId}
          value={this.state.editingStatusId}
          onChange={statusId => this.setState({ editingStatusId: statusId })}
          isSubmitting={this.state.isSubmittingStatusAndResponse}
          bare
        />
      );
    } else {
      if (!status) return null;
      content = status.name;
    }

    content = (
      <Typography variant={isInResponse ? 'h6' : 'caption'} component='div' style={{ color: status?.color }}>
        {content}
      </Typography>
    );

    if (this.props.onClickStatus && !this.props.disableOnClick && status && !isEditing) {
      content = (
        <Button
          key='status'
          variant='text'
          className={this.props.classes.button}
          disabled={!this.props.onClickStatus || this.props.disableOnClick || this.props.variant !== 'list'}
          onClick={e => status && this.props.onClickStatus && !this.props.disableOnClick && this.props.onClickStatus(status.statusId)}
        >
          {content}
        </Button>
      );
    }

    if (this.props.variant !== 'list' && this.canEdit() === 'mod') {
      content = (
        <ClickToEdit isEditing={!!this.state.showEditingStatusAndResponse} setIsEditing={isEditing => this.setState({ showEditingStatusAndResponse: 'status' })} >
          {content}
        </ClickToEdit>
      );
    }

    return content;
  }

  renderTags() {
    const canEdit = this.canEdit() === 'mod';
    if (this.props.variant === 'list' && this.props.display && this.props.display.showTags === false
      || !this.props.idea?.ideaId
      || !this.props.category
      || (!this.props.idea.tagIds.length && !canEdit)) return null

    var contentTags = this.props.idea.tagIds
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

    var content: React.ReactNode;
    if (canEdit) {
      content = (
        <PostEditTagsInline
          server={this.props.server}
          post={this.props.idea}
          bare
          noContentLabel={(
            <Typography variant='caption' className={this.props.classes.noContentLabel}
            >{this.props.t('add-tags')}</Typography>
          )}
        >
          {contentTags.length ? contentTags : null}
        </PostEditTagsInline >
      );
    } else {
      content = contentTags;
    }

    return content;
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

    return (
      <VotingControl
        server={this.props.server}
        onlyShowCount
        className={this.props.classes.itemCount}
        vote={this.props.vote}
        voteValue={this.props.idea?.voteValue || 0}
        isSubmittingVote={this.state.isSubmittingVote}
        iWantThis={this.props.category?.support.vote?.iWantThis}
        showVotersForPostId={this.props.idea?.ideaId}
      />
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
          server={this.props.server}
          className={this.props.classes.votingControl}
          vote={this.props.vote}
          voteValue={this.props.idea?.voteValue || 0}
          isSubmittingVote={this.state.isSubmittingVote}
          votingAllowed={votingAllowed}
          onUpvote={() => this.upvote()}
          iWantThis={this.props.category?.support.vote?.iWantThis}
          onDownvote={!this.props.category?.support.vote?.enableDownvotes ? undefined : () => this.downvote()}
          showVotersForPostId={this.props.idea?.ideaId}
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
    if (this.props.variant === 'list' && this.props.display && this.props.display.showFunding === false
      || !this.props.idea?.ideaId
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
            anchorType='in-place'
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
      <Typography key='expressionTop' className={this.props.classes.itemCount} variant='caption'>
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
          anchorType='in-place'
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

  renderCover() {
    const canEdit = this.canEdit() === 'mod' && this.props.variant === 'page';
    if (!this.props.category?.useCover
      || !this.props.idea
      || (!this.props.idea?.coverImg && !canEdit)) return null;
    return (
      <PostCover
        coverImg={this.props.idea?.coverImg}
        editable={canEdit ? img => (
          <PostCoverEdit
            server={this.props.server}
            content={img}
            onUploaded={coverImg => this.props.server.dispatchAdmin().then(d => d.ideaUpdateAdmin({
              projectId: this.props.projectId,
              ideaId: this.props.idea!.ideaId!,
              ideaUpdateAdmin: {
                coverImg,
              }
            }))}
          />
        ) : undefined}
      />
    );
  }

  renderTitle() {
    if (!this.props.idea?.title) return null;
    return (
      <PostTitle
        variant={this.props.variant}
        title={this.props.idea.title}
        titleTruncateLines={this.props.display?.titleTruncateLines}
        descriptionTruncateLines={this.props.display?.descriptionTruncateLines}
        demoBlurryShadow={this.props.settings.demoBlurryShadow}
        editable={this.canEdit() ? () => !!this.props.idea?.ideaId && (
          <PostEditTitleInline
            server={this.props.server}
            post={this.props.idea}
            bare
            TextFieldProps={{
              autoFocus: true,
            }}
          >
            {this.props.idea.title}
          </PostEditTitleInline>
        ) : undefined}
      />
    );
  }

  renderDescription() {
    if (!this.props.idea) return null;
    const idea = this.props.idea;
    return (
      <PostDescription
        variant={this.props.variant}
        description={idea.description}
        descriptionTruncateLines={this.props.display?.descriptionTruncateLines}
        demoBlurryShadow={this.props.settings.demoBlurryShadow}
        editable={this.canEdit() ? description => !!idea.ideaId && (
          <PostEditDescriptionInline
            server={this.props.server}
            post={idea}
            bare
            forceOutline
            noContentLabel={(
              <Typography className={this.props.classes.noContentLabel}
              >{this.props.t('add-description')}</Typography>
            )}
          >
            {description}
          </PostEditDescriptionInline>
        ) : undefined}
      />
    );
  }

  renderDisconnect() {
    if (!this.props.onDisconnect) return null;

    return (
      <React.Fragment key='disconnect'>
        <MyButton
          buttonVariant='post'
          Icon={this.props.disconnectType === 'merge' ? UnmergeIcon : UnLinkAltIcon}
          isSubmitting={this.props.isSubmittingDisconnect}
          onClick={e => this.props.onDisconnect?.()}
        >
          {this.props.disconnectType === 'link' ? this.props.t('unlink') : this.props.t('unmerge')}
        </MyButton>
      </React.Fragment>
    );
  }

  renderMerged() {
    if (!this.props.idea
      || this.props.variant === 'list'
      || !this.props.mergedToPost) return null;

    return (
      <div className={this.props.classes.links}>
        <ConnectedPostsContainer
          type='merge'
          direction='to'
          hasMultiple={false}
        >
          <ConnectedPost
            server={this.props.server}
            containerPost={this.props.idea!}
            post={this.props.mergedToPost}
            type='merge'
            direction='to'
            onClickPost={this.props.onClickPost}
            onUserClick={this.props.onUserClick}
          />
        </ConnectedPostsContainer>
      </div>
    );
  }

  renderLinkedToGitHub() {
    if (!this.props.idea
      || this.props.variant === 'list'
      || !this.props.idea.linkedGitHubUrl) return null;

    var content: React.ReactNode = this.props.idea.linkedGitHubUrl;
    // Expect form of "https://github.com/jenkinsci/jenkins/issues/100"
    const match = (new RegExp(/https:\/\/github.com\/([^/]+)\/([^/]+)\/issues\/([0-9])/))
      .exec(this.props.idea.linkedGitHubUrl);
    if (match) {
      const issueNumber = match[3];
      content = (
        <>
          Issue&nbsp;#{issueNumber}
        </>
      );
    }

    content = (
      <MuiLink
        href={this.props.idea.linkedGitHubUrl}
        target='_blank'
        rel='noopener nofollow'
        underline='none'
        color='textPrimary'
      >
        {content}
      </MuiLink>
    );

    return (
      <div className={this.props.classes.links}>
        <ConnectedPostsContainer
          type='github'
          direction='to'
          hasMultiple={false}
        >
          <OutlinePostContent>
            {content}
          </OutlinePostContent>
        </ConnectedPostsContainer>
      </div>
    );
  }

  renderLinks() {
    if (!this.props.idea
      || this.props.variant === 'list'
      || (!this.props.linkedToPosts?.length && !this.props.linkedFromPosts?.length)) return null;

    return (
      <div className={this.props.classes.links}>
        {(['to', 'from'] as LinkDirection[]).map(direction => {
          const posts = (direction === 'to' ? this.props.linkedToPosts : this.props.linkedFromPosts);
          if (!posts?.length) return null;
          return (
            <ConnectedPostsContainer
              type='link'
              direction={direction}
              hasMultiple={posts.length > 1}
            >
              {posts.map(post => (
                <ConnectedPost
                  key={post.ideaId}
                  server={this.props.server}
                  containerPost={this.props.idea?.ideaId ? this.props.idea : undefined}
                  post={post}
                  type='link'
                  direction={direction}
                  onClickPost={this.props.onClickPost}
                  onUserClick={this.props.onUserClick}
                />
              ))}
            </ConnectedPostsContainer>
          );
        })}
      </div>
    );
  }

  renderResponseAndStatus() {
    if (!this.props.idea) return null;

    var response;
    var status;
    var author;

    if (!this.state.showEditingStatusAndResponse) {
      response = this.renderResponse();
      status = this.props.variant !== 'list' && this.renderStatus(true);
      author = (this.props.idea.responseAuthorUserId && this.props.idea.responseAuthorName) ? {
        userId: this.props.idea.responseAuthorUserId,
        name: this.props.idea.responseAuthorName,
        isMod: true
      } : undefined;

      // Don't show if nothing to show OR if only status is present and author is unknown
      if (!response && (!status || !author)) return null;

    } else {
      response = this.renderResponse(true);
      status = this.renderStatus(true, true);
      author = this.props.loggedInUser;
    }

    return this.renderResponseAndStatusLayout(
      response,
      status,
      author,
      this.props.idea.responseEdited,
      !!this.state.showEditingStatusAndResponse,
    );
  }

  renderResponseAndStatusLayout(
    response: React.ReactNode,
    status: React.ReactNode,
    author?: React.ComponentProps<typeof UserWithAvatarDisplay>['user'],
    edited?: Date,
    isEditing?: boolean,
  ) {
    var content = (
      <div className={classNames(
        this.props.classes.responseContainer,
        this.props.variant === 'list' ? this.props.classes.responseContainerList : this.props.classes.responseContainerPage,
      )}>
        <div className={this.props.classes.responseHeader}>
          {this.props.variant !== 'list' && (
            <HelpPopper description='Pinned response'>
              <PinIcon color='inherit' fontSize='inherit' className={this.props.classes.pinIcon} />
            </HelpPopper>
          )}
          <UserWithAvatarDisplay
            onClick={this.props.onUserClick}
            user={author}
            baseline
          />
          {!!status && (
            <>
              <Typography variant='body1'>{this.props.t('changed-to')}&nbsp;</Typography>
              {status}
            </>
          )}
          {(!!edited && !isEditing) && (
            <Typography className={this.props.classes.timeAgo} variant='caption'>
              <TimeAgo date={edited} />
            </Typography>
          )}
        </div>
        {!!response && response}
      </div>
    );

    if (isEditing) {
      const changed = this.state.editingStatusId !== undefined || this.state.editingResponse !== undefined
      content = (
        <PostSaveButton
          open
          isSubmitting={this.state.isSubmittingStatusAndResponse}
          showNotify
          onCancel={() => this.setState({
            showEditingStatusAndResponse: false,
            editingResponse: undefined,
            editingStatusId: undefined,
          })}
          onSave={(doNotify) => {
            if (!this.props.idea?.ideaId || !changed) return;
            this.setState({ isSubmittingStatusAndResponse: true });
            postSave(
              this.props.server,
              this.props.idea.ideaId,
              {
                ...(this.state.editingStatusId !== undefined ? { statusId: this.state.editingStatusId } : {}),
                ...(this.state.editingResponse !== undefined ? { response: this.state.editingResponse } : {}),
                suppressNotifications: !doNotify,
              },
              () => this.setState({
                showEditingStatusAndResponse: false,
                editingResponse: undefined,
                editingStatusId: undefined,
                isSubmittingStatusAndResponse: false,
              }),
              () => this.setState({
                isSubmittingStatusAndResponse: false,
              }),
            );
          }}
        >
          {content}
        </PostSaveButton>
      );
    }

    return content;
  }

  renderResponse(isEditing?: boolean) {
    if (this.props.variant === 'list' && this.props.display && this.props.display.responseTruncateLines !== undefined && this.props.display.responseTruncateLines <= 0
      || !this.props.idea) return null;

    var content;
    if (!isEditing) {
      if (!this.props.idea.response) return null;
      content = (
        <RichViewer
          key={this.props.idea.response}
          iAgreeInputIsSanitized
          html={this.props.idea.response}
          toneDownHeadings={this.props.variant === 'list'}
        />
      );
    } else {
      content = (
        <PostEditResponse
          server={this.props.server}
          autoFocusAndSelect={this.state.showEditingStatusAndResponse === 'response'}
          value={this.state.editingResponse !== undefined
            ? this.state.editingResponse
            : this.props.idea.response}
          onChange={response => this.setState({ editingResponse: response })}
          isSubmitting={this.state.isSubmittingStatusAndResponse}
          RichEditorProps={{
            placeholder: this.props.t('add-a-response'),
          }}
          bare
          forceOutline
        />
      );
    }

    if (this.props.variant === 'list' && !isEditing) {
      content = (
        <TruncateFade variant='body1' lines={this.props.display?.responseTruncateLines}>
          <div>{content}</div>
        </TruncateFade>
      );
    }

    content = (
      <Typography variant='body1' component={'span'} className={`${this.props.classes.response} ${this.props.variant !== 'list' ? this.props.classes.responsePage : this.props.classes.responseList} ${this.props.settings.demoBlurryShadow ? this.props.classes.blurry : ''}`}>
        {content}
      </Typography>
    );

    if (this.props.variant !== 'list' && !isEditing && this.canEdit() === 'mod') {
      content = (
        <ClickToEdit isEditing={!!this.state.showEditingStatusAndResponse} setIsEditing={isEditing => this.setState({ showEditingStatusAndResponse: 'response' })} >
          {content}
        </ClickToEdit>
      );
    }

    return content;
  }

  renderTitleAndDescription(children: React.ReactNode, isOnlyPostOnClick: boolean) {
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
          onClick={(this.props.onClickPost && !this.props.disableOnClick && !isOnlyPostOnClick) ? () => this.props.onClickPost && this.props.idea?.ideaId
            && this.props.onClickPost(this.props.idea.ideaId) : undefined}
        >
          {children}
        </div>
      );

    return (
      <Link
        className={classNames(this.props.classes.titleAndDescription, this.props.classes.clickable)}
        to={preserveEmbed(`/post/${this.props.idea.ideaId}`)}
      >
        {children}
      </Link>
    );
  }

  canEdit(): false | 'mod' | 'author' {
    if (this.props.variant === 'list') return false;
    if (this.props.server.isModOrAdminLoggedIn()) return 'mod';
    if (this.props.loggedInUser
      && this.props.idea?.authorUserId === this.props.loggedInUser.userId
    ) return 'author';
    return false;
  }

  async demoFundingAnimate(fundAmount: number) {
    if (!this.props.idea?.ideaId) return;

    const animate = animateWrapper(
      () => this._isMounted,
      this.inViewObserverRef,
      () => this.props.settings,
      this.setState.bind(this));

    if (await animate({ sleepInMs: 1000 })) return;
    const ideaId = this.props.idea.ideaId;
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
      ideaId: this.props.idea!.ideaId!,
      ideaVoteUpdate,
    });
    return response;
  }
}

export const PostCover = (props: {
  editable?: React.ReactNode | ((title: React.ReactNode) => React.ReactNode);
} & Pick<Client.Idea, 'coverImg'>
) => {
  const classes = useStyles();

  if (!props.editable && !props.coverImg) return null;

  var cover: React.ReactNode | undefined = !props.coverImg ? undefined : (
    <img
      className={classes.coverImg}
      alt=''
      src={props.coverImg}
    />
  );

  if (props.editable) {
    cover = typeof props.editable === 'function' ? props.editable(cover) : props.editable;
  }

  return (<>{cover}</>);
}

export const PostCoverEdit = (props: {
  onUploaded: (coverUrl: string) => void;
  server: Server;
  authorUserId?: string;
  content?: React.ReactNode;
}) => {
  const classes = useStyles();
  const { enqueueSnackbar } = useSnackbar();
  const imageUploadRef = useRef<RichEditorImageUpload>(null);

  return (
    <>
      <Dropzone
        minSize={1}
        maxFiles={1}
        onDrop={async (acceptedFiles, rejectedFiles, e) => {
          rejectedFiles.forEach(rejectedFile => {
            rejectedFile.errors.forEach(error => {
              enqueueSnackbar(
                `${rejectedFile.file.name}: ${error.message}`,
                { variant: 'error' });
            })
          })

          if (acceptedFiles.length < 1) return;
          const acceptedFile = acceptedFiles[0];

          const coverUrl = await imageUploadRef.current?.uploadImage(acceptedFile);
          if (!coverUrl) return;

          props.onUploaded(coverUrl);
        }}
      >
        {({ getRootProps, getInputProps }) => (
          <div className={classNames(!props.content && classes.dropzone)} {...getRootProps()}>
            <input {...getInputProps()} />
            {props.content ? props.content : (
              <>
                <ImgIcon color='inherit' className={classes.uploadIcon} />
                Upload a cover image
              </>
            )}
          </div>
        )}
      </Dropzone>
      <RichEditorImageUpload
        ref={imageUploadRef}
        server={props.server}
        asAuthorId={props.authorUserId}
      />
    </>
  );
}

export const PostTitle = (props: {
  variant: PostVariant;
  editable?: React.ReactNode | ((title: React.ReactNode) => React.ReactNode);
} & Pick<Client.Idea, 'title'>
  & Partial<Pick<Client.PostDisplay, 'titleTruncateLines' | 'descriptionTruncateLines'>>
  & Pick<StateSettings, 'demoBlurryShadow'>
) => {
  const classes = useStyles();
  if (!props.editable && !props.title) return null;

  var title: React.ReactNode = props.variant === 'list'
    ? (<TruncateEllipsis ellipsis='…' lines={props.titleTruncateLines}><div>{props.title}</div></TruncateEllipsis>)
    : props.title;

  if (props.editable) {
    title = typeof props.editable === 'function' ? props.editable(title) : props.editable;
  }

  return (
    <div className={classes.titleContainer}>
      <Typography
        variant='h5'
        component='h1'
        className={classNames(
          classes.title,
          props.variant !== 'list'
            ? classes.titlePage
            : ((props.descriptionTruncateLines !== undefined && props.descriptionTruncateLines <= 0)
              ? classes.titleListWithoutDescription
              : classes.titleList),
          props.demoBlurryShadow && classes.blurry,
        )}
      >
        {title}
      </Typography>
    </div>
  );
}

export const PostDescription = (props: {
  variant: PostVariant,
  editable?: (description: React.ReactNode) => React.ReactNode;
} & Pick<Client.Idea, 'description'>
  & Partial<Pick<Client.PostDisplay, 'descriptionTruncateLines'>>
  & Pick<StateSettings, 'demoBlurryShadow'>
) => {
  const classes = useStyles();
  if ((props.variant === 'list'
    && props.descriptionTruncateLines !== undefined
    && props.descriptionTruncateLines <= 0)
    || (!props.editable && !props.description)) return null;

  var description: React.ReactNode = !props.description ? undefined : (
    <RichViewer
      key={props.description}
      iAgreeInputIsSanitized
      html={props.description}
      toneDownHeadings={props.variant === 'list'}
    />
  );
  if (description !== undefined && props.variant === 'list') {
    description = (
      <TruncateFade variant='body1' lines={props.descriptionTruncateLines}>
        <div>{description}</div>
      </TruncateFade>
    );
  }
  if (props.editable) {
    description = props.editable(description);
  }
  return (
    <Typography variant='body1' component={'span'} className={classNames(
      classes.description,
      props.variant !== 'list' ? classes.descriptionPage : classes.descriptionList,
      props.demoBlurryShadow ? classes.blurry : '',
    )}>
      {description}
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
  if (ownProps.idea?.ideaId) {
    voteStatus = state.votes.statusByIdeaId[ownProps.idea.ideaId];
    if (voteStatus !== undefined) {
      vote = state.votes.votesByIdeaId[ownProps.idea.ideaId];
      expression = state.votes.expressionByIdeaId[ownProps.idea.ideaId];
      fundAmount = state.votes.fundAmountByIdeaId[ownProps.idea.ideaId];
    }
  }
  const fetchPostIds: string[] = [];
  var mergedToPost: Client.Idea | undefined;
  if (ownProps.idea?.mergedToPostId) {
    const mergedToPostContainer = state.ideas.byId[ownProps.idea.mergedToPostId];
    if (!mergedToPostContainer) {
      fetchPostIds.push(ownProps.idea.mergedToPostId);
    } else {
      mergedToPost = state.ideas.byId[ownProps.idea.mergedToPostId].idea;
    }
  }
  const linkedToPosts = ownProps.idea?.linkedToPostIds?.map(linkedPostId => {
    const linkedPost = state.ideas.byId[linkedPostId];
    if (!linkedPost) fetchPostIds.push(linkedPostId);
    return linkedPost?.idea;
  }).filter(notEmpty);
  const linkedFromPosts = ownProps.idea?.linkedFromPostIds?.map(linkedPostId => {
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
    mergedToPost,
    linkedToPosts,
    linkedFromPosts,
    fetchPostIds,
  };
})(withStyles(styles, { withTheme: true })(withSnackbar(withTranslation('app', { withRef: true })(Post))));

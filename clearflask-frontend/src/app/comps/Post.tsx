import { Button, CardActionArea, Chip, Collapse, Fade, IconButton, Popover, Typography } from '@material-ui/core';
import { PopoverActions, PopoverPosition } from '@material-ui/core/Popover';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { fade } from '@material-ui/core/styles/colorManipulator';
import AddIcon from '@material-ui/icons/Add';
import DownvoteIcon from '@material-ui/icons/ArrowDropDownRounded';
import UpvoteIcon from '@material-ui/icons/ArrowDropUpRounded';
/* alternatives: comment, chat bubble (outline), forum, mode comment, add comment */
import SpeechIcon from '@material-ui/icons/CommentOutlined';
import AddEmojiIcon from '@material-ui/icons/InsertEmoticon';
import { BaseEmoji, Picker } from 'emoji-mart';
import { withSnackbar, WithSnackbarProps } from 'notistack';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import TimeAgo from 'react-timeago';
import Truncate from 'react-truncate-markup';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import Expander from '../../common/Expander';
import GradientFade from '../../common/GradientFade';
import notEmpty from '../../common/util/arrayUtil';
import Delimited from '../utils/Delimited';
import Loader from '../utils/Loader';
import CommentList from './CommentList';
import CommentReply from './CommentReply';
import FundingBar from './FundingBar';
import FundingControl from './FundingControl';
import LogIn from './LogIn';
import PostEdit from './PostEdit';

const styles = (theme: Theme) => createStyles({
  page: {
    minWidth: 300,
  },
  list: {
    minWidth: 300,
  },
  comment: {
    margin: theme.spacing(1),
  },
  leftColumn: {
    margin: theme.spacing(1),
    marginRight: '0px',
  },
  rightColumn: {
    margin: theme.spacing(1),
  },
  titleAndDescriptionOuter: {
    padding: theme.spacing(0.5),
  },
  titleAndDescriptionCard: {
    background: 'transparent',
  },
  title: {
    fontSize: '1.1rem',
  },
  titleAndDescription: {
    padding: theme.spacing(0.5),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    textTransform: 'none',
    '&:hover $title': {
      textDecoration: 'underline',
    },
  },
  description: {
    marginTop: theme.spacing(0.5),
  },
  pre: {
    whiteSpace: 'pre-wrap',
  },
  responseContainer: {
    margin: theme.spacing(0.5),
    padding: theme.spacing(0.5, 1),
  },
  responsePrefixText: {
    fontSize: '0.8rem',
    color: theme.palette.grey[500],
  },
  editButton: {
    padding: `3px ${theme.spacing(0.5)}px`,
    whiteSpace: 'nowrap',
    minWidth: 'unset',
    color: theme.palette.text.hint,
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
    color: theme.palette.text.hint,
  },
  voteIconButton: {
    fontSize: '2em',
    padding: '0px',
    color: theme.palette.text.hint,
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
    marginLeft: theme.spacing(0.25),
    marginRight: theme.spacing(0.25),
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
    lineHeight: 1.15,
    fontSize: 16,
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
    color: theme.palette.text.hint,
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
  expressionPicker: {
    '& .emoji-mart': {
      color: theme.palette.text.primary + '!important',
    },
    '& .emoji-mart-emoji': {
      filter: theme.expressionGrayscale ? (`grayscale(${theme.expressionGrayscale}%)!important`) : undefined,
    },
    '& .emoji-mart-anchor-icon svg': {
      fill: theme.palette.text.hint + '!important',
    },
    '& .emoji-mart-search input::placeholder': {
      color: theme.palette.text.hint + '!important',
    },
    '& .emoji-mart-search input': {
      background: 'inherit!important',
      border: '0px!important',
      color: theme.palette.text.primary + '!important',
    },
    '& .emoji-mart-category-label span': {
      background: fade(theme.palette.background.paper, .95) + '!important',
    },
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
    margin: theme.spacing(1),
    marginTop: `-${theme.spacing(0.5)}px`,
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
    color: theme.palette.text.hint,
  },
  nothing: {
    margin: theme.spacing(4),
    color: theme.palette.text.hint,
  },
  funding: {
    margin: theme.spacing(1),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
});

export type PostVariant = 'list' | 'page';

interface Props {
  server: Server;
  idea?: Client.Idea;
  variant: PostVariant;
  /**
   * If true, when post is clicked,
   * variant is switched from 'list' to 'page',
   * url is appended with /post/<postId>
   * and post is expanded to full screen.
   */
  expandable?: boolean;
  forceDisablePostExpand?: boolean;
  display?: Client.PostDisplay;
  onClickTag?: (tagId: string) => void;
  onClickCategory?: (categoryId: string) => void;
  onClickStatus?: (statusId: string) => void;
}

interface ConnectProps {
  configver?: string;
  projectId: string;
  category?: Client.Category;
  credits?: Client.Credits;
  maxFundAmountSeen: number;
  vote?: Client.VoteOption;
  expression?: Array<string>;
  fundAmount?: number;
  loggedInUser?: Client.User;
  updateVote: (voteUpdate: Partial<Client.VoteUpdate>) => Promise<Client.VoteUpdateResponse>;
}

interface State {
  fundingExpanded?: boolean;
  fundingExpandedAnchor?: PopoverPosition & { width: number };
  expressionExpanded?: boolean;
  expressionExpandedAnchor?: PopoverPosition;
  logInOpen?: boolean;
  isSubmittingUpvote?: boolean;
  isSubmittingDownvote?: boolean;
  isSubmittingFund?: boolean;
  isSubmittingExpression?: boolean;
  editExpanded?: boolean;
  commentExpanded?: boolean
}

export const isExpanded = (): boolean => !!Post.expandedPath;

class Post extends Component<Props & ConnectProps & RouteComponentProps & WithStyles<typeof styles, true> & WithSnackbarProps, State> {
  /**
   * expandedPath allows a page transition from a list of posts into a
   * single post without having to render a new page.
   */
  static expandedPath: string | undefined;
  expandedPath: string | undefined;
  onLoggedIn?: () => void;

  constructor(props) {
    super(props);
    this.state = {};
  }

  componentWillUnmount() {
    if (Post.expandedPath === this.expandedPath) {
      Post.expandedPath = undefined;
    }
  }

  render() {
    if (!this.props.idea) return (
      <Loader loaded={false}>
      </Loader>
    );

    var forceExpand = false;
    if (this.expandedPath) {
      if (this.expandedPath !== Post.expandedPath) {
        this.expandedPath = undefined;
      } else if (this.expandedPath !== this.props.location.pathname) {
        this.expandedPath = undefined;
        Post.expandedPath = undefined;
      } else {
        forceExpand = true;
      }
    }
    const variant = forceExpand ? 'page' : this.props.variant;

    const voting = this.renderVoting(variant);
    return (
      <Loader loaded={!!this.props.idea}>
        <Expander expand={forceExpand}>
          <div className={variant === 'page' ? this.props.classes.page : this.props.classes.list} style={{
            display: 'flex',
            alignItems: 'flex-start',
          }}>
            {voting && (
              <div className={this.props.classes.leftColumn}>
                {voting}
              </div>
            )}
            <div className={this.props.classes.rightColumn} style={{
              display: 'flex',
              flexDirection: 'column',
            }}>
              {this.renderFunding(variant)}
              <div className={this.props.classes.titleAndDescriptionOuter}>
                <CardActionArea
                  className={this.props.classes.titleAndDescription}
                  disabled={!this.props.expandable || variant === 'page' || (this.props.display && this.props.display.disableExpand)}
                  onClick={this.onExpand.bind(this)}
                  classes={{
                    focusHighlight: this.props.classes.titleAndDescriptionCard,
                  }}
                >
                  {this.renderTitle(variant)}
                  {this.renderDescription(variant)}
                  {this.renderResponse(variant)}
                </CardActionArea>
              </div>
              {this.renderBottomBar(variant)}
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
        </Expander>
      </Loader>
    );
  }

  renderBottomBar(variant: PostVariant) {
    const leftSide = [
      this.renderExpression(variant),
      this.renderStatus(variant),
      this.renderCategory(variant),
      ...(this.renderTags(variant) || []),
    ].filter(notEmpty);
    const rightSide = [
      this.renderCommentCount(variant),
      this.renderCreatedDatetime(variant),
      this.renderAuthor(variant),
      this.renderEdit(variant),
    ].filter(notEmpty);

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
        {this.props.idea.authorName}
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
    if (this.props.display && this.props.display.showCommentCount === false
      || variant === 'page'
      || !this.props.idea
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
    if (!this.props.idea
      || !this.props.category
      || !this.props.credits
      || (!this.props.server.isOwnerLoggedIn() && !(this.props.loggedInUser && this.props.idea.authorUserId === this.props.loggedInUser.userId))) return null;

    return (
      <React.Fragment>
        <Button key='edit' variant='text' className={this.props.classes.editButton}
          onClick={e => this.setState({ editExpanded: !this.state.editExpanded })}>
          <Typography variant='caption'>Edit</Typography>
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
      <Button key='status' variant="text" className={this.props.classes.button} disabled={!this.props.onClickStatus || variant === 'page'}
        onClick={e => this.props.onClickStatus && this.props.onClickStatus(status.statusId)}>
        <Typography variant='caption' style={{ color: status.color }}>
          {status.name}
        </Typography>
      </Button>
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
    if (variant !== 'page' && this.props.display && this.props.display.showCategoryName === false
      || !this.props.idea
      || !this.props.category) return null;

    return (
      <Button key='category' variant="text" className={this.props.classes.button} disabled={!this.props.onClickCategory || variant === 'page'}
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
      && !this.props.idea.voteValue
      && !this.props.idea.votersCount) return null;

    const upvoted: boolean = (this.props.vote === Client.VoteOption.Upvote) !== !!this.state.isSubmittingUpvote;
    const downvoted: boolean = (this.props.vote === Client.VoteOption.Downvote) !== !!this.state.isSubmittingDownvote;

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <IconButton
          color={upvoted ? 'primary' : undefined}
          className={`${this.props.classes.voteIconButton} ${this.props.classes.voteIconButtonUp} ${upvoted ? this.props.classes.voteIconVoted : ''}`}
          disabled={!votingAllowed}
          onClick={votingAllowed ? e => {
            const upvote = () => {
              if (this.state.isSubmittingUpvote) return;
              this.setState({ isSubmittingUpvote: true });
              this.props.updateVote({
                vote: (this.props.vote === Client.VoteOption.Upvote)
                  ? Client.VoteOption.None : Client.VoteOption.Upvote
              })
                .then(() => this.setState({ isSubmittingUpvote: false }),
                  () => this.setState({ isSubmittingUpvote: false }));
            };
            if (this.props.loggedInUser) {
              upvote();
            } else {
              this.onLoggedIn = upvote;
              this.setState({ logInOpen: true });
            }
          } : undefined}>
          <UpvoteIcon fontSize='inherit' />
        </IconButton>
        <Typography variant='overline' className={this.props.classes.voteCount}>
          {this.props.idea.voteValue || 0}
        </Typography>

        {this.props.category.support.vote.enableDownvotes && (
          <IconButton
            color={downvoted ? 'primary' : undefined}
            className={`${this.props.classes.voteIconButton} ${this.props.classes.voteIconButtonDown} ${downvoted ? this.props.classes.voteIconVoted : ''}`}
            disabled={!votingAllowed}
            onClick={votingAllowed ? e => {
              if (this.state.isSubmittingDownvote) return;
              const downvote = () => {
                this.setState({ isSubmittingDownvote: true });
                this.props.updateVote({
                  vote: (this.props.vote === Client.VoteOption.Downvote)
                    ? Client.VoteOption.None : Client.VoteOption.Downvote
                })
                  .then(() => this.setState({ isSubmittingDownvote: false }),
                    () => this.setState({ isSubmittingDownvote: false }));
              };
              if (this.props.loggedInUser) {
                downvote();
              } else {
                this.onLoggedIn = downvote;
                this.setState({ logInOpen: true });
              }
            } : undefined}>
            <DownvoteIcon fontSize='inherit' />
          </IconButton>
        )}
      </div>
    );
  }

  fundingBarRef: React.RefObject<HTMLDivElement> = React.createRef();
  fundingPopoverActions?: PopoverActions;
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
    const padding = this.props.theme.spacing(3);

    const fundThisButton = (
      <Button
        color={iFundedThis ? 'primary' : 'default'}
        classes={{
          root: `${this.props.classes.button} ${this.props.classes.fundThisButton}`,
        }}
        disabled={!fundingAllowed}
        onClick={!fundingAllowed ? undefined : (e => {
          const onLoggedInClick = () => {
            this.setState({
              fundingExpanded: true,
              fundingExpandedAnchor: {
                width: this.fundingBarRef.current!.getBoundingClientRect().width,
                top: this.fundingBarRef.current!.getBoundingClientRect().top - padding,
                left: this.fundingBarRef.current!.getBoundingClientRect().left - padding
              }
            },
            )
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
          color={iFundedThis ? 'primary' : undefined}
        >
          {fundingAllowed
            ? <span style={{ display: 'flex', alignItems: 'center' }}>
              <AddIcon fontSize='inherit' />
              {iFundedThis ? 'Adjust funding' : 'Fund this'}
            </span>
            : 'Funding is closed'}
        </Typography>
      </Button>
    );

    return (
      <div className={this.props.classes.funding}>
        <FundingBar
          fundingBarRef={this.fundingBarRef}
          idea={this.props.idea}
          credits={this.props.credits}
          maxFundAmountSeen={this.props.maxFundAmountSeen}
          style={{ alignSelf: 'stretch' }}
          overrideRight={fundThisButton}
        />
        {fundingAllowed && (
          <Popover
            elevation={0}
            TransitionComponent={Fade}
            open={!!this.state.fundingExpanded}
            anchorReference='anchorPosition'
            anchorPosition={this.state.fundingExpandedAnchor}
            onClose={() => this.setState({ fundingExpanded: false })}
            anchorOrigin={{ vertical: 'top', horizontal: 'left', }}
            transformOrigin={{ vertical: 'top', horizontal: 'left', }}
            marginThreshold={2}
            PaperProps={{
              className: this.props.classes.popover,
              style: {
                overflow: 'hidden',
                width: this.state.fundingExpandedAnchor ? this.state.fundingExpandedAnchor.width + padding * 2 : 0,
                padding: padding,
              }
            }}
            disableRestoreFocus
            action={actions => this.fundingPopoverActions = actions || undefined}
          >
            <FundingControl
              server={this.props.server}
              idea={this.props.idea}
              fundAmount={this.props.fundAmount}
              onOtherFundedIdeasLoaded={() => this.fundingPopoverActions && this.fundingPopoverActions.updatePosition()}
            />
          </Popover>
        )}
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

    const padding = this.props.theme.spacing(0.5);
    const limitEmojiPerIdea = this.props.category.support.express.limitEmojiPerIdea;
    const reachedLimitPerIdea = limitEmojiPerIdea && (!!this.props.expression && Object.keys(this.props.expression).length || 0) > 0;

    const getHasExpressed = (display: string): boolean => {
      return this.props.expression
        && this.props.expression.includes(display)
        || false;
    };
    const clickExpression = (display: string) => {
      if (!expressionAllowed) return;
      var expressionDiff: Client.VoteUpdateExpressions | undefined = undefined;
      const hasExpressed = getHasExpressed(display);
      if (limitEmojiPerIdea) {
        if (hasExpressed) {
          expressionDiff = { action: Client.VoteUpdateExpressionsActionEnum.Unset, expression: display };
        } else {
          expressionDiff = { action: Client.VoteUpdateExpressionsActionEnum.Set, expression: display };
        }
      } else if (!hasExpressed && reachedLimitPerIdea) {
        this.props.enqueueSnackbar("Whoa, that's too many", { variant: 'warning', preventDuplicate: true });
        return;
      } else if (hasExpressed) {
        expressionDiff = { action: Client.VoteUpdateExpressionsActionEnum.Remove, expression: display };
      } else {
        expressionDiff = { action: Client.VoteUpdateExpressionsActionEnum.Add, expression: display };
      }
      this.props.updateVote({ expressions: expressionDiff })
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
      <span key='picker' className={this.props.classes.expressionPicker}>
        <Picker
          native
          onSelect={emoji => clickExpression(((emoji as BaseEmoji).native) as never)}
          showPreview={false}
          showSkinTones={false}
          emojiSize={16}
          exclude={['recent']}
          style={{
            border: 'unset',
            background: 'unset',
            display: 'block',
          }}
          color={this.props.theme.palette.primary.main}
        />
      </span>
    );

    const maxItems = 3;
    const summaryItems: React.ReactNode[] = expressionsExpressed.length > 0 ? expressionsExpressed.slice(0, Math.min(maxItems, expressionsExpressed.length)) : [];

    const showMoreButton: boolean = !limitEmojiSet || summaryItems.length !== expressionsExpressed.length + expressionsUnused.length;

    return (
      <div key='expression' style={{
        position: 'relative',
      }}>
        <div style={{ display: 'flex' }}>
          <GradientFade
            disabled={summaryItems.length < maxItems}
            start={'50%'}
            opacity={0.3}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
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
            currentTarget => {
              const targetElement = currentTarget.parentElement || currentTarget;
              this.setState({
                expressionExpanded: true,
                expressionExpandedAnchor: {
                  top: targetElement.getBoundingClientRect().top - padding,
                  left: targetElement.getBoundingClientRect().left - padding
                }
              },
              )
            }
          )}
        </div>
        <Popover
          elevation={0}
          TransitionComponent={Fade}
          open={!!this.state.expressionExpanded}
          anchorReference='anchorPosition'
          anchorPosition={this.state.expressionExpandedAnchor}
          onClose={() => this.setState({ expressionExpanded: false })}
          anchorOrigin={{ vertical: 'top', horizontal: 'left', }}
          transformOrigin={{ vertical: 'top', horizontal: 'left', }}
          marginThreshold={2}
          PaperProps={{
            className: this.props.classes.popover,
            style: {
              overflow: 'hidden',
              ...(limitEmojiSet ? {} : { width: 'min-content' }),
              padding: padding,
              paddingBottom: limitEmojiSet ? padding : 0,
            }
          }}
          disableRestoreFocus
        >
          {[
            ...expressionsExpressed,
            ...expressionsUnused,
            picker,
          ]}
        </Popover>
      </div>
    );
  }

  renderTitle(variant: PostVariant) {
    if (!this.props.idea
      || !this.props.idea.title) return null;
    return (
      <Typography variant='subtitle1' component={'span'} className={this.props.classes.title}>
        {variant !== 'page' && this.props.display && this.props.display.titleTruncateLines !== undefined && this.props.display.titleTruncateLines > 0
          ? (<Truncate lines={this.props.display.titleTruncateLines}><div>{this.props.idea.title}</div></Truncate>)
          : this.props.idea.title}
      </Typography>
    );
  }

  renderDescription(variant: PostVariant) {
    if (variant !== 'page' && this.props.display && this.props.display.showDescription === false
      || !this.props.idea
      || !this.props.idea.description) return null;
    return (
      <Typography variant='body1' component={'span'} className={`${this.props.classes.description} ${variant === 'page' ? this.props.classes.pre : ''}`}>
        {variant !== 'page' && this.props.display && this.props.display.descriptionTruncateLines !== undefined && this.props.display.descriptionTruncateLines > 0
          ? (<Truncate lines={this.props.display.descriptionTruncateLines}><div>{this.props.idea.description}</div></Truncate>)
          : this.props.idea.description}
      </Typography>
    );
  }

  renderResponse(variant: PostVariant) {
    if (variant !== 'page' && this.props.display && this.props.display.showResponse === false
      || !this.props.idea
      || !this.props.idea.response) return null;
    return (
      <div className={this.props.classes.responseContainer}>
        <Typography variant='body1' component={'span'} className={this.props.classes.responsePrefixText}>
          Reply:&nbsp;&nbsp;
        </Typography>
        <Typography variant='body1' component={'span'}>
          {variant !== 'page' && this.props.display && this.props.display.responseTruncateLines !== undefined && this.props.display.responseTruncateLines > 0
            ? (<Truncate lines={this.props.display.responseTruncateLines}><div>{this.props.idea.response}</div></Truncate>)
            : this.props.idea.response}
        </Typography>
      </div>
    );
  }

  onExpand() {
    if (!this.props.expandable || !this.props.idea) return;
    if (this.props.forceDisablePostExpand || this.props.theme.disableTransitions) {
      this.props.history.push(`${this.props.match.url.replace(/\/$/, '')}/post/${this.props.idea.ideaId}`);
    } else {
      this.expandedPath = `${this.props.match.url.replace(/\/$/, '')}/post/${this.props.idea.ideaId}`;
      Post.expandedPath = this.expandedPath;
      this.props.history.push(this.expandedPath);
    }
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props): ConnectProps => {
  var vote: Client.VoteOption | undefined;
  var expression: Array<string> | undefined;
  var fundAmount: number | undefined;
  if (ownProps.idea) {
    const voteStatus = state.votes.statusByIdeaId[ownProps.idea.ideaId];
    if (voteStatus === undefined) {
      // Don't refresh votes if inside a panel which will refresh votes for us
      if (ownProps.variant === 'page') {
        ownProps.server.dispatch().voteGetOwn({
          projectId: state.projectId,
          ideaIds: [ownProps.idea.ideaId],
        });
      }
    } else {
      vote = state.votes.votesByIdeaId[ownProps.idea.ideaId];
      expression = state.votes.expressionByIdeaId[ownProps.idea.ideaId];
      fundAmount = state.votes.fundAmountByIdeaId[ownProps.idea.ideaId];
    }
  }
  return {
    configver: state.conf.ver, // force rerender on config change
    projectId: state.projectId,
    vote,
    expression,
    fundAmount,
    category: (ownProps.idea && state.conf.conf)
      ? state.conf.conf.content.categories.find(c => c.categoryId === ownProps.idea!.categoryId)
      : undefined,
    credits: state.conf.conf
      ? state.conf.conf.credits
      : undefined,
    maxFundAmountSeen: state.ideas.maxFundAmountSeen,
    loggedInUser: state.users.loggedIn.user,
    updateVote: (voteUpdate: Partial<Client.VoteUpdate>): Promise<Client.VoteUpdateResponse> => ownProps.server.dispatch().voteUpdate({
      projectId: state.projectId,
      voteUpdate: {
        ideaId: ownProps.idea!.ideaId,
        ...voteUpdate,
      },
    }),
  };
})(withStyles(styles, { withTheme: true })(withRouter(withSnackbar(Post))));

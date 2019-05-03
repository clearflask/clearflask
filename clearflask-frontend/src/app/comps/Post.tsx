import React, { Component } from 'react';
import * as Client from '../../api/client';
import { Typography, CardActionArea, Grid, Button, IconButton, LinearProgress, Popover, Grow, Collapse } from '@material-ui/core';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import Loader from '../utils/Loader';
import { connect } from 'react-redux';
import { ReduxState, Server, Status } from '../../api/server';
import TimeAgo from 'react-timeago'
import SpeechIcon from '@material-ui/icons/CommentOutlined';
import UpvoteIcon from '@material-ui/icons/ArrowDropUpRounded';
import DownvoteIcon from '@material-ui/icons/ArrowDropDownRounded';
import TruncateMarkup from 'react-truncate-markup';
import CreditView from '../../common/config/CreditView';
import { withRouter, RouteComponentProps, matchPath } from 'react-router';
import Expander from '../../common/Expander';
import Delimited from '../utils/Delimited';
import Comment from './Comment';

const styles = (theme:Theme) => createStyles({
  page: {
  },
  list: {
  },
  comment: {
    margin: theme.spacing.unit,
  },
  leftColumn: {
    margin: theme.spacing.unit,
    marginRight: '0px',
  },
  rightColumn: {
    margin: theme.spacing.unit,
  },
  titleAndDescriptionOuter: {
    padding: theme.spacing.unit / 2,
  },
  titleAndDescriptionCard: {
    background: 'transparent',
  },
  titleAndDescription: {
    padding: theme.spacing.unit / 2,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    textTransform: 'none',
  },
  button: {
    padding: `3px ${theme.spacing.unit / 2}px`,
    whiteSpace: 'nowrap',
    minWidth: 'unset',
    textTransform: 'unset',
  },
  timeAgo: {
    whiteSpace: 'nowrap',
    margin: theme.spacing.unit / 2,
  },
  commentCount: {
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    margin: theme.spacing.unit / 2,
  },
  author: {
    whiteSpace: 'nowrap',
    margin: theme.spacing.unit / 2,
  },
  voteIconButton: {
    fontSize: '2em',
    padding: '0px',
  },
  voteIconButtonUp: {
    borderRadius: '80% 80% 50% 50%',
  },
  voteIconButtonDown: {
    borderRadius: '50% 50% 80% 80%',
  },
  voteCount: {
    lineHeight: '1em',
    fontSize: '0.9em',
  },
  expressionButton: {
    display: 'inline-block',
  },
  expression: {
    display: 'inline-block',
    fontSize: '4em',
    transform: 'scale(.25) translateY(1.1em)',
    margin: '-1em -.333em',
  },
  bottomBarLine: {
    display: 'flex',
    alignItems: 'center', // TODO properly center items, neither center nor baseline works here
  },
  grow: {
    flexGrow: 1,
  },
  bottomBar: {
    margin:  theme.spacing.unit,
    marginTop: `-${theme.spacing.unit / 2}px`,
    display: 'flex',
    alignItems: 'center',
  },
  commentSection: {
    marginTop: theme.spacing.unit * 2,
  },
  nothing: {
    margin: theme.spacing.unit * 4,
    color: theme.palette.text.hint,
  },
  funding: {
    margin:  theme.spacing.unit,
    marginBottom: '0px',
    maxWidth: '400px',
  },
  fundingAmount: {
    fontSize: '1.1em',
  },
  fundingGoal: {
    fontSize: '0.8em',
  },
  fundingAmountReached: {
    fontSize: '1.2em',
  },
  fundingGoalReached: {
    fontSize: '0.8em',
  },
  fundingBar: {
    backgroundColor: theme['custom'] && theme['custom'].funding,
  },
  fundingBarBackground: {
    backgroundColor: theme.palette.grey[theme.palette.type === 'light' ? 300 : 700],
  },
  fundingBarNoGoal: {
    background: `linear-gradient(to left, transparent 20px, ${theme['custom'] && theme['custom'].funding} 100%)`,
    opacity: 0.4,
  },
  fundingBarBackgroundNoGoal: {
    background: `linear-gradient(to right, ${theme.palette.grey[theme.palette.type === 'light' ? 300 : 700]}, transparent 100%)`,
  },
});

export type PostVariant = 'list'|'page';

interface Props {
  server:Server;
  idea?:Client.Idea;
  variant:PostVariant;
  /**
   * If true, when post is clicked,
   * variant is switched from 'list' to 'page',
   * url is appended with /post/<postId>
   * and post is expanded to full screen.
   */
  expandable?:boolean;
  display?:Client.PostDisplay;
  onClickTag?:(tagId:string)=>void;
  onClickCategory?:(categoryId:string)=>void;
  onClickStatus?:(statusId:string)=>void;
}

interface ConnectProps {
  configver?:string;
  projectId:string;
  category?:Client.Category;
  credits?:Client.Credits;
  maxFundAmountSeen:number;
  authorUser?:Client.User;
  loggedInUser?:Client.User;
  commentsStatus?:Status;
  comments?:(Client.CommentWithAuthor|undefined)[]
  commentCursor?:string;
  updateVote: (voteUpdate:Partial<Client.VoteUpdate>)=>void;
}

interface State {
  expressionExpandedAnchor?:HTMLElement;
}

export const isExpanded = ():boolean => !!Post.expandedPath;

class Post extends Component<Props&ConnectProps&RouteComponentProps&WithStyles<typeof styles, true>, State> {
  /**
   * Transitions:
   * post
   * post1 -> post2
   * post -> category
   * category -> post
   * category -> post -> category
   * 
   * Edge case transitions:
   * post1 -> post1
   * category -> post1 -> post1
   * category -> post1 -> post2
   * 
   */
  /**
   * expandedPath allows a page transition from a list of posts into a
   * single post without having to render a new page.
   */
  static expandedPath:string|undefined;
  expandedPath:string|undefined;

  constructor(props) {
    super(props);
    this.state = {};
  }

  componentWillUnmount() {
    if(Post.expandedPath === this.expandedPath) {
      Post.expandedPath = undefined;
    }
  }

  render() {
    var forceExpand = false;
    if(this.expandedPath) {
      if(this.expandedPath !== Post.expandedPath) {
        this.expandedPath = undefined;
      } else if(this.expandedPath !== this.props.location.pathname) {
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
                disabled={!this.props.expandable || variant === 'page'}
                onClick={this.onExpand.bind(this)}
                classes={{
                  focusHighlight: this.props.classes.titleAndDescriptionCard,
                }}
              >
                {this.renderTitle(variant)}
                {this.renderDescription(variant)}
              </CardActionArea>
            </div>
            {this.renderBottomBar(variant)}
            {this.renderComments(variant)}
          </div>
        </div>
      </Expander>
      </Loader>
    );
  }

  renderBottomBar(variant:PostVariant) {
    const leftSide = [
      this.renderExpression(variant),
      this.renderCommentCount(variant),
      this.renderCreatedDatetime(variant),
      this.renderAuthor(variant),
    ].filter(i => !!i);
    const rightSide = [
      this.renderStatus(variant),
      this.renderCategory(variant),
      ...(this.renderTags(variant) || []),
    ].filter(i => !!i);

    if(leftSide.length + rightSide.length === 0) return null;

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

  renderAuthor(variant:PostVariant) {
    if(variant !== 'page' && this.props.display && this.props.display.showAuthor === false
      || !this.props.authorUser) return null;

    return (
      <Typography className={this.props.classes.author} variant='caption' inline>
        {this.props.authorUser.name}
      </Typography>
    );
  }

  renderCreatedDatetime(variant:PostVariant) {
    if(variant !== 'page' && this.props.display && this.props.display.showCreated === false
      || !this.props.idea) return null;

    return (
      <Typography className={this.props.classes.timeAgo} variant='caption' inline>
        <TimeAgo date={this.props.idea.created} />
      </Typography>
    );
  }

  renderCommentCount(variant:PostVariant) {
    if(this.props.display && this.props.display.showCommentCount === false
      || variant === 'page'
      || !this.props.idea
      || !this.props.category
      || !this.props.category.support.comment) return null;

    return (
      <Typography className={this.props.classes.commentCount} variant='caption' inline>
        <SpeechIcon fontSize='inherit' />
        &nbsp;
        {this.props.idea.commentCount || 0}
      </Typography>
    );
  }

  renderComments(variant:PostVariant) {
    if(variant !== 'page'
      || !this.props.idea
      || !this.props.category
      || !this.props.category.support.comment) return null;

    if(!this.props.commentsStatus) {
      this.props.server.dispatch().commentList({
        projectId: this.props.server.getProjectId(),
        ideaId: this.props.idea.ideaId,
      });
    }

    // TODO infinite scroll this.props.commentCursor
    return (
      <div className={this.props.classes.commentSection}>
        <Loader loaded={!!this.props.comments}>
          {this.props.comments && (this.props.comments.length > 0 ? (this.props.comments.map(comment => (
            <Comment comment={comment} />
          ))) : (
            <Typography variant='overline' className={this.props.classes.nothing}>Nothing found</Typography>
          ))}
        </Loader>
      </div>
    );
  }

  renderStatus(variant:PostVariant) {
    if(variant !== 'page' && this.props.display && this.props.display.showStatus === false
      || !this.props.idea
      || !this.props.idea.statusId
      || !this.props.category) return null;

    const status = this.props.category.workflow.statuses.find(s => s.statusId === this.props.idea!.statusId);
    if(!status) return null;

    return (
      <Button variant="text" className={this.props.classes.button} disabled={!this.props.onClickStatus || variant === 'page'}
        onClick={e => this.props.onClickStatus && this.props.onClickStatus(status.statusId)}>
        <Typography variant='caption' style={{color: status.color}}>
          {status.name}
        </Typography>
      </Button>
    );
  }

  renderTags(variant:PostVariant) {
    if(variant !== 'page' && this.props.display && this.props.display.showTags === false
      || !this.props.idea
      || this.props.idea.tagIds.length === 0
      || !this.props.category) return null;

    return this.props.idea.tagIds
    .map(tagId => this.props.category!.tagging.tags.find(t => t.tagId === tagId))
    .filter(tag => !!tag)
    .map(tag => (
      <Button variant="text" className={this.props.classes.button} disabled={!this.props.onClickTag || variant === 'page'}
        onClick={e => this.props.onClickTag && this.props.onClickTag(tag!.tagId)}>
        <Typography variant='caption' style={{color: tag!.color}}>
          {tag!.name}
        </Typography>
      </Button>
    ));
  }

  renderCategory(variant:PostVariant) {
    if(variant !== 'page' && this.props.display && this.props.display.showCategoryName === false
      || !this.props.idea
      || !this.props.category) return null;
      
    return (
      <Button variant="text" className={this.props.classes.button} disabled={!this.props.onClickCategory || variant === 'page'}
        onClick={e => this.props.onClickCategory && this.props.onClickCategory(this.props.category!.categoryId)}>
        <Typography variant='caption' style={{color: this.props.category.color}}>
          {this.props.category.name}
        </Typography>
      </Button>
    );
  }

  renderVoting(variant:PostVariant) {
    if(variant !== 'page' && this.props.display && this.props.display.showVoting === false
      || !this.props.idea
      || !this.props.category
      || !this.props.category.support.vote) return null;

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <IconButton className={`${this.props.classes.voteIconButton} ${this.props.classes.voteIconButtonUp}`}
          onClick={e => this.props.updateVote({vote: Client.VoteUpdateVoteEnum.Upvote})}>
          <UpvoteIcon fontSize='inherit' />
        </IconButton>
        <Typography variant='overline' className={this.props.classes.voteCount}>
          {this.props.idea.voteValue || 0}
        </Typography>
        
        {this.props.category.support.vote.enableDownvotes && (
          <IconButton className={`${this.props.classes.voteIconButton} ${this.props.classes.voteIconButtonDown}`}
            onClick={e => this.props.updateVote({vote: Client.VoteUpdateVoteEnum.Downvote})}>
            <DownvoteIcon fontSize='inherit' />
          </IconButton>
        )}
      </div>
    );
  }

  renderFunding(variant:PostVariant) {
    if(variant !== 'page' && this.props.display && this.props.display.showFunding === false
      || !this.props.idea
      || !this.props.credits
      || !this.props.category
      || !this.props.category.support.fund) return null;

    const fundGoal = this.props.idea.fundGoal && this.props.idea.fundGoal > 0
      ? this.props.idea.fundGoal : undefined;
    const fundPerc = Math.floor(100 * (this.props.idea.funded || 0) / (fundGoal || this.props.maxFundAmountSeen));
    const fundingReached = fundGoal ? (this.props.idea.funded || 0) >= fundGoal : false;
    const fundAmountDisplay = (
      <Typography variant='body1' inline>
        <span className={fundingReached ? this.props.classes.fundingAmountReached : this.props.classes.fundingAmount}>
          <CreditView val={this.props.idea.funded || 0} credits={this.props.credits} />
          {fundGoal && (<span>&nbsp;/&nbsp;</span>)}
        </span>
      </Typography>
    );
    const fundGoalDisplay = (
      <Typography variant='body1' inline>
        <span className={fundingReached ? this.props.classes.fundingGoalReached : this.props.classes.fundingGoal} style={{
          display: 'flex',
          alignItems: 'flex-end',
          lineHeight: 'normal',
        }}>
          {fundGoal && (<CreditView val={this.props.idea.fundGoal || 0} credits={this.props.credits} />)}
          &nbsp;raised
        </span>
      </Typography>
    );
    const fundPercDisplay = fundGoal && [
      <div style={{ flexGrow: 1 }}>&nbsp;</div>,
      <Typography variant='body1' inline>
        <span className={fundingReached ? this.props.classes.fundingGoalReached : this.props.classes.fundingGoal}>
          {fundPerc}
          &nbsp;%
        </span>
      </Typography>,
    ];
    return (
      <div className={this.props.classes.funding}>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
        }}>
          {fundAmountDisplay}
          {fundGoalDisplay}
          {fundPercDisplay}
        </div>
        <LinearProgress value={Math.min(fundPerc, 100)} variant='determinate'
          className={this.props.classes.fundingBar}
          classes={{
            colorPrimary: fundGoal ? this.props.classes.fundingBarBackground : this.props.classes.fundingBarBackgroundNoGoal,
            barColorPrimary: fundGoal ? this.props.classes.fundingBar : this.props.classes.fundingBarNoGoal,
          }}
        />
      </div>
    );
  }

  renderExpression(variant:PostVariant) {
    if(variant !== 'page' && this.props.display && this.props.display.showExpression === false
      || !this.props.idea
      || !this.props.idea.expressions
      || !this.props.category
      || !this.props.category.support.express) return null;

    const full = (
      <div>
        {this.props.idea.expressions.map(expression => (
        <Button variant="text" className={`${this.props.classes.button} ${this.props.classes.expressionButton}`}>
          <span className={this.props.classes.expression}>{expression.display}</span>
          &zwj;
          <Typography variant='caption' inline>{expression.count}</Typography>
        </Button>
        ))}
      </div>
    );

    const summaryItems:React.ReactNode[] = [];
    var summaryCount = 0;
    this.props.idea.expressions.forEach((expression, index) => {
      if(index < 3) summaryItems.push((
        <Typography variant='caption' inline style={{
          color: 'unset',
          fontSize: 'unset',
        }}>
          <span className={this.props.classes.expression}>{expression.display}</span>
        </Typography>
      ));
      summaryCount += expression.count;
    });
    const summary = (
      <div style={{
        display: 'flex',
        alignItems: 'center',
      }}>
        {summaryItems}
        {summaryCount > 1 && (
          <Typography variant='caption' inline>{summaryCount}</Typography>
        )}
      </div>
    );

    return [
      <Button
        className={this.props.classes.button}
        onClick={e => this.setState({expressionExpandedAnchor: e.currentTarget})}
      >
        {summary}
      </Button>,
      <Popover
        open={!!this.state.expressionExpandedAnchor}
        anchorEl={this.state.expressionExpandedAnchor}
        onClose={() => this.setState({expressionExpandedAnchor: undefined})}
        anchorOrigin={{ vertical: 'center', horizontal: 'center', }}
        transformOrigin={{ vertical: 'center', horizontal: 'center', }}
      >
        {full}
      </Popover>
    ];
  }

  renderTitle(variant:PostVariant) {
    if(!this.props.idea
      || !this.props.idea.title) return null;
    return (
      <Typography variant='subtitle1'>
        {variant !== 'page' && this.props.display && this.props.display.titleTruncateLines !== undefined && this.props.display.titleTruncateLines > 0
          ? (<TruncateMarkup lines={this.props.display.titleTruncateLines}><div>{this.props.idea.title}</div></TruncateMarkup>)
          : this.props.idea.title}
      </Typography>
    );
  }

  renderDescription(variant:PostVariant) {
    if(variant !== 'page' && this.props.display && this.props.display.showDescription === false
      || !this.props.idea
      || !this.props.idea.description) return null;
    return (
      <Typography variant='body1'>
        {variant !== 'page' && this.props.display && this.props.display.descriptionTruncateLines !== undefined && this.props.display.descriptionTruncateLines > 0
          ? (<TruncateMarkup lines={this.props.display.descriptionTruncateLines}><div>{this.props.idea.description}</div></TruncateMarkup>)
          : this.props.idea.description}
      </Typography>
    );
  }

  onExpand() {
    if(!this.props.expandable || !this.props.idea) return;
    this.expandedPath = `${this.props.match.url}/post/${this.props.idea.ideaId}`;
    Post.expandedPath = this.expandedPath;
    this.props.history.push(this.expandedPath);
  }
}

export default connect<ConnectProps,{},Props,ReduxState>((state:ReduxState, ownProps:Props):ConnectProps => {
  var authorUser, commentsStatus, comments, commentCursor;
  if(ownProps.idea) {
    const user = state.users.byId[ownProps.idea.authorUserId];
    if(!user) {
      ownProps.server.dispatch().userGet({
        projectId: state.projectId,
        userId: ownProps.idea.authorUserId,
      });
    } else {
      authorUser = user.user;
    }
    const commentsByIdeaId = state.comments.byIdeaId[ownProps.idea.ideaId];
    commentsStatus = commentsByIdeaId && commentsByIdeaId.status;
    if(commentsByIdeaId && commentsByIdeaId.status === Status.FULFILLED && commentsByIdeaId.commentIds) {
      commentCursor = commentsByIdeaId.cursor;
      comments = commentsByIdeaId.commentIds.map(commentId => {
        const comment = state.comments.byId[commentId];
        if(!comment || !comment.comment) return undefined;
        if(!comment.comment.authorUserId) return comment.comment;
        const commentAuthorUser = state.users.byId[comment.comment.authorUserId]
        return {...comment.comment, author: commentAuthorUser ? commentAuthorUser.user : undefined};
      });
    }
  }
  return {
    configver: state.conf.ver, // force rerender on config change
    projectId: state.projectId,
    authorUser: authorUser,
    category: (ownProps.idea && state.conf.conf)
      ? state.conf.conf.content.categories.find(c => c.categoryId === ownProps.idea!.categoryId)
      : undefined,
    credits: state.conf.conf
      ? state.conf.conf.credits
      : undefined,
    maxFundAmountSeen: state.ideas.maxFundAmountSeen,
    loggedInUser: state.users.loggedIn.user,
    commentsStatus: commentsStatus,
    comments: comments,
    commentCursor: commentCursor,
    updateVote: (voteUpdate:Partial<Client.VoteUpdate>) => ownProps.server.dispatch().voteUpdate({
      projectId: state.projectId,
      ideaId: ownProps.idea!.ideaId,
      update: {
        ...voteUpdate,
        voterUserId: state.users.loggedIn.user!.userId,
      },
    }),
  };
})(withStyles(styles, { withTheme: true })(withRouter(Post)));

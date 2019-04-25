import React, { Component } from 'react';
import * as Client from '../../api/client';
import { Typography, CardActionArea, Grid, Button, IconButton, LinearProgress, Popover } from '@material-ui/core';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import Loader from './Loader';
import { withRouter, RouteComponentProps } from 'react-router';
import { connect } from 'react-redux';
import { ReduxState, Server } from '../../api/server';
import TimeAgo from 'react-timeago'
import SpeechIcon from '@material-ui/icons/CommentOutlined';
import UpvoteIcon from '@material-ui/icons/ArrowDropUpRounded';
import DownvoteIcon from '@material-ui/icons/ArrowDropDownRounded';
import Truncate from 'react-truncate';
import CreditView from '../../common/config/CreditView';
import HelpPopover from '../../common/HelpPopover';

const styles = (theme:Theme) => createStyles({
  cardContainer: {
  },
  cardContainerLeftColumn: {
    margin: theme.spacing.unit,
    marginRight: '0px',
  },
  cardContainerRightColumn: {
    margin: theme.spacing.unit,
  },
  titleAndDescriptionOuter: {
    padding: theme.spacing.unit / 2,
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
  separator: {
    margin: theme.spacing.unit / 2,
  },
  bottomBar: {
    margin:  theme.spacing.unit,
    marginTop: `-${theme.spacing.unit / 2}px`,
    display: 'flex',
    alignItems: 'center', // TODO properly center items, neither center nor baseline works here
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

interface Props extends WithStyles<typeof styles>, RouteComponentProps {
  server:Server;
  idea?:Client.Idea;
  variant:PostVariant;
  titleTruncateLines?:number;
  descriptionTruncateLines?:number;
  hideCommentCount?:boolean;
  hideCategoryName?:boolean;
  hideCreated?:boolean;
  hideAuthor?:boolean;
  hideStatus?:boolean;
  hideTags?:boolean;
  hideVoting?:boolean;
  hideFunding?:boolean;
  hideExpression?:boolean;
  hideDescription?:boolean;
  onClickTag?:(tagId:string)=>void;
  onClickCategory?:(categoryId:string)=>void;
  onClickStatus?:(statusId:string)=>void;
  // connect
  projectId:string;
  category?:Client.Category;
  credits?:Client.Credits;
  maxFundAmountSeen:number;
  authorUser?:Client.User;
  updateVote: (voteUpdate:Partial<Client.VoteUpdate>)=>void;
}

interface State {
  expressionExpandedAnchor?:HTMLElement;
}

class Post extends Component<Props, State> {

  constructor(props:Props) {
    super(props);
    this.state = {};
  }

  render() {
    if(this.props.variant !== 'page'){
      var bottomBarItems = this.insertBetween([
        this.renderStatus(),
        this.renderCategory(),
        this.renderTags(),
        this.renderAuthor(),
        this.renderCreatedDatetime(),
        this.renderCommentCount(),
        this.renderExpression(),
      ], (
        <div className={this.props.classes.separator}>·</div>
      ));
      var bottomBar;
      if(bottomBarItems.length > 0) bottomBar = (
        <div className={this.props.classes.bottomBar}>
          {bottomBarItems}
        </div>
      );

      const voting = this.renderVoting();
      return (
        <Loader loaded={!!this.props.idea}>
          <div className={this.props.classes.cardContainer} style={{
            display: 'flex',
            alignItems: 'flex-start',
          }}>
            {voting && (
              <div className={this.props.classes.cardContainerLeftColumn}>
                {voting}
              </div>
            )}
            <div className={this.props.classes.cardContainerRightColumn} style={{
              display: 'flex',
              flexDirection: 'column',
            }}>
              {this.renderFunding()}
              <div className={this.props.classes.titleAndDescriptionOuter}>
                <CardActionArea className={this.props.classes.titleAndDescription} onClick={() => {
                  this.props.history.push(`/${this.props.projectId}/post/${this.props.idea!.ideaId}`);
                }}>
                  {this.renderTitle()}
                  {this.renderDescription(2)}
                </CardActionArea>
              </div>
              {bottomBar}
            </div>
          </div>
        </Loader>
      );
    } else {
      return (
        <Grid
          container
          direction='row'
        >
          <Grid item xs={4}>
            {this.renderExpression()}
          </Grid>
          <Grid item xs={4}>
            <Typography variant='subtitle2'>{this.props.idea && this.props.idea.title || 'Loading...'}</Typography>
            <Typography variant='body1'>{this.props.idea && this.props.idea.description}</Typography>
          </Grid>
        </Grid>

      );
    }
  }

  renderAuthor() {
    if(this.props.hideAuthor
      || !this.props.authorUser) return null;

    return (
      <Typography className={this.props.classes.author} variant='caption' inline>
        {this.props.authorUser.name}
      </Typography>
    );
  }

  renderCreatedDatetime() {
    if(this.props.hideCreated
      || !this.props.idea) return null;

    return (
      <Typography className={this.props.classes.timeAgo} variant='caption' inline>
        <TimeAgo date={this.props.idea.created} />
      </Typography>
    );
  }

  renderCommentCount() {
    if(this.props.hideCommentCount
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

  renderStatus() {
    if(this.props.hideStatus
      || !this.props.idea
      || !this.props.idea.statusId
      || !this.props.category) return null;

    const status = this.props.category.workflow.statuses.find(s => s.statusId === this.props.idea!.statusId);
    if(!status) return null;

    return (
      <Button variant="text" className={this.props.classes.button} disabled={!this.props.onClickStatus}
        onClick={e => this.props.onClickStatus && this.props.onClickStatus(status.statusId)}>
        <Typography variant='caption' style={{color: status.color}}>
          {status.name}
        </Typography>
      </Button>
    );
  }

  renderTags() {
    if(this.props.hideTags
      || !this.props.idea
      || this.props.idea.tagIds.length === 0
      || !this.props.category) return null;

    return this.props.idea.tagIds
    .map(tagId => this.props.category!.tagging.tags.find(t => t.tagId === tagId))
    .filter(tag => !!tag)
    .map(tag => (
      <Button variant="text" className={this.props.classes.button} disabled={!this.props.onClickTag}
        onClick={e => this.props.onClickTag && this.props.onClickTag(tag!.tagId)}>
        <Typography variant='caption' style={{color: tag!.color}}>
          {tag!.name}
        </Typography>
      </Button>
    ));
  }

  renderCategory() {
    if(this.props.hideCategoryName
      || !this.props.idea
      || !this.props.category) return null;
      
    return (
      <Button variant="text" className={this.props.classes.button} disabled={!this.props.onClickCategory}
        onClick={e => this.props.onClickCategory && this.props.onClickCategory(this.props.category!.categoryId)}>
        <Typography variant='caption' style={{color: this.props.category.color}}>
          {this.props.category.name}
        </Typography>
      </Button>
    );
  }

  renderVoting() {
    if(this.props.hideVoting
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

  renderFunding() {
    if(this.props.hideFunding
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

  renderExpression(showExpanded:boolean = false) {
    if(this.props.hideExpression
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

    if(showExpanded) return full;

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
        // onMouseOver={e => this.setState({expressionExpandedAnchor: e.currentTarget})}
        onClick={e => this.setState({expressionExpandedAnchor: e.currentTarget})}
      >
        {summary}
      </Button>,
      <Popover
        open={!!this.state.expressionExpandedAnchor}
        anchorEl={this.state.expressionExpandedAnchor}
        onClose={() => this.setState({expressionExpandedAnchor: undefined})}
        anchorOrigin={{ vertical: 'center', horizontal: 'left', }}
        transformOrigin={{ vertical: 'center', horizontal: 'left', }}
      >
        {full}
      </Popover>
    ];
  }

  renderTitle() {
    if(!this.props.idea
      || !this.props.idea.title) return null;
    return (
      <Typography variant='subtitle2'>
        {this.props.titleTruncateLines !== undefined && this.props.titleTruncateLines > 0
          ? (<Truncate lines={this.props.titleTruncateLines}>{this.props.idea.title}</Truncate>)
          : this.props.idea.title}
      </Typography>
    );
  }

  renderDescription(truncateToLines:number|undefined = undefined) {
    if(this.props.hideDescription
      || !this.props.idea
      || !this.props.idea.description) return null;
    return (
      <Typography variant='body1'>
        {this.props.descriptionTruncateLines !== undefined && this.props.descriptionTruncateLines > 0
          ? (<Truncate lines={this.props.descriptionTruncateLines}>{this.props.idea.description}</Truncate>)
          : this.props.idea.description}
      </Typography>
    );
  }

  insertBetween(items:any[], insert:any) {
    return items
      .filter(i => !!i)
      .map((val, index) => index === 0
        ? val
        : [insert,val]);
  }
}

export default connect<any,any,any,any>((state:ReduxState, ownProps:Props) => {
  var authorUser;
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
  }
  return {
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
    updateVote: (voteUpdate:Partial<Client.VoteUpdate>) => ownProps.server.dispatch().voteUpdate({
      projectId: ownProps.projectId,
      ideaId: ownProps.idea!.ideaId,
      update: {
        ...voteUpdate,
        voterUserId: state.users.loggedIn.user!.userId,
      },
    }),
  };
})(withRouter(withStyles(styles, { withTheme: true })(Post)));

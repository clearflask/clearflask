import React, { Component } from 'react';
import * as Client from '../../api/client';
import { Typography, CardActionArea, Grid, Button, IconButton, LinearProgress } from '@material-ui/core';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import Loader from './Loader';
import { withRouter, RouteComponentProps } from 'react-router';
import { connect } from 'react-redux';
import { ReduxState, Server } from '../../api/server';
import TimeAgo from 'react-timeago'
import SpeechIcon from '@material-ui/icons/CommentOutlined';
import UpvoteIcon from '@material-ui/icons/ArrowDropUpRounded';
import DownvoteIcon from '@material-ui/icons/ArrowDropDownRounded';

const styles = (theme:Theme) => createStyles({
  titleAndDescription: {
    margin: theme.spacing.unit,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  button: {
    padding: '3px 8px',
  },
  fundingHeight: {
    height: '35px',
  },
  voteIconButton: {
    fontSize: '2em',
    padding: '0px',
  },
  voteIconButtonUp: {
    borderRadius: '80% 80% 50% 50%',
    // paddingBottom: '20px',
    // marginBottom: '-20px',
  },
  voteIconButtonDown: {
    borderRadius: '50% 50% 80% 80%',
    // paddingTop: '20px',
    // marginTop: '-20px',
  },
  voteCount: {
    lineHeight: '1em',
    fontSize: '0.9em',
  },
  expressionButton: {
    minWidth: 'unset',
  },
  expression: {
    display: 'inline-block',
    fontSize: '4em',
    transform: 'scale(.25)',
    margin: '-1em -.333em',
  },
  separator: {
    margin: theme.spacing.unit,
  },
  fundingReached: {
  },
  fundingFunding: {
  },
});

export type PostVariant = 'title'|'full'|'page';

interface Props extends WithStyles<typeof styles>, RouteComponentProps {
  server:Server;
  idea?:Client.Idea;
  variant:PostVariant;
  hideCommentCount?:boolean;
  hideCategoryName?:boolean;
  hideCreated?:boolean;
  hideAuthor?:boolean;
  hideStatus?:boolean;
  hideTags?:boolean;
  hideVoting?:boolean;
  hideFunding?:boolean;
  hideExpression?:boolean;
  hideTitle?:boolean;
  hideDescription?:boolean;
  onClickTag?:(tagId:string)=>void;
  onClickCategory?:(categoryId:string)=>void;
  onClickStatus?:(statusId:string)=>void;
  // connect
  projectId:string;
  category?:Client.Category;
  authorUser?:Client.User;
  updateVote: (voteUpdate:Partial<Client.VoteUpdate>)=>void;
}

class Post extends Component<Props> {
  render() {
    var todoRemoveMe = {
      // border: '1px dotted',
    };

    var authorDisplay;
    if(!this.props.hideAuthor && this.props.authorUser) authorDisplay = (
      <Typography variant='caption' inline>
        {this.props.authorUser.name}
      </Typography>
    );

    var createdDisplay;
    if(!this.props.hideCreated && this.props.idea) createdDisplay = (
      <Typography variant='caption' inline>
        <TimeAgo date={this.props.idea.created} />
      </Typography>
    );

    var commentCountDisplay;
    if(!this.props.hideCommentCount && this.props.idea && this.props.category && this.props.category.support.comment) commentCountDisplay = (
      <Typography variant='caption' inline style={{
        display: 'flex',
        alignItems: 'center',
      }}>
        <SpeechIcon fontSize='inherit' />
        &nbsp;
        {this.props.idea.commentCount || 0}
      </Typography>
    );

    var statusDisplay;
    if(!this.props.hideStatus && this.props.idea && this.props.idea.statusId && this.props.category) {
      const status = this.props.category.workflow.statuses.find(s => s.statusId === this.props.idea!.statusId);
      if(status) statusDisplay = (
        <Button variant="text" className={this.props.classes.button} disabled={!this.props.onClickStatus}
          onClick={e => this.props.onClickStatus && this.props.onClickStatus(this.props.category!.categoryId)}>
          <Typography variant='overline' style={{color: status.color}}>
            {status.name}
          </Typography>
        </Button>
      );
    }

    var tagsDisplay;
    if(!this.props.hideTags && this.props.idea && this.props.idea.tagIds.length > 0 && this.props.category) tagsDisplay = this.props.idea.tagIds
    .map(tagId => this.props.category!.tagging.tags.find(t => t.tagId === tagId))
    .filter(tag => !!tag)
    .map(tag => (
      <Button variant="text" className={this.props.classes.button} disabled={!this.props.onClickTag}
        onClick={e => this.props.onClickTag && this.props.onClickTag(tag!.tagId)}>
        <Typography variant='overline' style={{color: tag!.color}}>
          {tag!.name}
        </Typography>
      </Button>
    ));

    var categoryName;
    if(!this.props.hideCategoryName && this.props.idea && this.props.category) categoryName = (
      <Button variant="text" className={this.props.classes.button} disabled={!this.props.onClickCategory}
        onClick={e => this.props.onClickCategory && this.props.onClickCategory(this.props.category!.categoryId)}>
        <Typography variant='overline' style={{color: this.props.category.color}}>
          {this.props.category.name}
        </Typography>
      </Button>
    );

    var fundingDisplay;
    if(!this.props.hideFunding && this.props.idea && this.props.category && this.props.category.support.fund) {
      var progress;
      if(this.props.idea.fundGoal && this.props.idea.fundGoal > 0) {
        const funded = this.props.idea.funded || 0;
        const fundPerc = Math.round(100 * funded / this.props.idea.fundGoal);
        const fundingReached = funded >= this.props.idea.fundGoal;
        progress = (
          <LinearProgress value={fundPerc} variant='determinate' classes={{
            bar: fundingReached ? this.props.classes.fundingReached : this.props.classes.fundingFunding
          }}/>
        );
      } else {

      }
      fundingDisplay = (
        <div style={{
          ...todoRemoveMe,
        }} className={this.props.classes.fundingHeight}>
          {progress}
        </div>
      );
    }

    var votingDisplay;
    if(!this.props.hideVoting && this.props.idea && this.props.category && this.props.category.support.vote) votingDisplay = (
      <div style={{
        ...todoRemoveMe,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        {fundingDisplay && (<div className={this.props.classes.fundingHeight}>&nbsp;</div>)}
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

    var expressionDisplay;
    if(this.props.variant !== 'title' && !this.props.hideExpression && this.props.category && this.props.category.support.express) expressionDisplay = (
      <div style={{
        ...todoRemoveMe,
      }}>
        {this.getExpression()}
      </div>
    );

    var titleDisplay = (
      <Typography variant='subtitle2'>
        {this.props.idea && this.props.idea.title}
      </Typography>
    );

    var descriptionDisplay;
    if(this.props.variant !== 'title') descriptionDisplay = (
      <Typography variant='body1'>
        {this.props.idea && this.props.idea.description}
      </Typography>
    );

    if(this.props.variant !== 'page'){
      return (
        <Loader loaded={!!this.props.idea}>
          <div style={{
            display: 'flex',
            ...todoRemoveMe,
          }}>
            {votingDisplay}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
            }}>
              {fundingDisplay}
              <CardActionArea className={this.props.classes.titleAndDescription} onClick={() => {
                this.props.history.push(`/${this.props.projectId}/post/${this.props.idea!.ideaId}`);
              }}>
                {titleDisplay}
                {descriptionDisplay}
              </CardActionArea>
              <div style={{
                display: 'flex',
                ...todoRemoveMe,
                marginTop: '-8px',
                alignItems: 'center', // TODO properly center items, neither center nor baseline works here
              }}>
                {[statusDisplay, categoryName, tagsDisplay, commentCountDisplay, authorDisplay, createdDisplay, expressionDisplay]
                  .filter(i => !!i).map((val, index) => index === 0
                    ? val : [(<div className={this.props.classes.separator}>·</div>),val])}
              </div>
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
            {expressionDisplay}
          </Grid>
          <Grid item xs={4}>
            <Typography variant='subtitle2'>{this.props.idea && this.props.idea.title || 'Loading...'}</Typography>
            <Typography variant='body1'>{this.props.idea && this.props.idea.description}</Typography>
          </Grid>
        </Grid>

      );
    }
  }

  getExpression() {
    if(!this.props.idea || !this.props.idea.expressions) return null;
    return (
      <div>
        {this.props.idea.expressions.map(expression => (
        <Button variant="text" className={`${this.props.classes.button} ${this.props.classes.expressionButton}`}>
          <span className={this.props.classes.expression}>{expression.display}</span>
          &zwj;
          {expression.count > 1 && (
            <Typography variant='caption' inline>{expression.count}</Typography>
          )}
        </Button>
        ))}
      </div>
    )
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

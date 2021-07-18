import { createStyles, makeStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { CSSProperties } from '@material-ui/core/styles/withStyles';
import ArrowLeftIcon from '@material-ui/icons/ArrowLeftRounded';
import ArrowRightIcon from '@material-ui/icons/ArrowRightRounded';
import MergeIcon from '@material-ui/icons/MergeType';
import classNames from 'classnames';
import React, { Component } from 'react';
import * as Client from '../../api/client';
import { Server } from '../../api/server';
import HelpPopper from '../../common/HelpPopper';
import LinkAltIcon from '../../common/icon/LinkAltIcon';
import Post from './Post';

export type ConnectType = 'link' | 'merge';
export type LinkDirection = 'to' | 'from';

export const OutlineParentMergeNeighboursApplyStyles: Record<string, string | CSSProperties> = {
  display: 'flex',
  flexDirection: 'column',
  '& > *': {
  },
  '& > *:not(:first-child)': {
    marginTop: 0,
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  '& > *:not(:last-child)': {
    marginBottom: 0,
    // borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
};

const styles = (theme: Theme) => createStyles({
  postAsLinksContainer: {
    display: 'flex',
    alignItems: 'flex-start',
  },
  postAsLinks: {
    minWidth: 0,
    ...OutlineParentMergeNeighboursApplyStyles,
  },
  isLinkLabel: {
    margin: theme.spacing(5, 1),
    fontSize: '1.4em',
    display: 'flex',
    alignItems: 'center',
  },
  isLinkIcon: {
    color: theme.palette.text.hint,
    fontSize: '1.6em',
  },
  isLinkArrowIcon: {
    color: theme.palette.text.hint,
    fontSize: '1.2em',
  },
  outline: {
    margin: theme.spacing(0.5),
    padding: theme.spacing(1, 3),
    border: '1px solid ' + theme.palette.divider,
    transition: theme.transitions.create(['border-color']),
    borderRadius: 20,
  },
  outlineHidden: {
    borderColor: 'transparent',
  },
});
const useStyles = makeStyles(styles);
interface Props {
  server: Server;
  containerPost: Client.Idea;
  post: Client.Idea;
  type: ConnectType;
  direction: LinkDirection;
  hideOutline?: boolean;
  onClickPost?: (postId: string) => void;
  onUserClick?: (userId: string) => void;
}
interface State {
  isSubmitting?: boolean;
}
class ConnectedPost extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = {};
  render() {
    return (
      <OutlinePostContent hideOutline={this.props.hideOutline}>
        <Post
          server={this.props.server}
          idea={this.props.post}
          onClickPost={this.props.onClickPost}
          onUserClick={this.props.onUserClick}
          widthExpand
          expandable
          isSubmittingDisconnect={this.state.isSubmitting}
          disconnectType={this.props.type}
          onDisconnect={async () => {
            this.setState({ isSubmitting: true });
            try {
              const ideaId = this.props.direction === 'to' ? this.props.containerPost.ideaId : this.props.post.ideaId;
              const parentIdeaId = this.props.direction === 'to' ? this.props.post.ideaId : this.props.containerPost.ideaId;
              if (this.props.type === 'link') {
                await (await this.props.server.dispatchAdmin()).ideaUnLinkAdmin({
                  projectId: this.props.server.getProjectId(),
                  ideaId,
                  parentIdeaId,
                });
              } else if (this.props.type === 'merge') {
                await (await this.props.server.dispatchAdmin()).ideaUnMergeAdmin({
                  projectId: this.props.server.getProjectId(),
                  ideaId,
                  parentIdeaId,
                });
              }
            } finally {
              this.setState({ isSubmitting: false });
            }
          }}
          variant='list'
          display={{
            titleTruncateLines: 1,
            descriptionTruncateLines: 2,
            responseTruncateLines: 0,
            showCommentCount: true,
            showCategoryName: this.props.containerPost.categoryId !== this.props.post.categoryId,
            showCreated: true,
            showAuthor: true,
            showStatus: false,
            showTags: false,
            showVoting: false,
            showVotingCount: true,
            showFunding: true,
            showExpression: true,
          }}
        />
      </OutlinePostContent>
    );
  }
}
export default withStyles(styles, { withTheme: true })(ConnectedPost);

export const OutlinePostContent = (props: {
  className?: string,
  children?: any,
  hideOutline?: boolean,
}) => {
  const classes = useStyles();
  return (
    <div className={classNames(
      props.className,
      classes.outline,
      props.hideOutline && classes.outlineHidden,
    )}>
      {props.children}
    </div>
  );
}

export const ConnectedPostsContainer = (props: {
  className?: string;
  children?: any;
  type: ConnectType;
  direction: LinkDirection;
  hasMultiple: boolean;
}) => {
  const classes = useStyles();
  const TypeIcon = props.type === 'link' ? LinkAltIcon : MergeIcon;
  return (
    <div className={classes.postAsLinksContainer}>
      <div className={classes.isLinkLabel}>
        <ArrowLeftIcon color='inherit' fontSize='inherit' className={classes.isLinkArrowIcon} style={{ visibility: props.direction === 'to' ? 'hidden' : undefined }} />
        <HelpPopper description={props.type === 'link'
          ? (props.direction === 'to'
            ? (props.hasMultiple ? 'Linked to these posts' : 'Linked to this post')
            : (props.hasMultiple ? 'These posts link here' : 'This post links here'))
          : (props.direction === 'to'
            ? (props.hasMultiple ? 'Merged into these posts' : 'Merged into this post')
            : (props.hasMultiple ? 'These posts are merged into this one' : 'This post is merged into this one'))}>
          <TypeIcon color='inherit' fontSize='inherit' className={classes.isLinkIcon} />
        </HelpPopper>
        <ArrowRightIcon color='inherit' fontSize='inherit' className={classes.isLinkArrowIcon} style={{ visibility: props.direction === 'from' ? 'hidden' : undefined }} />
      </div>
      <div className={classNames(
        props.className,
        classes.postAsLinks,
      )}>
        {props.children}
      </div>
    </div >
  );
}

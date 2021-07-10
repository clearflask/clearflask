import { createStyles, makeStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import * as Client from '../../api/client';
import { Server } from '../../api/server';
import Post from './Post';

const styles = (theme: Theme) => createStyles({
  outlineOuter: {
    margin: theme.spacing(0, -4),
    [theme.breakpoints.down('sm')]: {
      margin: theme.spacing(0, 1),
    },
  },
  outlineInner: {
    padding: theme.spacing(2, 4),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(1, 2),
    },
    border: '1px solid ' + theme.palette.divider,
    borderRadius: 6,
  },
});
const useStyles = makeStyles(styles);
interface Props {
  server: Server;
  post: Client.Idea;
  onClickPost?: (postId: string) => void;
  onUserClick?: (userId: string) => void;
}
class PostAsLink extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    return (
      <OutlinePostContent>
        <Post
          isLink
          server={this.props.server}
          idea={this.props.post}
          onClickPost={this.props.onClickPost}
          onUserClick={this.props.onUserClick}
          variant='list'
          display={{
            titleTruncateLines: 1,
            descriptionTruncateLines: 2,
            responseTruncateLines: 0,
            showCommentCount: true,
            showCategoryName: false,
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

export const OutlinePostContent = (props: {
  children?: any,
}) => {
  const classes = useStyles();
  return (
    <div className={classes.outlineOuter}>
      <div className={classes.outlineInner}>
        {props.children}
      </div>
    </div>
  );
}

export default withStyles(styles, { withTheme: true })(PostAsLink);

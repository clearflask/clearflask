// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import { CSSProperties } from '@material-ui/core/styles/withStyles';
import GitHubIcon from '@material-ui/icons/GitHub';
import MergeIcon from '@material-ui/icons/MergeType';
import classNames from 'classnames';
import React, { useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { ReduxState, Server, Status } from '../../api/server';
import HelpPopper from '../../common/HelpPopper';
import LinkAltIcon from '../../common/icon/LinkAltIcon';
import { ThisOrThat } from '../../common/util/typeUtil';
import Post from './Post';

export type ConnectType = 'link' | 'merge' | 'github';
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
    alignItems: 'center',
  },
  postAsLinks: {
    minWidth: 0,
    ...OutlineParentMergeNeighboursApplyStyles,
  },
  isLinkLabel: {
    margin: theme.spacing(0, 1),
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

export const ConnectedPostById = (props: {
  postId: string;
} & Omit<React.ComponentProps<typeof ConnectedPost>, 'post'>) => {
  const { postId, server, ...ConnectedPostProps } = props;
  const ideaAndStatus = useSelector<ReduxState, { status: Status, idea?: Client.Idea } | undefined>(state => state.ideas.byId[postId], shallowEqual);
  React.useEffect(() => {
    if (ideaAndStatus?.status === undefined) {
      server.dispatch().then(d => d.ideaGet({
        projectId: server.getProjectId(),
        ideaId: postId,
      }));
    }
  }, [ideaAndStatus?.status, postId, server]);

  if (!ideaAndStatus?.idea) return null;

  return (
    <ConnectedPost
      {...ConnectedPostProps}
      server={server}
      post={ideaAndStatus.idea}
    />
  );
}
const ConnectedPost = (props: {
  server: Server;
  post: Client.Idea;
  containerPost?: ThisOrThat<Client.Idea, Partial<Admin.IdeaDraftAdmin>>;
  type: ConnectType;
  direction: LinkDirection;
  hideOutline?: boolean;
  onClickPost?: (postId: string) => void;
  onUserClick?: (userId: string) => void;
  onDisconnect?: () => void;
  PostProps?: Partial<React.ComponentProps<typeof Post>>;
}) => {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  return (
    <OutlinePostContent hideOutline={props.hideOutline}>
      <Post
        postContentSingleLine
        server={props.server}
        idea={props.post}
        onClickPost={props.onClickPost}
        onUserClick={props.onUserClick}
        widthExpand
        expandable
        isSubmittingDisconnect={isSubmitting}
        disconnectType={props.type}
        onDisconnect={((!props.onDisconnect && !props.containerPost?.ideaId) || !props.server.isModOrAdminLoggedIn()) ? undefined : async () => {
          if (props.onDisconnect) {
            props.onDisconnect();
            return;
          }
          if (!props.containerPost?.ideaId || !props.post.ideaId) return;
          setIsSubmitting(true);
          try {
            const ideaId = props.direction === 'to' ? props.containerPost.ideaId : props.post.ideaId;
            const parentIdeaId = props.direction === 'to' ? props.post.ideaId : props.containerPost.ideaId;
            if (props.type === 'link') {
              await (await props.server.dispatchAdmin()).ideaUnLinkAdmin({
                projectId: props.server.getProjectId(),
                ideaId,
                parentIdeaId,
              });
            } else if (props.type === 'merge') {
              await (await props.server.dispatchAdmin()).ideaUnMergeAdmin({
                projectId: props.server.getProjectId(),
                ideaId,
                parentIdeaId,
              });
            }
          } finally {
            setIsSubmitting(false);
          }
        }}
        variant='list'
        display={{
          titleTruncateLines: 1,
          descriptionTruncateLines: 0,
          responseTruncateLines: 0,
          showCommentCount: false,
          showCategoryName: props.containerPost?.categoryId !== props.post.categoryId,
          showCreated: false,
          showAuthor: false,
          showStatus: true,
          showTags: false,
          showVoting: false,
          showVotingCount: false,
          showFunding: false,
          showExpression: false,
        }}
        {...props.PostProps}
      />
    </OutlinePostContent>
  );
}
export default ConnectedPost;

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
  const TypeIcon = props.type === 'link' ? LinkAltIcon
    : (props.type === 'merge' ? MergeIcon : GitHubIcon);
  return (
    <div className={classes.postAsLinksContainer}>
      <div className={classes.isLinkLabel}>
        {/* import ArrowLeftIcon from '@material-ui/icons/ArrowLeftRounded'; */}
        {/* <ArrowLeftIcon color='inherit' fontSize='inherit' className={classes.isLinkArrowIcon} style={{ visibility: props.direction === 'to' ? 'hidden' : undefined }} /> */}
        <HelpPopper description={props.type === 'link'
          ? (props.direction === 'to'
            ? (props.hasMultiple ? 'Linked to these posts' : 'Linked to this post')
            : (props.hasMultiple ? 'These posts link here' : 'This post links here'))
          : (props.type === 'merge' ? (props.direction === 'to'
            ? (props.hasMultiple ? 'Merged into these posts' : 'Merged into this post')
            : (props.hasMultiple ? 'These posts are merged into this one' : 'This post is merged into this one'))
            : 'Linked with GitHub Issue')}>
          <TypeIcon color='inherit' fontSize='inherit' className={classes.isLinkIcon} />
        </HelpPopper>
        {/* import ArrowRightIcon from '@material-ui/icons/ArrowRightRounded'; */}
        {/* <ArrowRightIcon color='inherit' fontSize='inherit' className={classes.isLinkArrowIcon} style={{ visibility: props.direction === 'from' ? 'hidden' : undefined }} /> */}
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

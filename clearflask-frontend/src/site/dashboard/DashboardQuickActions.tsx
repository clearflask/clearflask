import { CardActionArea, Typography } from '@material-ui/core';
import { createStyles, fade, makeStyles, Theme, useTheme } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { useState } from 'react';
import { Droppable } from 'react-beautiful-dnd';
import { shallowEqual, useSelector } from 'react-redux';
import * as Admin from '../../api/admin';
import { ReduxState } from '../../api/server';
import { Project } from '../../api/serverAdmin';
import { FeedbackInstance } from '../../common/config/template/feedback';
import { contentScrollApplyStyles, Orientation } from '../../common/ContentScroll';
import HoverArea from '../../common/HoverArea';
import { FilterControlTitle } from '../../common/search/FilterControls';
import { truncateWithElipsis } from '../../common/util/stringUtil';
import PostList from './PostList';

export const QuickActioDroppableIdPrefix = 'quick-action-';

const styles = (theme: Theme) => createStyles({
  feedbackTitle: {
    margin: theme.spacing(3, 3, 0.5),
  },
  postActionsContainer: {
    height: '100%',
    minWidth: 200,
    maxWidth: 200,
    borderRight: '1px solid ' + theme.palette.grey[300],
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Vertical }),
  },
  postAction: {
    width: 'unset',
    minHeight: 100,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: theme.spacing(1, 3),
    padding: theme.spacing(0.5),
    textAlign: 'center',
    border: '1px solid ' + theme.palette.grey[300],
    borderRadius: 6,
    transition: theme.transitions.create(['color', 'border-color', 'opacity']),
    // borderStyle: 'dashed',
    // borderWidth: 2,
    // outline: 'none',
    // transition: theme.transitions.create(['opacity']),
    // opacity: 0.38,
    // '&:hover': {
    //   opacity: 1,
    // },
  },
  postActionDisabled: {
    opacity: 0.68,
  },
});
const useStyles = makeStyles(styles);

const DashboardQuickActions = (props: {
  activeProject: Project;
  onClickPost: (postId: string) => void;
  onUserClick: (userId: string) => void;
  selectedPostId?: string;
  feedback?: FeedbackInstance | null;
}) => {
  const classes = useStyles();
  const selectedPost = useSelector<ReduxState, Admin.Idea | undefined>(state => !props.selectedPostId ? undefined : state.ideas.byId[props.selectedPostId]?.idea, shallowEqual);
  const [retainSelectedPostId, setRetainSelectedPostId] = useState<{ selected: string, retain: string }>();
  const similarToPostId = retainSelectedPostId?.selected === props.selectedPostId
    ? retainSelectedPostId?.retain : props.selectedPostId;
  const statusAccepted = !props.feedback?.statusIdAccepted ? undefined : props.feedback.categoryAndIndex.category.workflow.statuses.find(s => s.statusId === props.feedback?.statusIdAccepted);

  const nextStatusIds = new Set<string>(selectedPost?.statusId
    && props.feedback?.categoryAndIndex.category.workflow.statuses.find(s => s.statusId === selectedPost?.statusId)?.nextStatusIds
    || []);

  return (
    <div className={classes.postActionsContainer}>
      <FilterControlTitle name='Quick actions' className={classes.feedbackTitle} />
      {props.feedback?.categoryAndIndex.category.workflow.statuses
        .filter(status => status.statusId !== props.feedback?.categoryAndIndex.category.workflow.entryStatus
          && status.statusId !== props.feedback?.statusIdAccepted)
        .map(status => (
          <QuickActionArea
            droppableId={`${QuickActioDroppableIdPrefix}status-to-${status.statusId}`}
            disabled={!nextStatusIds.has(status.statusId)}
            color={status.color}
            onClick={() => {/* TODO */ }}
            title={status.name}
          />
        ))}
      <QuickActionArea
        droppableId={`${QuickActioDroppableIdPrefix}convert-to-task`}
        disabled={!!statusAccepted && !nextStatusIds.has(statusAccepted.statusId)}
        color={statusAccepted?.color}
        onClick={() => {/* TODO */ }}
        title='Convert to task'
      />
      {!similarToPostId ? null : (
        <>
          <FilterControlTitle name='Merge with similar' className={classes.feedbackTitle} />
          <PostList
            key={props.activeProject.server.getProjectId()}
            server={props.activeProject.server}
            search={{ similarToIdeaId: similarToPostId }}
            layout='similar-merge-action'
            onClickPost={postId => {
              setRetainSelectedPostId({
                selected: postId,
                retain: similarToPostId,
              });
              props.onClickPost(postId);
            }}
            onUserClick={userId => props.onUserClick(userId)}
            selectedPostId={props.selectedPostId}
            PanelPostProps={{
              renderPost: (idea, ideaIndex) => (
                <QuickActionArea
                  droppableId={`${QuickActioDroppableIdPrefix}merge-to-${idea.ideaId}`}
                  onClick={() => {/* TODO */ }}
                  title={truncateWithElipsis(30, idea.title)}
                />
              ),
            }}
          />
        </>
      )}
    </div>
  );
}
export default DashboardQuickActions;

const QuickActionArea = (props: {
  droppableId: string;
  feedback?: FeedbackInstance | null;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
  title?: string;
  children?: any;
}) => {
  const theme = useTheme();
  const classes = useStyles();
  return (
    <HoverArea>
      {(hoverAreaProps, isHovering, isHoverDown) => (
        <Droppable
          droppableId={props.droppableId}
          ignoreContainerClipping
          isDropDisabled={!!props.disabled || !isHovering}
        >
          {(provided, snapshot) => (
            <CardActionArea
              {...hoverAreaProps}
              ref={provided.innerRef}
              {...provided.droppableProps}
              disabled={props.disabled}
              className={classNames(
                classes.postAction,
                props.disabled && classes.postActionDisabled,
              )}
              style={props.disabled ? {
                color: theme.palette.text.disabled,
              } : {
                color: props.color,
                borderColor: props.color || 'rgba(0, 0, 0, 0.54)',
                background: !snapshot.isDraggingOver ? undefined : fade(props.color || theme.palette.common.black, 0.1),
              }}
            >
              {props.title && (
                <Typography>{props.title}</Typography>
              )}
              {props.children}
            </CardActionArea>
          )}
        </Droppable>
      )}
    </HoverArea>
  );
}

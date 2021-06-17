import { CardActionArea, Typography } from '@material-ui/core';
import { createStyles, fade, makeStyles, Theme, useTheme } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { useEffect, useState } from 'react';
import { Droppable, SensorAPI } from 'react-beautiful-dnd';
import { shallowEqual, useSelector } from 'react-redux';
import * as Admin from '../../api/admin';
import { ReduxState } from '../../api/server';
import { Project } from '../../api/serverAdmin';
import { FeedbackInstance } from '../../common/config/template/feedback';
import { RoadmapInstance } from '../../common/config/template/roadmap';
import { contentScrollApplyStyles, Orientation } from '../../common/ContentScroll';
import HoverArea from '../../common/HoverArea';
import { FilterControlTitle } from '../../common/search/FilterControls';
import { dndDrag } from '../../common/util/dndUtil';
import RenderControl from '../../common/util/RenderControl';
import { truncateWithElipsis } from '../../common/util/stringUtil';
import Subscription from '../../common/util/subscriptionUtil';
import { droppableDataSerialize } from './dashboardDndActionHandler';
import PostList from './PostList';

const styles = (theme: Theme) => createStyles({
  feedbackTitle: {
    margin: theme.spacing(3, 3, 0.5),
  },
  postActionsContainer: {
    height: '100%',
    minWidth: 200,
    maxWidth: 200,
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
  postActionGroup: {
    display: 'flex',
    flexDirection: 'column',
    '& > *': {
      minHeight: 50,
    },
    '& > *:not(:first-child)': {
      marginTop: 0,
      borderTopWidth: 0,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
    },
    '& > *:not(:last-child)': {
      marginBottom: 0,
      borderBottomWidth: 0,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },
  },
});
const useStyles = makeStyles(styles);

const DashboardQuickActions = (props: {
  activeProject: Project;
  onClickPost: (postId: string) => void;
  onUserClick: (userId: string) => void;
  searchKey?: string; // When search changes, update to check whether selectedPostId is still draggable
  selectedPostId?: string;
  feedback?: FeedbackInstance | null;
  roadmap?: RoadmapInstance | null;
  dragDropSensorApi?: SensorAPI;
  draggingPostIdSubscription: Subscription<string | undefined>;
  fallbackClickHandler?: (draggableId: string, dstDroppableId: string) => void;
}) => {
  const [draggingPostId, setDraggingPostId] = useState(props.draggingPostIdSubscription.getValue());
  useEffect(() => props.draggingPostIdSubscription.subscribe(setDraggingPostId), []);

  const classes = useStyles();
  const [retainSelectedPostId, setRetainSelectedPostId] = useState<{ selected: string, retain: string }>();
  const quickActionsPostId = draggingPostId || props.selectedPostId;
  const quickActionsPost = useSelector<ReduxState, Admin.Idea | undefined>(state => !quickActionsPostId ? undefined : state.ideas.byId[quickActionsPostId]?.idea, shallowEqual);

  const onClick = async (droppableId) => {
    if ((!!draggingPostId || !quickActionsPostId)) {
      return;
    }
    // First try to drag the item with a nice visual
    // The drop handler will do the action for us
    const success = !!props.dragDropSensorApi && await dndDrag(
      props.dragDropSensorApi,
      quickActionsPostId,
      droppableId);
    // If that fails, just do the action with no visual
    if (!success) {
      props.fallbackClickHandler?.(
        quickActionsPostId,
        droppableId);
    }
  }

  const statusAccepted = !props.feedback?.statusIdAccepted ? undefined : props.feedback.categoryAndIndex.category.workflow.statuses.find(s => s.statusId === props.feedback?.statusIdAccepted);
  const nextStatusIds = new Set<string>(quickActionsPost?.statusId
    && props.feedback?.categoryAndIndex.category.workflow.statuses.find(s => s.statusId === quickActionsPost?.statusId)?.nextStatusIds
    || []);
  const canMerge = !!quickActionsPostId
    && !quickActionsPost?.mergedToPostId
    && quickActionsPost?.categoryId === props.feedback?.categoryAndIndex.category.categoryId;

  // Don't change Similar actions during a drag, do not tie this to draggingPostId
  const similarToPostId = retainSelectedPostId?.selected === props.selectedPostId
    ? retainSelectedPostId?.retain : props.selectedPostId;

  const feedbackNextStatusActions = props.feedback?.categoryAndIndex.category.workflow.statuses
    .filter(status => status.statusId !== props.feedback?.categoryAndIndex.category.workflow.entryStatus
      && status.statusId !== props.feedback?.statusIdAccepted);
  const roadmapNextStatusActions = props.roadmap?.categoryAndIndex.category.workflow.statuses
    .filter(status => status.statusId !== props.roadmap?.statusIdClosed
      && status.statusId !== props.roadmap?.statusIdCompleted);

  return (
    <div className={classes.postActionsContainer}>
      {feedbackNextStatusActions?.length && (
        <>
          <FilterControlTitle name='Quick actions' className={classes.feedbackTitle} />
          <div className={classes.postActionGroup}>
            {feedbackNextStatusActions.map(status => {
              const droppableId = droppableDataSerialize({
                type: 'quick-action-feedback-change-status',
                dropbox: true,
                statusId: status.statusId,
              });
              return (
                <QuickActionArea
                  key={status.statusId}
                  isDragging={!!draggingPostId}
                  droppableId={droppableId}
                  disabled={!nextStatusIds.has(status.statusId)}
                  color={status.color}
                  onClick={onClick}
                  title={status.name}
                />
              );
            })}
          </div>
        </>
      )}
      {roadmapNextStatusActions?.length && (
        <>
          <FilterControlTitle name='Convert to task' className={classes.feedbackTitle} />
          <div className={classes.postActionGroup}>
            {roadmapNextStatusActions.map(status => (
              <QuickActionArea
                key={status.statusId}
                isDragging={!!draggingPostId}
                droppableId={droppableDataSerialize({
                  type: 'quick-action-feedback-to-task',
                  dropbox: true,
                  statusId: status.statusId,
                })}
                disabled={!!statusAccepted && !nextStatusIds.has(statusAccepted.statusId)}
                color={status.color}
                onClick={onClick}
                title={status.name}
              />
            ))}
          </div>
        </>
      )}
      {(!similarToPostId || !props.feedback) ? null : (
        <>
          <FilterControlTitle name='Merge with similar' className={classes.feedbackTitle} />
          <PostList
            key={props.activeProject.server.getProjectId()}
            server={props.activeProject.server}
            search={{
              similarToIdeaId: similarToPostId,
              filterCategoryIds: [props.feedback.categoryAndIndex.category.categoryId],
              limit: 5,
            }}
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
                  key={idea.ideaId}
                  isDragging={!!draggingPostId}
                  droppableId={droppableDataSerialize({
                    type: 'quick-action-feedback-merge-duplicate',
                    dropbox: true,
                    postId: idea.ideaId,
                  })}
                  disabled={!canMerge}
                  onClick={onClick}
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
  isDragging: boolean;
  feedback?: FeedbackInstance | null;
  onClick: (droppableId: string) => Promise<void>;
  disabled?: boolean;
  color?: string;
  title?: string;
}) => {
  const theme = useTheme();
  const classes = useStyles();
  const [autoDragging, setAutoDragging] = useState<boolean>(false);
  return (
    <RenderControl freezeInitialRender={props.isDragging}>
      <HoverArea>
        {(hoverAreaProps, isHovering, isHoverDown) => (
          <Droppable
            droppableId={props.droppableId}
            ignoreContainerClipping
            isDropDisabled={!!props.disabled || (!isHovering && !autoDragging)}
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
                  borderColor: props.color || fade(theme.palette.common.black, 0.54),
                  background: !snapshot.isDraggingOver ? undefined : fade(props.color || theme.palette.common.black, 0.1),
                }}
                onClick={async e => {
                  if (props.disabled) return;
                  setAutoDragging(true);
                  try {
                    await props.onClick(props.droppableId);
                  } finally {
                    setAutoDragging(false);
                  }
                }}
              >
                {provided.placeholder && (<div style={{ display: 'none' }}>{provided.placeholder}</div>)}
                {props.title && (
                  <Typography>{props.title}</Typography>
                )}
              </CardActionArea>
            )}
          </Droppable>
        )}
      </HoverArea>
    </RenderControl>
  );
}

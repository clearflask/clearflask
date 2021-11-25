// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { CardActionArea, Typography } from '@material-ui/core';
import { createStyles, fade, makeStyles, Theme, useTheme } from '@material-ui/core/styles';
import classNames from 'classnames';
import { useSnackbar } from 'notistack';
import React, { useEffect, useRef, useState } from 'react';
import { Droppable, SensorAPI } from 'react-beautiful-dnd';
import { useTranslation } from 'react-i18next';
import { Provider, shallowEqual, useSelector } from 'react-redux';
import * as Admin from '../../api/admin';
import { ReduxState, Server } from '../../api/server';
import ServerAdmin, { Project } from '../../api/serverAdmin';
import { FeedbackInstance } from '../../common/config/template/feedback';
import { RoadmapInstance } from '../../common/config/template/roadmap';
import HoverArea from '../../common/HoverArea';
import { FilterControlTitle } from '../../common/search/FilterControls';
import { TourAnchor } from '../../common/tour';
import { dndDrag } from '../../common/util/dndUtil';
import { customReactMemoEquals } from '../../common/util/reactUtil';
import RenderControl from '../../common/util/RenderControl';
import { truncateWithElipsis } from '../../common/util/stringUtil';
import Subscription from '../../common/util/subscriptionUtil';
import { droppableDataSerialize } from './dashboardDndActionHandler';
import FirstTimeNotice, { FirstTimeNoticeHandle } from './FirstTimeNotice';
import PostList from './PostList';

export type FallbackClickHandler = (draggableId: string, dstDroppableId: string) => Promise<boolean>;

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
    border: '1px solid ' + theme.palette.divider,
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
      minHeight: 65,
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
const helperChangeStatus = 'Change the feedback status and notify all subscribers';
const helperConvertToTask = 'Creates a task and places it on your roadmap. Feedback is marked as Accepted, linked to your task, and all subscribers notified.';
const helperDelete = 'Deletes permanently without notifying subscribers';
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
  fallbackClickHandler: FallbackClickHandler;
}) => {
  const [draggingPostId, setDraggingPostId] = useState(props.draggingPostIdSubscription.getValue());
  useEffect(() => props.draggingPostIdSubscription.subscribe(setDraggingPostId), []); // eslint-disable-line react-hooks/exhaustive-deps
  
  const { t } = useTranslation('app');
  const classes = useStyles();
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const noticeChangeStatusRef = useRef<FirstTimeNoticeHandle>(null);
  const noticeConvertToTaskRef = useRef<FirstTimeNoticeHandle>(null);
  const noticeDeleteRef = useRef<FirstTimeNoticeHandle>(null);

  const quickActionsPostId = draggingPostId || props.selectedPostId;
  const quickActionsPost = useSelector<ReduxState, Admin.Idea | undefined>(state => !quickActionsPostId ? undefined : state.ideas.byId[quickActionsPostId]?.idea, shallowEqual);

  // TODO disable in cases if its already merged or linked or something
  const enabled = !!quickActionsPostId;
  const onClick = (!enabled || !!draggingPostId) ? undefined
    : onClickAction(props.dragDropSensorApi, props.fallbackClickHandler, quickActionsPostId);

  const statusAccepted = !props.feedback?.statusIdAccepted ? undefined : props.feedback.categoryAndIndex.category.workflow.statuses.find(s => s.statusId === props.feedback?.statusIdAccepted);
  const nextStatusIds = new Set<string>(quickActionsPost?.statusId
    && props.feedback?.categoryAndIndex.category.workflow.statuses.find(s => s.statusId === quickActionsPost?.statusId)?.nextStatusIds
    || []);

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
          <FilterControlTitle name='Change status' className={classes.feedbackTitle} help={{
            description: helperChangeStatus,
          }} />
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
                  color={status.color}
                  enabled={enabled && nextStatusIds.has(status.statusId)}
                  onClick={async droppableId => {
                    if (! await noticeChangeStatusRef.current?.invoke()) return;
                    return await onClick?.(droppableId);
                  }}
                  title={status.name}
                />
              );
            })}
          </div>
        </>
      )}
      {roadmapNextStatusActions?.length && (
        <Provider store={ServerAdmin.get().getStore()}>
          <TourAnchor anchorId='feedback-page-convert-to-task' placement='left'>
            {(next, isActive, anchorRef) => (
              <>
                <FilterControlTitle name='Convert to task' className={classes.feedbackTitle} help={{
                  description: helperConvertToTask,
                }} />
                <div className={classes.postActionGroup} ref={anchorRef}>
                  {roadmapNextStatusActions.map(status => (
                    <QuickActionArea
                      key={status.statusId}
                      isDragging={!!draggingPostId}
                      droppableId={droppableDataSerialize({
                        type: 'quick-action-create-task-from-feedback-with-status',
                        dropbox: true,
                        statusId: status.statusId,
                      })}
                      color={status.color}
                      enabled={enabled && (!statusAccepted || nextStatusIds.has(statusAccepted.statusId))}
                      onClick={async droppableId => {
                        if (isActive) {
                          enqueueSnackbar('Disabled during tutorial', { variant: 'warning', preventDuplicate: true });
                          return;
                        }
                        if (! await noticeConvertToTaskRef.current?.invoke()) return;
                        return await onClick?.(droppableId);
                      }}
                      title={status.name}
                    />
                  ))}
                </div>
              </>
            )}
          </TourAnchor>
        </Provider>
      )}
      <FilterControlTitle name={t('delete')} className={classes.feedbackTitle} help={{
        description: helperDelete,
      }} />
      <QuickActionArea
        key='delete'
        isDragging={!!draggingPostId}
        droppableId={droppableDataSerialize({
          type: 'quick-action-delete',
          dropbox: true,
        })}
        color={theme.palette.error.dark}
        enabled={enabled}
        onClick={async droppableId => {
          if (! await noticeDeleteRef.current?.invoke()) return;
          return await onClick?.(droppableId);
        }}
        title={t('delete')}
      />
      <Provider store={ServerAdmin.get().getStore()}>
        <FirstTimeNotice
          ref={noticeChangeStatusRef}
          id='feedback-change-status'
          title='Change status'
          description={helperChangeStatus}
          confirmButtonTitle='Change'
        />
        <FirstTimeNotice
          ref={noticeConvertToTaskRef}
          id='feedback-convert-to-task'
          title='Create task'
          description={helperConvertToTask}
          confirmButtonTitle='Convert'
        />
        <FirstTimeNotice
          ref={noticeDeleteRef}
          id='feedback-delete'
          title='Permanently delete'
          description={helperDelete}
          confirmButtonTitle='Delete'
          confirmButtonRed
        />
      </Provider>
    </div>
  );
}
export default DashboardQuickActions;

const QuickActionPostList = React.memo((props: {
  server: Server;
  title?: {
    name: string;
    helpDescription?: string;
  };
  getDroppableId: (post: Admin.Idea) => string | undefined;
  selectedPostId?: string;
  draggingPostIdSubscription: Subscription<string | undefined>;
  dragDropSensorApi?: SensorAPI;
  statusColorGivenCategories?: string[];
  fallbackClickHandler: (draggableId: string, dstDroppableId: string) => Promise<boolean>;
  PostListProps?: Partial<React.ComponentProps<typeof PostList>>;
  showSampleItem?: string;
  disabledDuringTour?: boolean;
  FirstTimeNoticeProps?: React.ComponentPropsWithoutRef<typeof FirstTimeNotice>;
}) => {
  const classes = useStyles();
  const { enqueueSnackbar } = useSnackbar();

  const noticeRef = useRef<FirstTimeNoticeHandle>(null);

  const [draggingPostId, setDraggingPostId] = useState(props.draggingPostIdSubscription.getValue());
  useEffect(() => props.draggingPostIdSubscription.subscribe(setDraggingPostId), []); // eslint-disable-line react-hooks/exhaustive-deps

  const statusIdToColor = useSelector<ReduxState, { [statusId: string]: string } | undefined>(state => {
    if (!props.statusColorGivenCategories?.length) return;
    const statusIdToColor = {};
    state.conf.conf?.content.categories
      .forEach(category => {
        if (!props.statusColorGivenCategories?.includes(category.categoryId)) return;
        category.workflow.statuses.forEach(status => {
          if (status.color === undefined) return;
          statusIdToColor[status.statusId] = status.color;
        });
      });
    return statusIdToColor;
  }, shallowEqual);

  const quickActionsPostId = draggingPostId || props.selectedPostId;
  const quickActionsPost = useSelector<ReduxState, Admin.Idea | undefined>(state => !quickActionsPostId ? undefined : state.ideas.byId[quickActionsPostId]?.idea, shallowEqual);
  const enabled = (!!quickActionsPostId && !quickActionsPost?.mergedToPostId)
  const onClick = (!enabled || !!draggingPostId) ? undefined
    : onClickAction(props.dragDropSensorApi, props.fallbackClickHandler, quickActionsPostId);

  var content = (
    <PostList
      key={props.server.getProjectId()}
      server={props.server}
      layout='similar-merge-action'
      PanelPostProps={{
        overrideTitle: !props.title ? undefined : (
          <FilterControlTitle name={props.title.name} className={classes.feedbackTitle} help={{
            description: props.title.helpDescription,
          }} />
        ),
        renderPost: (idea, ideaIndex) => {
          const droppableId = props.getDroppableId(idea);
          if (!droppableId) return null;
          return (
            <QuickActionArea
              key={idea.ideaId}
              isDragging={!!draggingPostId}
              droppableId={droppableId}
              enabled={enabled}
              onClick={async droppableId => {
                if (props.disabledDuringTour) {
                  enqueueSnackbar('Disabled during tutorial', { variant: 'warning', preventDuplicate: true });
                  return;
                }
                if (!!noticeRef.current && ! await noticeRef.current.invoke()) return;
                return await onClick?.(droppableId);
              }}
              color={(!statusIdToColor || !idea.statusId) ? undefined : statusIdToColor[idea.statusId]}
              title={truncateWithElipsis(30, idea.title)}
            />
          );
        },
        renderEmpty: !props.showSampleItem ? undefined : () => (
          <QuickActionArea
            key={`sample-item-${props.showSampleItem}`}
            isDragging={false}
            droppableId='disabled-for-dropping'
            enabled={false}
            title={props.showSampleItem}
          />
        ),
      }}
      hideIfEmpty={!props.showSampleItem}
      {...props.PostListProps}
    />
  );

  if (props.FirstTimeNoticeProps) {
    content = (
      <>
        {content}
        <Provider store={ServerAdmin.get().getStore()}>
          <FirstTimeNotice
            {...props.FirstTimeNoticeProps}
            ref={noticeRef}
          />
        </Provider>
      </>
    );
  }

  return content;
}, customReactMemoEquals({
  nested: new Set(['PostListProps', 'DroppableProvidedProps', 'statusColorGivenCategories', 'title']),
  presence: new Set(['fallbackClickHandler', 'getDroppableId']),
}));
QuickActionPostList.displayName = 'QuickActionPostList';
export { QuickActionPostList };

export const QuickActionArea = (props: {
  droppableId: string;
  isDragging: boolean;
  feedback?: FeedbackInstance | null;
  enabled?: boolean;
  onClick?: (droppableId: string) => Promise<any>;
  color?: string;
  title?: string;
}) => {
  const { t } = useTranslation('app');
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
            isDropDisabled={!props.enabled || (!isHovering && !autoDragging)}
          >
            {(provided, snapshot) => (
              <CardActionArea
                {...hoverAreaProps}
                ref={provided.innerRef}
                {...provided.droppableProps}
                disabled={!props.enabled}
                className={classNames(
                  classes.postAction,
                  !props.enabled && classes.postActionDisabled,
                )}
                style={!props.enabled ? {
                  color: theme.palette.text.disabled,
                } : {
                  color: props.color,
                  borderColor: props.color || fade(theme.palette.common.black, 0.54),
                  background: !snapshot.isDraggingOver ? undefined : fade(props.color || theme.palette.common.black, 0.1),
                }}
                onClick={async e => {
                  if (!props.enabled || !props.onClick) return;
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
                  <Typography>{t(props.title as any)}</Typography>
                )}
              </CardActionArea>
            )}
          </Droppable>
        )}
      </HoverArea>
    </RenderControl>
  );
}

const onClickAction = (dragDropSensorApi, fallbackClickHandler, draggableId) => async (droppableId): Promise<boolean> => {
  // First try to drag the item with a nice visual
  // The drop handler will do the action for us
  var success = !!dragDropSensorApi && await dndDrag(
    dragDropSensorApi,
    draggableId,
    droppableId);
  // If that fails, just do the action with no visual
  if (!success) {
    success = await fallbackClickHandler?.(
      draggableId,
      droppableId);
  }
  return success;
}

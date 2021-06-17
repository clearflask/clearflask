import { createStyles, makeStyles, Theme, useTheme } from '@material-ui/core/styles';
import DragmeIcon from '@material-ui/icons/DragIndicator';
import classNames from 'classnames';
import React from 'react';
import { Draggable, DraggableProvided, DropAnimation, Droppable, DroppableId, DroppableProvidedProps } from 'react-beautiful-dnd';
import { droppableDataDeserialize } from './dashboardDndActionHandler';
import PostList from './PostList';

export const PostListWithSearchKeyDroppableIdPrefix = 'post-list-';

const styles = (theme: Theme) => createStyles({
  droppable: {
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  draggable: {
    position: 'relative', // For DragmeIcon
  },
  dragmeIcon: {
    transform: 'rotate(90deg)',
  },
  dragmeIconContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    cursor: 'grab',
    opacity: 0.2,
    marginLeft: theme.spacing(4),
    padding: theme.spacing(1),
  },
});
const useStyles = makeStyles(styles);

// Optimization to not re-render children during dragging
const DragndropPostList = React.memo((props: {
  droppable?: boolean;
  droppableId: string;
} & React.ComponentProps<typeof PostList>) => {
  const { droppable, droppableId, ...PostListProps } = props;
  const classes = useStyles();
  return (
    <Droppable droppableId={droppableId} isDropDisabled={!droppable}>
      {(providedDroppable, snapshotDroppable) => (
        <>
          <DragndropPostListDroppableInner
            providedDroppableInnerRef={providedDroppable.innerRef}
            PostListProps={PostListProps}
            {...providedDroppable.droppableProps}
          />
          {providedDroppable.placeholder && (<div style={{ display: 'none' }}>{providedDroppable.placeholder}</div>)}
        </>
      )}
    </Droppable>
  );
});
export default DragndropPostList;

// Optimization to not re-render children during dragging
const DragndropPostListDroppableInner = React.memo((props: {
  providedDroppableInnerRef;
  PostListProps: React.ComponentProps<typeof PostList>;
} & DroppableProvidedProps) => {
  const { providedDroppableInnerRef, PostListProps, ...DroppableProps } = props;
  const classes = useStyles();
  return (
    <div
      className={classNames(
        classes.droppable,
      )}
      ref={providedDroppableInnerRef}
      {...DroppableProps}
    >
      <DragndropPostListPostListInner {...PostListProps} />
    </div>
  );
});

// Optimization to not re-render children during dragging
const DragndropPostListPostListInner = React.memo((props: React.ComponentProps<typeof PostList>) => {
  return (
    <PostList
      {...props}
      PanelPostProps={{
        ...props.PanelPostProps,
        showDivider: false,
        wrapPost: (post, content, index) => (
          <Draggable
            draggableId={post.ideaId}
            index={index}
          >
            {(providedDraggable, snapshotDraggable) => (
              <DragndropPostListDraggableInner
                providedDraggable={providedDraggable}
                draggingOver={snapshotDraggable.draggingOver}
                dropAnimation={snapshotDraggable.dropAnimation}
                content={content}
              />
            )}
          </Draggable>
        ),
      }}
    />
  );
});

// Optimization to not re-render children during dragging
const DragndropPostListDraggableInner = React.memo((props: {
  providedDraggable: DraggableProvided;
  draggingOver?: DroppableId;
  dropAnimation?: DropAnimation;
  content: React.ReactNode;
}) => {
  const classes = useStyles();
  const theme = useTheme();
  return (
    <div
      ref={props.providedDraggable.innerRef}
      {...props.providedDraggable.draggableProps}
      {...props.providedDraggable.dragHandleProps}
      style={patchStyle(theme, props.providedDraggable, props.draggingOver, props.dropAnimation)}
      className={classes.draggable}
    >
      <div className={classes.dragmeIconContainer}>
        <DragmeIcon color='inherit' className={classes.dragmeIcon} />
      </div>
      {props.content}
    </div>
  );
});

const patchStyle = (
  theme: Theme,
  providedDraggable: DraggableProvided,
  draggingOver?: DroppableId,
  dropAnimation?: DropAnimation,
) => {
  const style: any = {
    ...(providedDraggable.draggableProps.style || {}),
  };

  if (draggingOver || dropAnimation) {
    style.zIndex = theme.zIndex.tooltip + 1;
  }

  // Animate dropping into quick action droppable as if it was a combine
  // by changing opacity and scale down.
  if (dropAnimation
    && style.transform
    && draggingOver
    && droppableDataDeserialize(draggingOver)?.['dropbox']) {
    // Properties match default combine https://github.com/atlassian/react-beautiful-dnd/blob/2360665305b854434e968e41c7b4105009b73c40/src/animation.js#L18
    style.transform = (style.transform || '') + ' scale(0)';
    style.opacity = 0;
  }

  return style;
}

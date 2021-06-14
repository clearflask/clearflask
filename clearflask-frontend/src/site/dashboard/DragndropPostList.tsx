import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import DragmeIcon from '@material-ui/icons/DragIndicator';
import classNames from 'classnames';
import React, { Component } from 'react';
import { Draggable, DraggableProvided, DraggableStateSnapshot, Droppable } from 'react-beautiful-dnd';
import { getSearchKey } from '../../api/server';
import { QuickActioDroppableIdPrefix } from './DashboardQuickActions';
import PostList from './PostList';


const styles = (theme: Theme) => createStyles({
  droppable: {
    minWidth: 0,
  },
  draggable: {
    position: 'relative', // For DragmeIcon
  },
  dragmeIcon: {
    position: 'absolute',
    left: 0,
    top: 0,
    cursor: 'grab',
    opacity: 0.2,
    marginTop: theme.spacing(3),
    padding: theme.spacing(1),
  },
});
interface Props {
  droppable?: boolean;
}
class DragndropPostList extends Component<Props & React.ComponentProps<typeof PostList> & WithStyles<typeof styles, true>> {

  render() {
    const { classes, ...PostListProps } = this.props;
    const droppableId = getSearchKey(PostListProps.search) || '';
    return (
      <Droppable droppableId={droppableId} isDropDisabled={!this.props.droppable}>
        {(provided, snapshot) => (
          <div
            className={classNames(
              this.props.classes.droppable,
            )}
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {provided.placeholder && (<div style={{ display: 'none' }}>{provided.placeholder}</div>)}
            <PostList
              {...PostListProps}
              PanelPostProps={{
                showDivider: false,
                wrapPost: (post, content, index) => (
                  <Draggable
                    draggableId={post.ideaId}
                    index={index}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        style={this.patchStyle(provided, snapshot)}
                        className={this.props.classes.draggable}
                      >
                        <div className={this.props.classes.dragmeIcon}>
                          <DragmeIcon color='inherit' />
                        </div>
                        {content}
                      </div>
                    )}
                  </Draggable>
                ),
              }}
            />
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    );
  }

  patchStyle(provided: DraggableProvided, snapshot: DraggableStateSnapshot) {
    const style: any = {
      ...(provided.draggableProps.style || {}),
    };

    // Animate dropping into quick action droppable as if it was a combine
    // by changing opacity and scale down.
    if (snapshot.isDropAnimating
      && snapshot.dropAnimation
      && style.transform
      && snapshot.draggingOver?.startsWith(QuickActioDroppableIdPrefix)) {
      // Properties match default combine https://github.com/atlassian/react-beautiful-dnd/blob/2360665305b854434e968e41c7b4105009b73c40/src/animation.js#L18
      style.transform = (style.transform || '') + ' scale(0)';
      style.opacity = 0;
    }

    return style;
  }
}

export default withStyles(styles, { withTheme: true })(DragndropPostList);

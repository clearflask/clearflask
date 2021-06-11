import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import React, { useState } from 'react';
import { Provider } from 'react-redux';
import { Project } from '../../api/serverAdmin';
import { FeedbackInstance } from '../../common/config/template/feedback';
import { contentScrollApplyStyles, Orientation } from '../../common/ContentScroll';
import { FilterControlTitle } from '../../common/search/FilterControls';
import PostList from './PostList';

const styles = (theme: Theme) => createStyles({
  feedbackTitle: {
    margin: theme.spacing(3, 3, 0.5),
  },
  feedbackDropzoneContainer: {
    height: '100%',
    minWidth: 200,
    maxWidth: 200,
    borderRight: '1px solid ' + theme.palette.grey[300],
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Vertical }),
  },
  feedbackDropzone: {
    minHeight: 100,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: theme.spacing(1, 3),
    padding: theme.spacing(2),
    textAlign: 'center',
    borderStyle: 'dashed',
    borderWidth: 2,
    borderRadius: 6,
    outline: 'none',
    transition: theme.transitions.create(['opacity']),
    opacity: 0.38,
    '&:hover': {
      opacity: 1,
    },
  },
});
const useStyles = makeStyles(styles);

const DashboardPostActions = (props: {
  activeProject: Project;
  onClickPost: (postId: string) => void;
  onUserClick: (userId: string) => void;
  selectedPostId?: string;
  feedback?: FeedbackInstance | null;
}) => {
  const classes = useStyles();
  const [retainSelectedPostId, setRetainSelectedPostId] = useState<{ selected: string, retain: string }>();
  const similarToPostId = retainSelectedPostId?.selected === props.selectedPostId
    ? retainSelectedPostId?.retain : props.selectedPostId;
  return (
    <div className={classes.feedbackDropzoneContainer}>
      <FilterControlTitle name='Take action' className={classes.feedbackTitle} />
      {props.feedback?.categoryAndIndex.category.workflow.statuses
        .filter(status => status.statusId !== props.feedback?.categoryAndIndex.category.workflow.entryStatus
          && status.statusId !== props.feedback?.statusIdAccepted)
        .map(status => (
          <div className={classes.feedbackDropzone}
            style={{ color: status.color, borderColor: status.color }}>
            {status.name}
          </div>
        ))}
      {similarToPostId ? (
        <Provider key={props.activeProject.projectId} store={props.activeProject.server.getStore()}>
          <FilterControlTitle name='Merge with' className={classes.feedbackTitle} />
          <PostList
            key={props.activeProject.server.getProjectId()}
            server={props.activeProject.server}
            search={{ similarToIdeaId: similarToPostId }}
            layoutSimilar
            onClickPost={postId => {
              setRetainSelectedPostId({
                selected: postId,
                retain: similarToPostId,
              });
              props.onClickPost(postId);
            }}
            onUserClick={userId => props.onUserClick(userId)}
            selectedPostId={props.selectedPostId}
          />
        </Provider>
      ) : (
        <div>Select to view similar</div>
      )}
    </div>
  );
}
export default DashboardPostActions;

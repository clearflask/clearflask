import * as Admin from "../../api/admin";
import { Project } from "../../api/serverAdmin";
import { FeedbackInstance } from "../../common/config/template/feedback";
import { RoadmapInstance } from "../../common/config/template/roadmap";

export const DroppableWithDataPrefix = 'data-';
export type DroppableData = {
  type: 'quick-action-feedback-change-status';
  statusId: string;
} | {
  type: 'quick-action-feedback-to-task';
  statusId: string;
} | {
  type: 'quick-action-feedback-merge-duplicate';
  postId: string;
} | {
  type: 'feedback-search';
  searchKey: string;
} | {
  type: 'roadmap-panel';
  statusId?: string;
  searchKey: string;
}

export const droppableDataSerialize = (data: DroppableData): string => {
  return DroppableWithDataPrefix + JSON.stringify(data);
}
export const droppableDataDeserialize = (droppableId: string): DroppableData | undefined => {
  if (!droppableId.startsWith(DroppableWithDataPrefix)) return undefined;
  return JSON.parse(droppableId.slice(DroppableWithDataPrefix.length));
}

const removeFromSearch = (
  activeProject: Project,
  srcDroppableId: string,
  postId: string,
) => {
  const srcDroppable = droppableDataDeserialize(srcDroppableId);
  const searchKey = srcDroppable?.['searchKey'];
  if (!searchKey) return false;
  activeProject.server.getStore().dispatch({
    type: 'ideaSearchResultRemoveIdea',
    payload: {
      searchKey: searchKey,
      ideaId: postId,
    },
  });
  return true;
};

const addToSearch = (
  activeProject: Project,
  dstDroppable: DroppableData,
  dstIndex: number,
  postId: string,
) => {
  const searchKey = dstDroppable?.['searchKey'];
  if (!searchKey) return false;
  activeProject.server.getStore().dispatch({
    type: 'ideaSearchResultAddIdea',
    payload: {
      searchKey: searchKey,
      ideaId: postId,
      index: dstIndex,
    },
  });
  return true;
};

const feedbackToTask = async (
  activeProject: Project,
  srcPost: Admin.Idea,
  taskStatusId: string,
  onClickPost: (postId: string) => void,
  feedback: FeedbackInstance,
  roadmap: RoadmapInstance,
): Promise<string> => {
  const dispatcherAdmin = await activeProject.server.dispatchAdmin();
  const taskId = (await dispatcherAdmin.ideaCreateAdmin({
    projectId: activeProject.projectId,
    ideaCreateAdmin: {
      authorUserId: activeProject.user.userId,
      categoryId: roadmap.categoryAndIndex.category.categoryId,
      statusId: taskStatusId,
      title: srcPost.title,
      description: srcPost.description,
      tagIds: [],
    },
  })).ideaId;
  if (feedback.statusIdAccepted) {
    await dispatcherAdmin.ideaUpdateAdmin({
      projectId: activeProject.projectId,
      ideaId: srcPost.ideaId,
      ideaUpdateAdmin: { statusId: feedback.statusIdAccepted },
    });
  }
  await dispatcherAdmin.ideaLinkAdmin({
    projectId: activeProject.projectId,
    ideaId: srcPost.ideaId,
    parentIdeaId: taskId,
  });
  onClickPost(taskId);
  return taskId;
};

export const dashboardOnDragEnd = async (
  activeProject: Project,
  srcDroppableId: string,
  srcIndex: number,
  draggableId: string,
  dstDroppableId: string,
  dstIndex: number,
  onClickPost: (postId: string) => void,
  feedback?: FeedbackInstance,
  roadmap?: RoadmapInstance,
): Promise<boolean> => {
  const srcPost = activeProject.server.getStore().getState().ideas.byId[draggableId]?.idea;
  if (!srcPost) return false;

  const dstDroppable = droppableDataDeserialize(dstDroppableId);
  if (!dstDroppable) return false;

  // If placed in same spot, ignore
  if (srcDroppableId === dstDroppableId
    && srcIndex === dstIndex) return false;

  var dispatcherAdmin: Admin.Dispatcher | undefined;
  switch (dstDroppable.type) {

    case 'quick-action-feedback-change-status':
      dispatcherAdmin = await activeProject.server.dispatchAdmin();
      await dispatcherAdmin.ideaUpdateAdmin({
        projectId: activeProject.projectId,
        ideaId: srcPost.ideaId,
        ideaUpdateAdmin: { statusId: dstDroppable.statusId },
      });
      removeFromSearch(activeProject, srcDroppableId, srcPost.ideaId);
      return true;

    case 'quick-action-feedback-to-task':
      if (!roadmap || !feedback) return false;
      const taskId = await feedbackToTask(
        activeProject,
        srcPost,
        dstDroppable.statusId,
        onClickPost,
        feedback,
        roadmap);
      removeFromSearch(activeProject, srcDroppableId, srcPost.ideaId);
      return true;

    case 'quick-action-feedback-merge-duplicate':
      dispatcherAdmin = await activeProject.server.dispatchAdmin();
      await dispatcherAdmin.ideaMergeAdmin({
        projectId: activeProject.projectId,
        ideaId: srcPost.ideaId,
        parentIdeaId: dstDroppable.postId,
      });
      removeFromSearch(activeProject, srcDroppableId, srcPost.ideaId);
      return true;

    case 'roadmap-panel':
      if (!roadmap || !dstDroppable.statusId) return false;
      if (srcPost.categoryId === roadmap.categoryAndIndex.category.categoryId) {
        // Change task status
        dispatcherAdmin = await activeProject.server.dispatchAdmin();
        await dispatcherAdmin.ideaUpdateAdmin({
          projectId: activeProject.projectId,
          ideaId: srcPost.ideaId,
          ideaUpdateAdmin: { statusId: dstDroppable.statusId },
        });
        removeFromSearch(activeProject, srcDroppableId, srcPost.ideaId);
        addToSearch(activeProject, dstDroppable, dstIndex, srcPost.ideaId);
        return true;
      } else if (!!feedback && srcPost.categoryId === feedback.categoryAndIndex.category.categoryId) {
        // Convert feedback to task with status
        if (!roadmap || !feedback) return false;
        const taskId = await feedbackToTask(
          activeProject,
          srcPost,
          dstDroppable.statusId,
          onClickPost,
          feedback,
          roadmap);
        removeFromSearch(activeProject, srcDroppableId, srcPost.ideaId);
        addToSearch(activeProject, dstDroppable, dstIndex, taskId);
        return true;
      } else {
        return false;
      }
    default:
      return false;
  }
};

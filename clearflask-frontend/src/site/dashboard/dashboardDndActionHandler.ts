// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import * as Admin from "../../api/admin";
import { ignoreSearchKeys } from "../../api/server";
import { Project } from "../../api/serverAdmin";
import { FeedbackInstance } from "../../common/config/template/feedback";
import { RoadmapInstance } from "../../common/config/template/roadmap";

export const DroppableWithDataPrefix = 'data-';
export type DroppableData = {
  type: 'quick-action-delete';
  dropbox: true; // Shows shrinking drop animation
} | {
  type: 'quick-action-feedback-change-status';
  dropbox: true; // Shows shrinking drop animation
  statusId: string;
} | {
  type: 'quick-action-create-task-from-feedback-with-status';
  dropbox: true;
  statusId: string;
} | {
  type: 'quick-action-feedback-merge-duplicate';
  dropbox: true;
  postId: string;
} | {
  type: 'quick-action-feedback-link-with-task-and-accept';
  dropbox: true;
  postId: string;
} | {
  type: 'feedback-search';
  searchKey: string; // Allow add/remove from redux search results on drag
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
  searchKey: string,
  postId: string,
) => {
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
  searchKey: string,
  dstIndex: number,
  postId: string,
) => {
  activeProject.server.getStore().dispatch({
    type: 'ideaSearchResultAddIdea',
    payload: {
      searchKey,
      ideaId: postId,
      index: dstIndex,
    },
  });
  return true;
};

const indexToOrder = (
  activeProject: Project,
  searchKey: string,
  index: number,
): number | undefined => {
  const state = activeProject.server.getStore().getState();
  const searchIdeaIds = state.ideas.bySearch[searchKey]?.ideaIds;
  if (!searchIdeaIds?.length) return undefined;
  const postIdBefore = searchIdeaIds[index - 1];
  const postIdAfter = searchIdeaIds[index];
  const postBefore = !!postIdBefore ? state.ideas.byId[postIdBefore]?.idea : undefined;
  const postAfter = !!postIdAfter ? state.ideas.byId[postIdBefore]?.idea : undefined;
  const valBefore = postBefore?.order !== undefined ? postBefore?.order : postBefore?.created.getTime();
  const valAfter = postAfter?.order !== undefined ? postAfter?.order : postAfter?.created.getTime();
  if (valBefore !== undefined && valAfter !== undefined) return valBefore + ((valAfter - valBefore) / 2);
  if (valAfter !== undefined) return valAfter - 1; // At the beginning of the list
  if (valBefore !== undefined) return valBefore + 1; // At the end of the list
  return undefined;
};

const feedbackToTask = async (
  activeProject: Project,
  srcPost: Admin.Idea,
  taskStatusId: string,
  feedback: FeedbackInstance,
  roadmap: RoadmapInstance,
  srcSearchKey?: string,
  dstSearchKey?: string,
  dstIndex?: number,
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
      order: (dstSearchKey && dstIndex !== undefined) ? indexToOrder(activeProject, dstSearchKey, dstIndex) : undefined,
    },
  }, { [ignoreSearchKeys]: new Set([dstSearchKey]) })).ideaId;
  if (feedback.statusIdAccepted) {
    await dispatcherAdmin.ideaUpdateAdmin({
      projectId: activeProject.projectId,
      ideaId: srcPost.ideaId,
      ideaUpdateAdmin: { statusId: feedback.statusIdAccepted },
    }, { [ignoreSearchKeys]: new Set([srcSearchKey]) });
  }
  await dispatcherAdmin.ideaLinkAdmin({
    projectId: activeProject.projectId,
    ideaId: srcPost.ideaId,
    parentIdeaId: taskId,
  });
  return taskId;
};

export type OnDndPreHandling = (to: DroppableData, post: Admin.Idea) => Promise<any>;
export type OnDndHandled = (to: DroppableData, post: Admin.Idea, createdId?: string) => Promise<any>;

export const dashboardOnDragEnd = async (
  activeProject: Project,
  srcDroppableId: string,
  srcIndex: number,
  draggableId: string,
  dstDroppableId: string,
  dstIndex: number,
  feedback?: FeedbackInstance,
  roadmap?: RoadmapInstance,
  onHandled?: OnDndHandled,
  onPreHandling?: OnDndPreHandling,
): Promise<boolean> => {
  const srcPost = activeProject.server.getStore().getState().ideas.byId[draggableId]?.idea;
  if (!srcPost) return false;

  const dstDroppable = droppableDataDeserialize(dstDroppableId);
  if (!dstDroppable) return false;

  // If placed in same spot, ignore
  if (srcDroppableId === dstDroppableId
    && srcIndex === dstIndex) return false;

  const srcDroppable = droppableDataDeserialize(srcDroppableId);
  if (!srcDroppable) return false;

  const srcSearchKey: string | undefined = srcDroppable?.['searchKey'];
  const dstSearchKey: string | undefined = dstDroppable?.['searchKey'];

  await onPreHandling?.(dstDroppable, srcPost);

  switch (dstDroppable.type) {

    case 'quick-action-delete':
      // Technically we could let ideaDeleteAdmin remove it for us,
      // but let's make it seem responsive
      !!srcSearchKey && removeFromSearch(activeProject, srcSearchKey, srcPost.ideaId);
      try {
        await (await activeProject.server.dispatchAdmin()).ideaDeleteAdmin({
          projectId: activeProject.projectId,
          ideaId: srcPost.ideaId,
        }, { [ignoreSearchKeys]: new Set([srcSearchKey]) });
      } catch (e) {
        !!srcSearchKey && addToSearch(activeProject, srcSearchKey, srcIndex, srcPost.ideaId);
        throw e;
      }
      await onHandled?.(dstDroppable, srcPost);
      return true;

    case 'quick-action-feedback-change-status':
      !!srcSearchKey && removeFromSearch(activeProject, srcSearchKey, srcPost.ideaId);
      try {
        await (await activeProject.server.dispatchAdmin()).ideaUpdateAdmin({
          projectId: activeProject.projectId,
          ideaId: srcPost.ideaId,
          ideaUpdateAdmin: { statusId: dstDroppable.statusId },
        }, { [ignoreSearchKeys]: new Set([srcSearchKey]) });
      } catch (e) {
        !!srcSearchKey && addToSearch(activeProject, srcSearchKey, srcIndex, srcPost.ideaId);
        throw e;
      }
      await onHandled?.(dstDroppable, srcPost);
      return true;

    case 'quick-action-create-task-from-feedback-with-status':
      if (!roadmap || !feedback) return false;
      !!srcSearchKey && removeFromSearch(activeProject, srcSearchKey, srcPost.ideaId);
      var taskId;
      try {
        taskId = await feedbackToTask(
          activeProject,
          srcPost,
          dstDroppable.statusId,
          feedback,
          roadmap,
          srcSearchKey);
      } catch (e) {
        !!srcSearchKey && addToSearch(activeProject, srcSearchKey, srcIndex, srcPost.ideaId);
        throw e;
      }
      await onHandled?.(dstDroppable, srcPost, taskId);
      return true;

    case 'quick-action-feedback-merge-duplicate':
      !!srcSearchKey && removeFromSearch(activeProject, srcSearchKey, srcPost.ideaId);
      try {
        await (await activeProject.server.dispatchAdmin()).ideaMergeAdmin({
          projectId: activeProject.projectId,
          ideaId: srcPost.ideaId,
          parentIdeaId: dstDroppable.postId,
        });
      } catch (e) {
        !!srcSearchKey && addToSearch(activeProject, srcSearchKey, srcIndex, srcPost.ideaId);
        throw e;
      }
      await onHandled?.(dstDroppable, srcPost);
      return true;

    case 'quick-action-feedback-link-with-task-and-accept':
      !!srcSearchKey && removeFromSearch(activeProject, srcSearchKey, srcPost.ideaId);
      try {
        await (await activeProject.server.dispatchAdmin()).ideaLinkAdmin({
          projectId: activeProject.projectId,
          ideaId: srcPost.ideaId,
          parentIdeaId: dstDroppable.postId,
        });
        if (feedback?.statusIdAccepted) {
          await (await activeProject.server.dispatchAdmin()).ideaUpdateAdmin({
            projectId: activeProject.projectId,
            ideaId: srcPost.ideaId,
            ideaUpdateAdmin: { statusId: feedback.statusIdAccepted },
          }, { [ignoreSearchKeys]: new Set([srcSearchKey]) });
        }
      } catch (e) {
        !!srcSearchKey && addToSearch(activeProject, srcSearchKey, srcIndex, srcPost.ideaId);
        throw e;
      }
      await onHandled?.(dstDroppable, srcPost);
      return true;

    case 'roadmap-panel':
      if (!roadmap || !dstDroppable.statusId) return false;
      if (srcPost.categoryId === roadmap.categoryAndIndex.category.categoryId) {
        // Change task status
        !!srcSearchKey && removeFromSearch(activeProject, srcSearchKey, srcPost.ideaId);
        !!dstSearchKey && addToSearch(activeProject, dstSearchKey, dstIndex, srcPost.ideaId);
        try {
          await (await activeProject.server.dispatchAdmin()).ideaUpdateAdmin({
            projectId: activeProject.projectId,
            ideaId: srcPost.ideaId,
            ideaUpdateAdmin: {
              statusId: dstDroppable.statusId,
              order: dstSearchKey ? indexToOrder(activeProject, dstSearchKey, dstIndex) : undefined,
            },
          }, { [ignoreSearchKeys]: new Set([srcSearchKey, dstSearchKey]) });
        } catch (e) {
          !!srcSearchKey && addToSearch(activeProject, srcSearchKey, srcIndex, srcPost.ideaId);
          !!dstSearchKey && removeFromSearch(activeProject, dstSearchKey, srcPost.ideaId);
          throw e;
        }
        await onHandled?.(dstDroppable, srcPost);
        return true;
      } else if (!!feedback && srcPost.categoryId === feedback.categoryAndIndex.category.categoryId) {
        if (!feedback) return false;
        // Convert feedback to task with status
        !!srcSearchKey && removeFromSearch(activeProject, srcSearchKey, srcPost.ideaId);
        !!dstSearchKey && !!dstIndex && addToSearch(activeProject, dstSearchKey, dstIndex, taskId);
        try {
          const taskId = await feedbackToTask(
            activeProject,
            srcPost,
            dstDroppable.statusId,
            feedback,
            roadmap,
            srcSearchKey,
            dstSearchKey,
            dstIndex);
        } catch (e) {
          !!dstSearchKey && removeFromSearch(activeProject, dstSearchKey, taskId);
          !!srcSearchKey && !!srcIndex && addToSearch(activeProject, srcSearchKey, srcIndex, srcPost.ideaId);
          throw e;
        }
        await onHandled?.(dstDroppable, srcPost);
        return true;
      } else {
        return false;
      }

    default:
      return false;
  }
};

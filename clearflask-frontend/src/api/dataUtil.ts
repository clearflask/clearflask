import { ConfViewIdeaList, GetIdeasRequest } from "./client";

export const getSearchKey = (r:GetIdeasRequest) => {
  return JSON.stringify([
    r.limit,
    r.sortBy,
    r.filterIdeaStatusIds && r.filterIdeaStatusIds.sort() || [],
    r.filterIdeaGroupIds && r.filterIdeaGroupIds.sort() || [],
    r.filterIdeaTagIds && r.filterIdeaTagIds.sort() || [],
    r.search || '',
  ]);
};

export const mapIdeaListToRequest = (
    ideaList:ConfViewIdeaList,
    limit?:number,
    search?:string,
    cursor?:string,
  ):GetIdeasRequest => {return{
    limit: limit || 10,
    sortBy: ideaList.sortBy,
    filterIdeaStatusIds: ideaList.filterIdeaStatusIds,
    filterIdeaGroupIds: ideaList.filterIdeaGroupIds,
    filterIdeaTagIds: ideaList.filterIdeaTagIds,
    search: search,
    cursor: cursor,
}};

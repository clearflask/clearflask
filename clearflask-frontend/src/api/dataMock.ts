import * as Admin from "./admin";
import ServerMock from "./serverMock";
import { fillerText } from "../common/util/fillerText";

class DataMock {
  projectId:string;

  constructor(projectId:string) {
    this.projectId = projectId;
  }

  static get(projectId:string):DataMock {
    return new DataMock(projectId);
  }

  mockItems():Promise<void> {
    ServerMock.get().setLatency(false);
    return ServerMock.get().configGetAdmin({projectId: this.projectId}).then(versionedConfig => versionedConfig.config.content.categories.forEach(category => {
      [undefined, ...category.workflow.statuses].forEach(status => {
        [undefined, ...category.tagging.tags].forEach(tag => {
          ServerMock.get().userCreateAdmin({
            projectId: versionedConfig.config.projectId,
            create: {
              name: fillerText(2,2,3,10),
              email: 'example@example.com',
            },
          }).then(user => ServerMock.get().ideaCreateAdmin({
            projectId: versionedConfig.config.projectId,
            idea: {
              authorUserId: user.userId,
              title: fillerText(2,10,3,10),
              description: fillerText(2,40,3,10),
              categoryId: category.categoryId,
              tagIds: tag ? [tag.tagId] : [],
              statusId: status ? status.statusId : undefined,
              created: new Date(Math.random() * new Date().getTime()),
            },
          }).then(item => ((numComments)=>{while(numComments-- > 0) ServerMock.get().commentCreateAdmin({
            projectId: versionedConfig.config.projectId,
            ideaId: item.ideaId,
            comment: {
              authorUserId: user.userId,
              content: fillerText(2,40,3,10),
              created: new Date(Math.random() * new Date().getTime()),
            },
          }).then(comment => ((numComments)=>{while(numComments-- > 0) ServerMock.get().commentCreateAdmin({
            projectId: versionedConfig.config.projectId,
            ideaId: item.ideaId,
            comment: {
              parentCommentId: comment.commentId,
              authorUserId: user.userId,
              content: fillerText(2,40,3,10),
              created: new Date(Math.random() * new Date().getTime()),
            },
          }).then(subComment => ((numComments)=>{while(numComments-- > 0) ServerMock.get().commentCreateAdmin({
            projectId: versionedConfig.config.projectId,
            ideaId: item.ideaId,
            comment: {
              parentCommentId: subComment.commentId,
              authorUserId: user.userId,
              content: fillerText(2,40,3,10),
              created: new Date(Math.random() * new Date().getTime()),
            },
          })})(Math.random() * 2))})(Math.random() * 2))})(Math.random() * 2))
          .then(() => ServerMock.get().setLatency(true))
          );
        });
      });
    }));
  }
}

export default DataMock;

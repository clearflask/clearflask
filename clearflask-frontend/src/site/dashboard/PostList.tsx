import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import PanelPost, { Direction } from '../../app/comps/PanelPost';
import { buttonHover, buttonSelected } from '../../common/util/cssUtil';

const styles = (theme: Theme) => createStyles({
  post: {
    ...buttonHover(theme),
    '&:hover $title': {
      textDecoration: 'underline',
    },
    cursor: 'pointer',
  },
  postSelected: {
    ...buttonSelected(theme),
  },
  postSimilar: {
    minWidth: 'unset',
  },
});
interface Props {
  server: Server;
  search?: Partial<Admin.IdeaSearchAdmin>;
  selectedPostId?: string;
  onClickPost: (postId: string) => void;
  onUserClick: (userId: string) => void;
  layoutSimilar?: boolean;
  dragndrop?: boolean;
}
interface ConnectProps {
  configver?: string;
  config?: Client.Config;
  loggedInUserId?: string;
}
class PostList extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {

  render() {
    const panel = {
      display: !this.props.layoutSimilar ? {
        titleTruncateLines: 2,
        descriptionTruncateLines: 2,
        responseTruncateLines: 0,
        showCommentCount: true,
        showCreated: false,
        showAuthor: false,
        showStatus: true,
        showTags: true,
        showVoting: true,
        showFunding: false,
        showExpression: true,
        showEdit: false,
      } : {
        titleTruncateLines: 2,
        descriptionTruncateLines: 0,
        responseTruncateLines: 0,
        showCommentCount: false,
        showCategoryName: false,
        showCreated: false,
        showAuthor: false,
        showStatus: false,
        showTags: false,
        showVoting: false,
        showFunding: false,
        showExpression: false,
      },
      search: {},
      hideIfEmpty: false,
    };
    var result = (
      <PanelPost
        direction={Direction.Vertical}
        postClassName={classNames(
          this.props.classes.post,
          this.props.layoutSimilar && this.props.classes.postSimilar,
        )}
        selectedPostId={this.props.selectedPostId}
        selectedPostClassName={this.props.classes.postSelected}
        suppressPanel
        panel={panel}
        widthExpand
        widthExpandMargin={this.props.theme.spacing(2)}
        showDivider={!this.props.layoutSimilar}
        searchOverrideAdmin={this.props.search}
        server={this.props.server}
        onClickPost={this.props.onClickPost}
      // wrapPost={!this.props.dragndrop ? undefined : (post, content, index) => (
      //   <Draggable draggableId={post.ideaId} index={index}>
      //     {(provided, snapshot) => (
      //       <div
      //         ref={provided.innerRef}
      //         {...provided.draggableProps}
      //         {...provided.dragHandleProps}
      //       >
      //         {content}
      //       </div>
      //     )}
      //   </Draggable>
      // )}
      />
    );
    // if (this.props.dragndrop) {
    //   const searchKey = getSearchKey({
    //     ...panel.search,
    //     ...this.props.search,
    //   });
    //   result = (
    //     <Droppable droppableId={searchKey}>
    //       {(provided, snapshot) => (
    //         <div
    //           ref={provided.innerRef}
    //           style={{ backgroundColor: snapshot.isDraggingOver ? 'blue' : 'grey' }}
    //           {...provided.droppableProps}
    //         >
    //           <h2>I am a droppable!</h2>
    //           {result}
    //           {provided.placeholder}
    //         </div>
    //       )}
    //     </Droppable>
    //   );
    // }
    return result;
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const newProps: ConnectProps = {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
    loggedInUserId: state.users.loggedIn.user ? state.users.loggedIn.user.userId : undefined,
  };
  return newProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(PostList));

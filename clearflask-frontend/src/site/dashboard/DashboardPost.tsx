import { TextField } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import Post from '../../app/comps/Post';
import { PostEditStatusAndResponseInline, PostEditTagsInline } from '../../app/comps/PostEdit';
import FilterControls, { FilterControlBase } from '../../common/search/FilterControls';
import keyMapper from '../../common/util/keyMapper';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    alignItems: 'stretch',
    height: '100%',
  },
  main: {
    display: 'flex',
    flex: '1 1 0px',
  },
  properties: {
    display: 'flex',
    flex: '0 1 100px',
  },
});
interface Props {
  server: Server;
  postId: string;
  onClickPost: (postId: string) => void;
  onUserClick: (userId: string) => void;
}
interface ConnectProps {
  callOnMount?: () => void,
  post?: Client.Idea;
}
class DashboardPost extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {

  constructor(props) {
    super(props);

    props.callOnMount?.();
  }

  render() {
    const nakedTextFieldProps: Partial<React.ComponentProps<typeof TextField>> = {
      InputProps: { disableUnderline: true, },
      variant: 'standard',
      label: '',
    };
    return (
      <div className={this.props.classes.container}>
        <Post
          className={this.props.classes.main}
          server={this.props.server}
          idea={this.props.post}
          variant='dashboard'
          onClickPost={this.props.onClickPost}
          onUserClick={this.props.onUserClick}
        />
        {/* <DividerVertical /> */}
        <div>
          <FilterControls>
            {/* Link to post */}
            {/* Author */}
            {/* Created */}
            {/* Category */}
            {/* Status */}
            {/* Tags */}
            <FilterControlBase name='Tags'>
              <PostEditTagsInline
                server={this.props.server}
                post={this.props.post}
                TextFieldProps={nakedTextFieldProps}
              />
            </FilterControlBase>
            <FilterControlBase name='Status'>
              <PostEditStatusAndResponseInline
                server={this.props.server}
                post={this.props.post}
                TextFieldProps={nakedTextFieldProps}
              />
            </FilterControlBase>
          </FilterControls>
        </div>
      </div>
    );
  }
}

export default keyMapper(
  (ownProps: Props) => ownProps.postId,
  connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
    const newProps: ConnectProps = {};

    const byId = state.ideas.byId[ownProps.postId];
    if (!byId) {
      newProps.callOnMount = () => {
        ownProps.server.dispatch({ ssr: true, ssrStatusPassthrough: true }).then(d => d.ideaGet({
          projectId: state.projectId!,
          ideaId: ownProps.postId,
        }));
      };
    } else {
      newProps.post = byId.idea;
    }

    return newProps;
  }, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(DashboardPost)));

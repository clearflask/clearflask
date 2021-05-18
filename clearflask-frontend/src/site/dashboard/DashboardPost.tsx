import { IconButton, InputAdornment, TextField, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import OpenIcon from '@material-ui/icons/OpenInNew';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import TimeAgo from 'react-timeago';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import Post from '../../app/comps/Post';
import { CategoryTagsSelectable, PostEditStatusAndResponseInline, PostEditTagsInline } from '../../app/comps/PostEdit';
import CopyIcon from '../../common/icon/CopyIcon';
import FilterControls, { FilterControlBase } from '../../common/search/FilterControls';
import UserWithAvatarDisplay from '../../common/UserWithAvatarDisplay';
import keyMapper from '../../common/util/keyMapper';
import windowIso from '../../common/windowIso';

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
    width: 268, // min size for RichEditor within
  },
  property: {
    padding: theme.spacing(0, 1),
  },
  space: {
    margin: theme.spacing(5),
  },
  fixBaseline: {
    display: 'flex',
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
  category?: Client.Category;
  domain?: string;
  slug?: string;
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
      fullWidth: false,
      label: '',
      className: this.props.classes.property,
    };
    const postLink = (!this.props.slug || !this.props.post) ? undefined
      : `${windowIso.location.protocol}//${this.props.domain || `${this.props.slug}.${windowIso.location.host}`}/post/${this.props.post.ideaId}`;
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
        <div className={this.props.classes.properties}>
          <FilterControls>
            {this.props.post && this.renderPropertyBase('Author', (
              <UserWithAvatarDisplay
                user={{
                  userId: this.props.post.authorUserId,
                  isMod: this.props.post.authorIsMod,
                  name: this.props.post.authorName,
                }}
                onClick={this.props.onUserClick}
              />
            ))}
            {this.props.post && this.renderPropertyBase('Created', (
              <TimeAgo date={this.props.post.created} />
            ))}

            <div className={this.props.classes.space} />

            {this.props.category && this.renderPropertyBase('Category', (
              <div style={{ color: this.props.category.color }}>
                {this.props.category.name}
              </div>
            ))}
            {(!!this.props.post?.tagIds.length || CategoryTagsSelectable(this.props.category, this.props.server.isModOrAdminLoggedIn())) && (
              <FilterControlBase name='Tags' oneLine oneLineAllowWrap>
                <PostEditTagsInline
                  server={this.props.server}
                  post={this.props.post}
                  TextFieldProps={{
                    ...nakedTextFieldProps,

                    className: classNames(
                      this.props.classes.property,
                      this.props.classes.fixBaseline
                    ),
                  }}
                />
              </FilterControlBase>
            )}
            <FilterControlBase name='Status' oneLine oneLineAllowWrap>
              <PostEditStatusAndResponseInline
                server={this.props.server}
                post={this.props.post}
                TextFieldPropsStatus={{
                  ...nakedTextFieldProps,
                  className: classNames(
                    this.props.classes.property,
                    this.props.classes.fixBaseline
                  ),
                }}
                TextFieldPropsResponse={{
                  label: undefined,
                }}
                showResponseOnlyWithStatus
              />
            </FilterControlBase>

            <div className={this.props.classes.space} />

            {!!postLink && this.renderPropertyTextField(
              'Link',
              postLink,
              nakedTextFieldProps,
              true,
              true,
            )}
            {!!this.props.post && this.renderPropertyTextField(
              'ID',
              this.props.post.ideaId,
              nakedTextFieldProps,
              true,
            )}
          </FilterControls>
        </div>
      </div>
    );
  }

  renderPropertyBase(key?: string, value?: React.ReactNode) {
    return (
      <FilterControlBase name={key} oneLine oneLineAllowWrap>
        <div className={this.props.classes.property}>
          <Typography>
            {value}
          </Typography>
        </div>
      </FilterControlBase>
    );
  }

  renderPropertyTextField(
    name?: string,
    value?: string,
    TextFieldProps?: Partial<React.ComponentProps<typeof TextField>>,
    allowCopy?: boolean,
    isLink?: boolean,
  ) {
    return (
      <FilterControlBase name={name} oneLine>
        <div className={this.props.classes.property}>
          <Typography>
            <TextField
              {...TextFieldProps}
              className={classNames(
                TextFieldProps?.className,
                this.props.classes.fixBaseline
              )}
              value={value}
              InputProps={{
                ...TextFieldProps?.InputProps,
                endAdornment: (!allowCopy && !isLink) ? undefined : (
                  <InputAdornment position='end'>
                    {allowCopy && (
                      <IconButton
                        size='small'
                        aria-label='Copy'
                        onClick={() => !windowIso.isSsr && value && windowIso.navigator.clipboard?.writeText(value)}
                      >
                        <CopyIcon fontSize='small' />
                      </IconButton>
                    )}
                    {isLink && (
                      <IconButton
                        size='small'
                        aria-label='Open'
                        component='a'
                        href={value}
                      >
                        <OpenIcon fontSize='small' />
                      </IconButton>
                    )}
                  </InputAdornment>
                ),
              }}
            />
          </Typography>
        </div>
      </FilterControlBase>
    );
  }
}

export default keyMapper(
  (ownProps: Props) => ownProps.postId,
  connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
    const newProps: ConnectProps = {
      domain: state.conf.conf?.domain,
      slug: state.conf.conf?.slug,
    };

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

    newProps.category = newProps.post?.categoryId ? state.conf.conf?.content.categories.find(c => c.categoryId === newProps.post?.categoryId) : undefined

    return newProps;
  }, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(DashboardPost)));

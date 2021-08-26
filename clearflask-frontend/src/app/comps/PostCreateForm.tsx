// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, Grid, Switch, TextField, Typography, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import BareTextField from '../../common/BareTextField';
import LinkAltIcon from '../../common/icon/LinkAltIcon';
import SubmitButton from '../../common/SubmitButton';
import debounce, { SearchTypeDebounceTime, SimilarTypeDebounceTime } from '../../common/util/debounce';
import { customShouldComponentUpdate } from '../../common/util/reactUtil';
import { initialWidth } from '../../common/util/screenUtil';
import PostSelection from '../../site/dashboard/PostSelection';
import UserSelection from '../../site/dashboard/UserSelection';
import CategorySelect from './CategorySelect';
import { ConnectedPostById, ConnectedPostsContainer, OutlinePostContent } from './ConnectedPost';
import MyButton from './MyButton';
import { MaxContentWidth, MinContentWidth, PostDescription, PostTitle } from './Post';
import PostConnectDialog from './PostConnectDialog';
import { ClickToEdit, PostEditDescription, PostEditTitle } from './PostEdit';
import StatusSelect from './StatusSelect';
import TagSelect from './TagSelect';

/** If changed, also change in Sanitizer.java */
export const PostTitleMaxLength = 100

const styles = (theme: Theme) => createStyles({
  createFormFields: {
    // (Un)comment these to align with corner
    padding: theme.spacing(1, 2, 2, 0),
  },
  createFormField: {
    margin: theme.spacing(1),
    width: '100%',
  },
  createGridItem: {
    padding: theme.spacing(0, 1),
  },
  postContainer: {
    margin: theme.spacing(4),
    width: 'max-content',
    minWidth: MinContentWidth,
    maxWidth: MaxContentWidth,
  },
  postTitleDesc: {
    margin: theme.spacing(0.5),
  },
  postUser: {
    paddingTop: theme.spacing(1),
  },
  postFooter: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    minHeight: 50,
    margin: theme.spacing(1, 0),
    columnGap: theme.spacing(2),
  },
  postNotify: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: theme.spacing(2),
  },
  postTitle: {
    margin: theme.spacing(1),
  },
  postDescriptionAdd: {
    margin: theme.spacing(2, 0),
    fontStyle: 'italic',
  },
  postDescriptionEdit: {
    margin: theme.spacing(1, 0),
  },
  postNotifyEnvelope: {
    margin: theme.spacing(4),
    rowGap: theme.spacing(2),
    maxWidth: 'max-content',
  },
  postNotifyAndLink: {
    display: 'flex',
    flexWrap: 'wrap-reverse',
  },
  postLinksFrom: {
    margin: theme.spacing(2),
  },
  grow: {
    flexGrow: 1,
  },
  buttonDiscard: {
    color: theme.palette.error.dark,
  },
});

interface Props {
  server: Server;
  type?: 'regular' | 'large' | 'post';
  isDashboard?: boolean;
  mandatoryTagIds?: Array<string>;
  mandatoryCategoryIds?: Array<string>;
  titleInputRef?: React.RefObject<HTMLInputElement>;
  searchSimilar?: (text?: string, chosenCategoryId?: string) => void; // For similar search
  logInAndGetUserId: () => Promise<string>;
  onCreated?: (postId: string) => void;
  adminControlsDefaultVisibility?: 'expanded' | 'hidden' | 'none';
  defaultTitle?: string;
  defaultDescription?: string;
  unauthenticatedSubmitButtonTitle?: string;
  labelDescription?: string;
  labelTitle?: string;
  externalSubmit?: (onSubmit?: () => Promise<string>) => void;
  draftId?: string;
  onDiscarded?: () => void;
  onDraftCreated?: (draft: Admin.IdeaDraftAdmin) => void;
}
interface ConnectProps {
  configver?: string;
  categories?: Client.Category[];
  loggedInUserId?: string;
  draft?: Admin.IdeaDraftAdmin;
  callOnMount?: () => void,
}
interface State {
  /**
   * It is imperative only draft fields start with 'draftField' as
   * some logic below depends on this.
   */
  draftFieldTitle?: string;
  draftFieldDescription?: string;
  draftFieldAuthorId?: string;
  draftFieldChosenCategoryId?: string;
  draftFieldChosenTagIds?: string[];
  draftFieldChosenStatusId?: string;
  draftFieldNotifySubscribers?: boolean;
  draftFieldNotifyTitle?: string;
  draftFieldNotifyBody?: string;
  draftFieldLinkedFromPostIds?: string[];
  tagSelectHasError?: boolean;
  isSubmitting?: boolean;
  adminControlsExpanded?: boolean;
  postDescriptionEditing?: boolean;
  discardDraftDialogOpen?: boolean;
  connectDialogOpen?: boolean;
}

class PostCreateForm extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & RouteComponentProps & WithWidthProps, State> {
  readonly panelSearchRef: React.RefObject<any> = React.createRef();
  readonly searchSimilarDebounced?: (title?: string, categoryId?: string) => void;
  externalSubmitEnabled: boolean = false;

  constructor(props) {
    super(props);

    this.state = {
      adminControlsExpanded: props.adminControlsDefaultVisibility === 'expanded',
    };

    this.searchSimilarDebounced = !props.searchSimilar ? undefined : debounce(
      (title?: string, categoryId?: string) => !!title && this.props.searchSimilar?.(title, categoryId),
      this.props.type === 'post' ? SimilarTypeDebounceTime : SearchTypeDebounceTime);
  }

  shouldComponentUpdate = customShouldComponentUpdate({
    nested: new Set(['mandatoryTagIds', 'mandatoryCategoryIds']),
    presence: new Set(['externalSubmit', 'searchSimilar', 'logInAndGetUserId', 'onCreated', 'onDraftCreated', 'callOnMount']),
  });

  componentDidMount() {
    this.props.callOnMount?.();
  }

  render() {
    // Merge defaults, server draft, and local changes into one draft
    const draft: Partial<Admin.IdeaDraftAdmin> = {
      authorUserId: this.props.loggedInUserId,
      title: this.props.defaultTitle,
      description: this.props.defaultDescription,
      tagIds: [],
      ...this.props.draft,
      draftId: this.props.draftId
    };

    const showModOptions = this.showModOptions();
    const categoryOptions = (this.props.mandatoryCategoryIds?.length
      ? this.props.categories?.filter(c => (showModOptions || c.userCreatable) && this.props.mandatoryCategoryIds?.includes(c.categoryId))
      : this.props.categories?.filter(c => showModOptions || c.userCreatable)
    ) || [];

    if (this.state.draftFieldChosenCategoryId !== undefined) draft.categoryId = this.state.draftFieldChosenCategoryId;
    var selectedCategory = categoryOptions.find(c => c.categoryId === draft.categoryId);
    if (!selectedCategory) {
      selectedCategory = categoryOptions[0];
      draft.categoryId = selectedCategory?.categoryId;
    }
    if (!selectedCategory) return null;
    if (this.state.draftFieldAuthorId !== undefined) draft.authorUserId = this.state.draftFieldAuthorId;
    if (this.state.draftFieldTitle !== undefined) draft.title = this.state.draftFieldTitle;
    if (draft.title === undefined && this.props.type === 'post') draft.title = `New ${selectedCategory.name}`;
    if (this.state.draftFieldDescription !== undefined) draft.description = this.state.draftFieldDescription;
    if (this.state.draftFieldLinkedFromPostIds !== undefined) draft.linkedFromPostIds = this.state.draftFieldLinkedFromPostIds;
    if (this.state.draftFieldChosenTagIds !== undefined) draft.tagIds = this.state.draftFieldChosenTagIds;
    if (draft.tagIds?.length) draft.tagIds = draft.tagIds.filter(tagId => selectedCategory?.tagging.tags.some(t => t.tagId === tagId));
    if (this.props.mandatoryTagIds?.length) draft.tagIds = [...(draft.tagIds || []), ...this.props.mandatoryTagIds];
    if (this.state.draftFieldChosenStatusId !== undefined) draft.statusId = this.state.draftFieldChosenStatusId;
    if (draft.statusId && !selectedCategory.workflow.statuses.some(s => s.statusId === draft.statusId)) draft.statusId = undefined;
    if (this.state.draftFieldNotifySubscribers !== undefined) draft.notifySubscribers = !this.state.draftFieldNotifySubscribers ? undefined : {
      title: `New ${selectedCategory.name}`,
      body: `Check out my new post '${draft.title || selectedCategory.name}'`,
      ...draft.notifySubscribers,
      ...(this.state.draftFieldNotifyTitle !== undefined ? {
        title: this.state.draftFieldNotifyTitle,
      } : {}),
      ...(this.state.draftFieldNotifyBody !== undefined ? {
        body: this.state.draftFieldNotifyBody,
      } : {}),
    };

    const enableSubmit = !!draft.title && !!draft.categoryId && !this.state.tagSelectHasError;
    if (this.props.externalSubmit && this.externalSubmitEnabled !== enableSubmit) {
      this.externalSubmitEnabled = enableSubmit;
      this.props.externalSubmit(enableSubmit ? () => this.createClickSubmit(draft) : undefined);
    }

    if (this.props.type !== 'post') {
      return this.renderRegularAndLarge(draft, categoryOptions, selectedCategory, enableSubmit);
    } else {
      return this.renderPost(draft, categoryOptions, selectedCategory, enableSubmit);
    }
  }

  renderRegularAndLarge(draft: Partial<Admin.IdeaDraftAdmin>, categoryOptions: Client.Category[], selectedCategory?: Client.Category, enableSubmit?: boolean) {
    const editCategory = this.renderEditCategory(draft, categoryOptions, selectedCategory, { className: this.props.classes.createFormField });
    const editStatus = this.renderEditStatus(draft, selectedCategory);
    const editUser = this.renderEditUser(draft, { className: this.props.classes.createFormField });
    const editLinks = this.renderEditLinks(draft, { className: this.props.classes.createFormField });
    const editNotify = this.renderEditNotify(draft, selectedCategory);
    const editNotifyTitle = this.renderEditNotifyTitle(draft, selectedCategory, { className: this.props.classes.createFormField });
    const editNotifyBody = this.renderEditNotifyBody(draft, selectedCategory, { className: this.props.classes.createFormField });
    const buttonDiscard = this.renderButtonDiscard();
    const buttonDraftSave = this.renderButtonSaveDraft(draft);
    const buttonSubmit = this.renderButtonSubmit(draft, enableSubmit);

    return (
      <Grid
        container
        justify={this.props.type === 'large' ? 'flex-end' : undefined}
        alignItems='flex-start'
        className={this.props.classes.createFormFields}
      >
        <Grid item xs={12} className={this.props.classes.createGridItem}>
          {this.renderEditTitle(draft, { TextFieldProps: { className: this.props.classes.createFormField } })}
        </Grid>
        {this.props.type === 'large' && (
          <Grid item xs={3} className={this.props.classes.createGridItem} />
        )}
        <Grid item xs={12} className={this.props.classes.createGridItem}>
          {this.renderEditDescription(draft, { RichEditorProps: { className: this.props.classes.createFormField } })}
        </Grid>
        {!!editCategory && (
          <Grid item xs={this.props.type === 'large' ? 6 : 12} className={this.props.classes.createGridItem}>
            {editCategory}
          </Grid>
        )}
        {!!editStatus && (
          <Grid item xs={this.props.type === 'large' ? 6 : 12} className={this.props.classes.createGridItem}>
            <div className={this.props.classes.createFormField}>
              {editStatus}
            </div>
          </Grid>
        )}
        {this.renderEditTags(draft, selectedCategory, {
          wrapper: (children) => (
            <Grid item xs={this.props.type === 'large' ? 6 : 12} className={this.props.classes.createGridItem}>
              <div className={this.props.classes.createFormField}>
                {children}
              </div>
            </Grid>
          )
        })}
        {!!editLinks && (
          <Grid item xs={this.props.type === 'large' ? 6 : 12} className={this.props.classes.createGridItem}>
            {editLinks}
          </Grid>
        )}
        {!!editUser && (
          <Grid item xs={this.props.type === 'large' ? 6 : 12} className={this.props.classes.createGridItem} justify='flex-end'>
            {editUser}
          </Grid>
        )}
        {!!editNotify && (
          <Grid item xs={12} className={this.props.classes.createGridItem}>
            {editNotify}
          </Grid>
        )}
        {!!editNotifyTitle && (
          <Grid item xs={12} className={this.props.classes.createGridItem}>
            {editNotifyTitle}
          </Grid>
        )}
        {!!editNotifyBody && (
          <Grid item xs={12} className={this.props.classes.createGridItem}>
            {editNotifyBody}
          </Grid>
        )}
        {this.props.type === 'large' && (
          <Grid item xs={6} className={this.props.classes.createGridItem} />
        )}
        <Grid item xs={this.props.type === 'large' ? 6 : 12} container justify='flex-end' className={this.props.classes.createGridItem}>
          <Grid item>
            {this.props.adminControlsDefaultVisibility !== 'none'
              && this.props.server.isModOrAdminLoggedIn()
              && !this.state.adminControlsExpanded && (
                <Button
                  onClick={e => this.setState({ adminControlsExpanded: true })}
                >
                  Admin
                </Button>
              )}
            {buttonDiscard}
            {buttonDraftSave}
            {buttonSubmit}
          </Grid>
        </Grid>
      </Grid>
    );
  }

  renderPost(
    draft: Partial<Admin.IdeaDraftAdmin>,
    categoryOptions: Client.Category[],
    selectedCategory?: Client.Category,
    enableSubmit?: boolean,
  ) {
    const editTitle = (
      <PostTitle
        variant='page'
        title={draft.title || ''}
        editable={title => (this.renderEditTitle(draft, {
          bare: true,
          autoFocusAndSelect: !this.props.draftId, // Only focus on completely fresh forms
        }))}
      />
    );
    const editDescription = (
      <ClickToEdit
        isEditing={!!this.state.postDescriptionEditing}
        setIsEditing={isEditing => this.setState({ postDescriptionEditing: isEditing })}
      >
        {!this.state.postDescriptionEditing
          ? (draft.description
            ? (<PostDescription variant='page' description={draft.description} />)
            : (<Typography className={this.props.classes.postDescriptionAdd}>Add description</Typography>)
          )
          : this.renderEditDescription(draft, {
            bare: true,
            forceOutline: true,
            RichEditorProps: {
              autoFocusAndSelect: true,
              className: this.props.classes.postDescriptionEdit,
              onBlur: () => this.setState({ postDescriptionEditing: false })
            },
          })}
      </ClickToEdit>
    );
    const editCategory = this.renderEditCategory(draft, categoryOptions, selectedCategory, {
      SelectionPickerProps: {
        forceDropdownIcon: true,
        TextFieldComponent: BareTextField,
      },
    });
    const editStatus = this.renderEditStatus(draft, selectedCategory, {
      SelectionPickerProps: {
        width: 'unset',
        forceDropdownIcon: true,
        TextFieldComponent: BareTextField,
      },
    });
    const editTags = this.renderEditTags(draft, selectedCategory, {
      SelectionPickerProps: {
        width: 'unset',
        forceDropdownIcon: true,
        clearIndicatorNeverHide: true,
        limitTags: 3,
        TextFieldComponent: BareTextField,
        ...(!draft.tagIds?.length ? {
          placeholder: 'Add tags',
          inputMinWidth: 60,
        } : {}),
      },
    });
    const editUser = this.renderEditUser(draft, {
      className: this.props.classes.postUser,
      SelectionPickerProps: {
        width: 'unset',
        forceDropdownIcon: true,
        TextFieldComponent: BareTextField,
        TextFieldProps: {
          fullWidth: false,
        },
      },
    });
    const editNotify = this.renderEditNotify(draft, selectedCategory);
    const editNotifyTitle = this.renderEditNotifyTitle(draft, selectedCategory, ({
      autoFocus: false,
      autoFocusAndSelect: !this.props.draftId, // Only focus on completely fresh forms
      singlelineWrap: true,
    } as React.ComponentProps<typeof BareTextField>) as any, BareTextField);
    const editNotifyBody = this.renderEditNotifyBody(draft, selectedCategory, ({
      singlelineWrap: true,
    } as React.ComponentProps<typeof BareTextField>) as any, BareTextField);
    const viewLinks = this.renderViewLinks(draft);
    const buttonLink = this.renderButtonLink();
    const buttonDiscard = this.renderButtonDiscard();
    const buttonDraftSave = this.renderButtonSaveDraft(draft);
    const buttonSubmit = this.renderButtonSubmit(draft, enableSubmit);

    return (
      <div className={this.props.classes.postContainer}>
        <div className={this.props.classes.postTitleDesc}>
          {editUser}
          {editTitle}
          {editDescription}
        </div>
        {(!!editCategory || !!editStatus || !!editTags) && (
          <div className={this.props.classes.postFooter}>
            {editCategory}
            {editStatus}
            {editTags}
          </div>
        )}
        {viewLinks}
        <div className={this.props.classes.postNotify}>
          {(!!editNotify || !!buttonLink) && (
            <div className={this.props.classes.postNotifyAndLink}>
              {editNotify}
              <div className={this.props.classes.grow} />
              {buttonLink}
            </div>
          )}
          {(editNotifyTitle || editNotifyBody) && (
            <OutlinePostContent className={this.props.classes.postNotifyEnvelope}>
              <Typography variant='h5' component='div'>{editNotifyTitle}</Typography>
              <Typography variant='body1' component='div'>{editNotifyBody}</Typography>
            </OutlinePostContent>
          )}
        </div>
        <DialogActions>
          {buttonDiscard}
          {buttonDraftSave}
          {buttonSubmit}
        </DialogActions>
      </div>
    );
  }

  renderEditTitle(draft: Partial<Admin.IdeaDraftAdmin>, PostEditTitleProps?: Partial<React.ComponentProps<typeof PostEditTitle>>): React.ReactNode {
    return (
      <PostEditTitle
        value={draft.title || ''}
        onChange={value => {
          this.setState({ draftFieldTitle: value })
          if ((draft.title || '') !== value) {
            this.searchSimilarDebounced?.(value, draft.categoryId);
          }
        }}
        isSubmitting={this.state.isSubmitting}
        {...PostEditTitleProps}
        TextFieldProps={{
          size: this.props.type === 'large' ? 'medium' : 'small',
          ...(this.props.labelTitle ? { label: this.props.labelTitle } : {}),
          InputProps: {
            inputRef: this.props.titleInputRef,
          },
          ...PostEditTitleProps?.TextFieldProps,
        }}
      />
    );
  }
  renderEditDescription(draft: Partial<Admin.IdeaDraftAdmin>, PostEditDescriptionProps?: Partial<React.ComponentProps<typeof PostEditDescription>>): React.ReactNode {
    return (
      <PostEditDescription
        server={this.props.server}
        postAuthorId={draft.authorUserId}
        isSubmitting={this.state.isSubmitting}
        value={draft.description || ''}
        onChange={value => {
          if (draft.description === value
            || (!draft.description && !value)) {
            return;
          }
          this.setState({ draftFieldDescription: value });
        }}
        {...PostEditDescriptionProps}
        RichEditorProps={{
          size: this.props.type === 'large' ? 'medium' : 'small',
          minInputHeight: this.props.type === 'large' ? 60 : undefined,
          ...(this.props.labelDescription ? { label: this.props.labelDescription } : {}),
          autoFocusAndSelect: false,
          ...PostEditDescriptionProps?.RichEditorProps,
        }}
      />
    );
  }
  renderEditCategory(
    draft: Partial<Admin.IdeaDraftAdmin>,
    categoryOptions: Client.Category[],
    selectedCategory?: Client.Category,
    CategorySelectProps?: Partial<React.ComponentProps<typeof CategorySelect>>,
  ): React.ReactNode | null {
    if (categoryOptions.length <= 1) return null;
    return (
      <CategorySelect
        variant='outlined'
        size={this.props.type === 'large' ? 'medium' : 'small'}
        label='Category'
        categoryOptions={categoryOptions}
        value={selectedCategory?.categoryId || ''}
        onChange={categoryId => {
          if (categoryId === draft.categoryId) return;
          this.searchSimilarDebounced?.(draft.title, categoryId);
          this.setState({ draftFieldChosenCategoryId: categoryId });
        }}
        errorText={!selectedCategory ? 'Choose a category' : undefined}
        disabled={this.state.isSubmitting}
        {...CategorySelectProps}
      />
    );
  }
  renderEditStatus(
    draft: Partial<Admin.IdeaDraftAdmin>,
    selectedCategory?: Client.Category,
    StatusSelectProps?: Partial<React.ComponentProps<typeof StatusSelect>>,
  ): React.ReactNode | null {
    if (!this.showModOptions() || !selectedCategory?.workflow.statuses.length) return null;
    return (
      <StatusSelect
        show='all'
        workflow={selectedCategory?.workflow}
        variant='outlined'
        size={this.props.type === 'large' ? 'medium' : 'small'}
        disabled={this.state.isSubmitting}
        initialStatusId={selectedCategory.workflow.entryStatus}
        statusId={draft.statusId}
        onChange={(statusId) => this.setState({ draftFieldChosenStatusId: statusId })}
        {...StatusSelectProps}
      />
    );
  }
  renderEditTags(
    draft: Partial<Admin.IdeaDraftAdmin>,
    selectedCategory?: Client.Category,
    TagSelectProps?: Partial<React.ComponentProps<typeof TagSelect>>,
  ): React.ReactNode | null {
    if (!selectedCategory?.tagging.tagGroups.length) return null;
    return (
      <TagSelect
        variant='outlined'
        size={this.props.type === 'large' ? 'medium' : 'small'}
        label='Tags'
        category={selectedCategory}
        tagIds={draft.tagIds}
        isModOrAdminLoggedIn={this.showModOptions()}
        onChange={(tagIds, errorStr) => this.setState({
          draftFieldChosenTagIds: tagIds,
          tagSelectHasError: !!errorStr,
        })}
        disabled={this.state.isSubmitting}
        mandatoryTagIds={this.props.mandatoryTagIds}
        {...TagSelectProps}
        SelectionPickerProps={{
          limitTags: 1,
          ...TagSelectProps?.SelectionPickerProps,
        }}
      />
    );
  }
  renderEditUser(
    draft: Partial<Admin.IdeaDraftAdmin>,
    UserSelectionProps?: Partial<React.ComponentProps<typeof UserSelection>>,
  ): React.ReactNode | null {
    if (!this.showModOptions()) return null;
    return (
      <UserSelection
        variant='outlined'
        size={this.props.type === 'large' ? 'medium' : 'small'}
        server={this.props.server}
        label='As user'
        errorMsg='Select author'
        width='100%'
        disabled={this.state.isSubmitting}
        suppressInitialOnChange
        initialUserId={draft.authorUserId}
        onChange={selectedUserLabel => this.setState({ draftFieldAuthorId: selectedUserLabel?.value })}
        allowCreate
        {...UserSelectionProps}
      />
    );
  }
  renderEditNotify(
    draft: Partial<Admin.IdeaDraftAdmin>,
    selectedCategory?: Client.Category,
    FormControlLabelProps?: Partial<React.ComponentProps<typeof FormControlLabel>>,
    SwitchProps?: Partial<React.ComponentProps<typeof Switch>>,
  ): React.ReactNode | null {
    if (!this.showModOptions()
      || !selectedCategory?.subscription) return null;
    return (
      <FormControlLabel
        disabled={this.state.isSubmitting}
        control={(
          <Switch
            checked={!!draft.notifySubscribers}
            onChange={(e, checked) => this.setState({
              draftFieldNotifySubscribers: !draft.notifySubscribers,
              draftFieldNotifyTitle: undefined,
              draftFieldNotifyBody: undefined,
            })}
            color='primary'
            {...SwitchProps}
          />
        )}
        label='Notify all subscribers'
        {...FormControlLabelProps}
      />
    );
  }
  renderEditNotifyTitle(
    draft: Partial<Admin.IdeaDraftAdmin>,
    selectedCategory?: Client.Category,
    TextFieldProps?: Partial<React.ComponentProps<typeof TextField>>,
    TextFieldComponent?: React.ElementType<React.ComponentProps<typeof TextField>>,
  ): React.ReactNode {
    if (!this.showModOptions()
      || !selectedCategory?.subscription
      || !draft.notifySubscribers) return null;
    const TextFieldCmpt = TextFieldComponent || TextField;
    return (
      <TextFieldCmpt
        variant='outlined'
        size={this.props.type === 'large' ? 'medium' : 'small'}
        disabled={this.state.isSubmitting}
        label='Notification Title'
        value={draft.notifySubscribers.title || ''}
        onChange={e => this.setState({ draftFieldNotifyTitle: e.target.value })}
        autoFocus
        {...TextFieldProps}
        inputProps={{
          maxLength: PostTitleMaxLength,
          ...TextFieldProps?.inputProps,
        }}
      />
    );
  }
  renderEditNotifyBody(
    draft: Partial<Admin.IdeaDraftAdmin>,
    selectedCategory?: Client.Category,
    TextFieldProps?: Partial<React.ComponentProps<typeof TextField>>,
    TextFieldComponent?: React.ElementType<React.ComponentProps<typeof TextField>>,
  ): React.ReactNode {
    if (!this.showModOptions()
      || !selectedCategory?.subscription
      || !draft.notifySubscribers) return null;
    const TextFieldCmpt = TextFieldComponent || TextField;
    return (
      <TextFieldCmpt
        variant='outlined'
        size={this.props.type === 'large' ? 'medium' : 'small'}
        disabled={this.state.isSubmitting}
        label='Notification Body'
        multiline
        value={draft.notifySubscribers.body || ''}
        onChange={e => this.setState({ draftFieldNotifyBody: e.target.value })}
        {...TextFieldProps}
        inputProps={{
          maxLength: PostTitleMaxLength,
          ...TextFieldProps?.inputProps,
        }}
      />
    );
  }

  renderEditLinks(
    draft: Partial<Admin.IdeaDraftAdmin>,
    PostSelectionProps?: Partial<React.ComponentProps<typeof PostSelection>>,
  ): React.ReactNode | null {
    if (!this.showModOptions()) return null;
    return (
      <PostSelection
        server={this.props.server}
        variant='outlined'
        size={this.props.type === 'large' ? 'medium' : 'small'}
        disabled={this.state.isSubmitting}
        label='Linked posts'
        isMulti
        initialPostIds={draft.linkedFromPostIds}
        onChange={postIds => this.setState({ draftFieldLinkedFromPostIds: postIds })}
        {...PostSelectionProps}
      />
    );
  }

  renderViewLinks(
    draft: Partial<Admin.IdeaDraftAdmin>,
  ): React.ReactNode | null {
    if (!draft.linkedFromPostIds?.length) return null;

    return (
      <ConnectedPostsContainer
        className={this.props.classes.postLinksFrom}
        type='link'
        direction='from'
        hasMultiple={draft.linkedFromPostIds.length > 1}
      >
        {draft.linkedFromPostIds.map(linkedFromPostId => (
          <ConnectedPostById
            server={this.props.server}
            postId={linkedFromPostId}
            containerPost={draft}
            type='link'
            direction='from'
            onDisconnect={() => this.setState({
              draftFieldLinkedFromPostIds: (this.state.draftFieldLinkedFromPostIds || [])
                .filter(id => id !== linkedFromPostId),
            })}
            PostProps={{
              expandable: false,
            }}
          />
        ))}
      </ConnectedPostsContainer>
    );
  }

  renderButtonLink(): React.ReactNode | null {
    if (!this.props.onDiscarded || !this.props.draftId) return null;

    return (
      <>
        <MyButton
          buttonVariant='post'
          disabled={this.state.isSubmitting}
          Icon={LinkAltIcon}
          onClick={e => this.setState({ connectDialogOpen: true })}
        >
          Link
        </MyButton>
        <PostConnectDialog
          onlyAllowLinkFrom
          server={this.props.server}
          open={!!this.state.connectDialogOpen}
          onClose={() => this.setState({ connectDialogOpen: false })}
          onSubmit={(selectedPostId, action, directionReversed) => this.setState({
            connectDialogOpen: false,
            draftFieldLinkedFromPostIds: [...(new Set([...(this.state.draftFieldLinkedFromPostIds || []), selectedPostId]))],
          })}
        />
      </>
    );
  }

  renderButtonDiscard(
    SubmitButtonProps?: Partial<React.ComponentProps<typeof SubmitButton>>,
  ): React.ReactNode | null {
    if (!this.props.onDiscarded || !this.props.draftId) return null;

    return (
      <>
        <Button
          variant='text'
          color='inherit'
          className={this.props.classes.buttonDiscard}
          disabled={this.state.isSubmitting}
          onClick={e => this.setState({ discardDraftDialogOpen: true })}
          {...SubmitButtonProps}
        >
          Discard
        </Button>
        <Dialog
          open={!!this.state.discardDraftDialogOpen}
          onClose={() => this.setState({ discardDraftDialogOpen: false })}
        >
          <DialogTitle>Delete draft</DialogTitle>
          <DialogContent>
            <DialogContentText>Are you sure you want to permanently delete this draft?</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ discardDraftDialogOpen: false })}
            >Cancel</Button>
            <SubmitButton
              variant='text'
              color='inherit'
              className={this.props.classes.buttonDiscard}
              isSubmitting={this.state.isSubmitting}
              onClick={e => {
                this.discard(this.props.draftId);
                this.setState({ discardDraftDialogOpen: false });
              }}
            >
              Discard
            </SubmitButton>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  renderButtonSaveDraft(
    draft: Partial<Admin.IdeaDraftAdmin>,
    SubmitButtonProps?: Partial<React.ComponentProps<typeof SubmitButton>>,
  ): React.ReactNode | null {
    if (!this.props.onDraftCreated) return null;

    const hasAnyChanges = Object.keys(this.state)
      .some(stateKey => stateKey.startsWith('draftField') && this.state[stateKey] !== undefined);

    return (
      <SubmitButton
        variant='text'
        disabled={!hasAnyChanges}
        isSubmitting={this.state.isSubmitting}
        onClick={e => this.draftSave(draft)}
        {...SubmitButtonProps}
      >
        Save draft
      </SubmitButton>
    );
  }

  renderButtonSubmit(
    draft: Partial<Admin.IdeaDraftAdmin>,
    enableSubmit?: boolean,
    SubmitButtonProps?: Partial<React.ComponentProps<typeof SubmitButton>>,
  ): React.ReactNode | null {
    if (!!this.props.externalSubmit) return null;

    return (
      <SubmitButton
        color='primary'
        variant='contained'
        disableElevation
        isSubmitting={this.state.isSubmitting}
        disabled={!enableSubmit}
        onClick={e => enableSubmit && this.createClickSubmit(draft)}
      >
        {!draft.authorUserId && this.props.unauthenticatedSubmitButtonTitle || 'Submit'}
      </SubmitButton>
    );
  }

  async discard(draftId?: string) {
    if (!this.props.onDiscarded) return;
    this.setState({ isSubmitting: true });
    try {
      if (draftId) {
        await (await this.props.server.dispatchAdmin()).ideaDraftDeleteAdmin({
          projectId: this.props.server.getProjectId(),
          draftId,
        });
      }
      this.props.onDiscarded();
    } finally {
      this.setState({ isSubmitting: false });
    }
  }

  async draftSave(
    draft: Partial<Admin.IdeaDraftAdmin>,
  ) {
    if (!this.props.onDraftCreated) return;

    this.setState({ isSubmitting: true });
    try {
      if (!draft.draftId) {
        const createdDraft = await (await this.props.server.dispatchAdmin()).ideaDraftCreateAdmin({
          projectId: this.props.server.getProjectId(),
          ideaCreateAdmin: {
            ...(draft as Admin.IdeaDraftAdmin),
          },
        });
        this.addCreatedDraftToSearches(createdDraft);
        this.props.onDraftCreated(createdDraft);
      } else {
        await (await this.props.server.dispatchAdmin()).ideaDraftUpdateAdmin({
          projectId: this.props.server.getProjectId(),
          draftId: draft.draftId,
          ideaCreateAdmin: {
            ...(draft as Admin.IdeaDraftAdmin),
          },
        });
      }
      const stateUpdate: Pick<State, keyof State> = {};
      Object.keys(this.state).forEach(stateKey => {
        if (!stateKey.startsWith('draftField')) return;
        stateUpdate[stateKey] = undefined;
      });
      this.setState(stateUpdate);
    } finally {
      this.setState({ isSubmitting: false });
    }
  }

  addCreatedDraftToSearches(draft: Admin.IdeaDraftAdmin) {
    // Warning, very hacky way of doing this.
    // For a long time I've been looking for a way to invalidate/update
    // stale searches. This needs a better solution once I have more time.
    Object.keys(this.props.server.getStore().getState().drafts.bySearch)
      .filter(searchKey => searchKey.includes(draft.categoryId))
      .forEach(searchKey => {
        this.props.server.getStore().dispatch({
          type: 'draftSearchResultAddDraft',
          payload: {
            searchKey,
            draftId: draft.draftId,
          },
        });
      });
  }

  createClickSubmit(
    draft: Partial<Admin.IdeaDraftAdmin>,
  ): Promise<string> {
    if (!!draft.authorUserId) {
      return this.createSubmit(draft);
    } else {
      // open log in page, submit on success
      return this.props.logInAndGetUserId().then(userId => this.createSubmit({
        ...draft,
        authorUserId: userId,
      }));
    }
  }

  async createSubmit(
    draft: Partial<Admin.IdeaDraftAdmin>,
  ): Promise<string> {
    this.setState({ isSubmitting: true });
    var idea: Client.Idea | Admin.Idea;
    try {
      if (this.props.server.isModOrAdminLoggedIn()) {
        idea = await (await this.props.server.dispatchAdmin()).ideaCreateAdmin({
          projectId: this.props.server.getProjectId(),
          deleteDraftId: this.props.draftId,
          ideaCreateAdmin: {
            authorUserId: draft.authorUserId!,
            title: draft.title!,
            description: draft.description,
            categoryId: draft.categoryId!,
            statusId: draft.statusId,
            notifySubscribers: draft.notifySubscribers,
            tagIds: draft.tagIds || [],
            linkedFromPostIds: draft.linkedFromPostIds,
          },
        });
      } else {
        idea = await (await this.props.server.dispatch()).ideaCreate({
          projectId: this.props.server.getProjectId(),
          ideaCreate: {
            authorUserId: draft.authorUserId!,
            title: draft.title!,
            description: draft.description,
            categoryId: draft.categoryId!,
            tagIds: draft.tagIds || [],
          },
        });
      }
    } catch (e) {
      this.setState({
        isSubmitting: false,
      });
      throw e;
    }
    this.setState({
      draftFieldTitle: undefined,
      draftFieldDescription: undefined,
      isSubmitting: false,
    });
    this.props.onCreated?.(idea.ideaId);
    return idea.ideaId;
  }

  showModOptions(): boolean {
    return !!this.state.adminControlsExpanded
      && (this.props.adminControlsDefaultVisibility !== 'none'
        && this.props.server.isModOrAdminLoggedIn());
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  var callOnMount;
  var draft: Admin.IdeaDraftAdmin | undefined;
  if (ownProps.draftId) {
    draft = state.drafts.byId[ownProps.draftId]?.draft;
    if (!draft && state.drafts.byId[ownProps.draftId]?.status === undefined) {
      const draftId = ownProps.draftId;
      callOnMount = () => {
        ownProps.server.dispatchAdmin().then(d => d.ideaDraftGetAdmin({
          projectId: state.projectId!,
          draftId,
        }));
      };
    }
  }
  return {
    configver: state.conf.ver, // force rerender on config change
    categories: state.conf.conf?.content.categories,
    loggedInUserId: state.users.loggedIn.user ? state.users.loggedIn.user.userId : undefined,
    callOnMount,
    draft,
  }
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(withWidth({ initialWidth })(PostCreateForm))));

// import {
//   withQueryParams,
//   StringParam,
//   NumberParam,
//   ArrayParam,
//   withDefault,
//   DecodedValueMap,
//   SetQuery,
//   QueryParamConfig,
// } from 'use-query-params';
import { Button, DialogActions, FormControlLabel, Grid, Switch, TextField, Typography, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import BareTextField from '../../common/BareTextField';
import SubmitButton from '../../common/SubmitButton';
import debounce, { SimilarTypeDebounceTime } from '../../common/util/debounce';
import { customShouldComponentUpdate } from '../../common/util/reactUtil';
import { initialWidth } from '../../common/util/screenUtil';
import UserSelection from '../../site/dashboard/UserSelection';
import CategorySelect from './CategorySelect';
import { OutlinePostContent } from './ConnectedPost';
import { MaxContentWidth, MinContentWidth, PostDescription, PostTitle } from './Post';
import { ClickToEdit, PostEditDescription, PostEditTitle } from './PostEdit';
import { Label } from './SelectionPicker';
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
  logIn: () => Promise<void>;
  onCreated?: (postId: string) => void;
  adminControlsDefaultVisibility?: 'expanded' | 'hidden' | 'none';
  defaultTitle?: string;
  defaultDescription?: string;
  unauthenticatedSubmitButtonTitle?: string;
  labelDescription?: string;
  labelTitle?: string;
  externalSubmit?: (onSubmit?: () => Promise<string>) => void;
}
interface ConnectProps {
  configver?: string;
  categories?: Client.Category[];
  loggedInUserId?: string;
}
interface State {
  newItemTitle?: string;
  newItemDescription?: string;
  newItemAuthorLabel?: Label;
  newItemChosenCategoryId?: string;
  newItemChosenTagIds?: string[];
  newItemChosenStatusId?: string;
  newItemNotifySubscribers?: boolean;
  newItemNotifyTitle?: string;
  newItemNotifyBody?: string;
  newItemTagSelectHasError?: boolean;
  newItemSearchText?: string;
  newItemIsSubmitting?: boolean;
  adminControlsExpanded?: boolean;
  postDescriptionEditing?: boolean;
}

class PostCreateForm extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & RouteComponentProps & WithWidthProps, State> {
  readonly panelSearchRef: React.RefObject<any> = React.createRef();
  readonly searchSimilarDebounced?: (title?: string, categoryId?: string) => void;
  externalSubmitEnabled: boolean = false;

  constructor(props) {
    super(props);

    this.state = {
      adminControlsExpanded: props.adminControlsDefaultVisibility === 'expanded',
      newItemTitle: this.props.type === 'post' ? 'My title' : undefined,
    };

    this.searchSimilarDebounced = !props.searchSimilar ? undefined : debounce(
      (title?: string, categoryId?: string) => !!title && this.props.searchSimilar?.(title, categoryId),
      SimilarTypeDebounceTime);
  }

  static getDerivedStateFromProps(props: React.ComponentProps<typeof PostCreateForm>, state: State): Partial<State> | null {
    const categoryOptions = PostCreateForm.getCategoryOptions(props);
    if (state.newItemChosenCategoryId === undefined
      || !categoryOptions.some(c => c.categoryId === state.newItemChosenCategoryId)) {
      return {
        newItemChosenCategoryId: categoryOptions[0]?.categoryId,
        newItemChosenStatusId: undefined,
        newItemChosenTagIds: undefined,
      };
    }
    return null;
  }

  shouldComponentUpdate = customShouldComponentUpdate({
    nested: new Set(['mandatoryTagIds', 'mandatoryCategoryIds']),
    presence: new Set(['externalSubmit', 'searchSimilar', 'logIn', 'onCreated']),
  });

  render() {
    const categoryOptions = PostCreateForm.getCategoryOptions(this.props);
    const selectedCategory = categoryOptions.find(c => c.categoryId === this.state.newItemChosenCategoryId);
    const enableSubmit = !!this.state.newItemTitle && !!this.state.newItemChosenCategoryId && !this.state.newItemTagSelectHasError;
    if (this.props.externalSubmit && this.externalSubmitEnabled !== enableSubmit) {
      this.externalSubmitEnabled = enableSubmit;
      this.props.externalSubmit(enableSubmit ? () => this.createClickSubmit() : undefined);
    }

    if (this.props.type !== 'post') {
      return this.renderRegularAndLarge(categoryOptions, selectedCategory, enableSubmit);
    } else {
      return this.renderPost(categoryOptions, selectedCategory, enableSubmit);
    }
  }

  renderRegularAndLarge(categoryOptions: Client.Category[], selectedCategory?: Client.Category, enableSubmit?: boolean) {
    const editCategory = this.renderEditCategory(categoryOptions, selectedCategory, { className: this.props.classes.createFormField });
    const editStatus = this.renderEditStatus(selectedCategory);
    const editUser = this.renderEditUser({ className: this.props.classes.createFormField });
    const editNotify = this.renderEditNotify(selectedCategory);
    const editNotifyTitle = this.renderEditNotifyTitle(selectedCategory, { className: this.props.classes.createFormField });
    const editNotifyBody = this.renderEditNotifyBody(selectedCategory, { className: this.props.classes.createFormField });
    const buttonSubmit = this.renderButtonSubmit(enableSubmit);

    return (
      <Grid
        container
        justify={this.props.type === 'large' ? 'flex-end' : undefined}
        alignItems='flex-start'
        className={this.props.classes.createFormFields}
      >
        <Grid item xs={12} className={this.props.classes.createGridItem}>
          {this.renderEditTitle({ TextFieldProps: { className: this.props.classes.createFormField } })}
        </Grid>
        {this.props.type === 'large' && (
          <Grid item xs={3} className={this.props.classes.createGridItem} />
        )}
        <Grid item xs={12} className={this.props.classes.createGridItem}>
          {this.renderEditDescription({ RichEditorProps: { className: this.props.classes.createFormField } })}
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
        {this.renderEditTags(selectedCategory, {
          wrapper: (children) => (
            <Grid item xs={this.props.type === 'large' ? 6 : 12} className={this.props.classes.createGridItem}>
              <div className={this.props.classes.createFormField}>
                {children}
              </div>
            </Grid>
          )
        })}
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
            {PostCreateForm.showModOptions(this.props) && !this.state.adminControlsExpanded && (
              <Button
                onClick={e => this.setState({ adminControlsExpanded: true })}
              >
                More
              </Button>
            )}
            {buttonSubmit}
          </Grid>
        </Grid>
      </Grid>
    );
  }

  renderPost(categoryOptions: Client.Category[], selectedCategory?: Client.Category, enableSubmit?: boolean) {
    const editTitle = (
      <PostTitle
        variant='page'
        title={this.state.newItemTitle || ''}
        editable={title => (this.renderEditTitle({
          bare: true,
          autoFocusAndSelect: true,
        }))}
      />
    );
    const editDescription = (
      <ClickToEdit
        isEditing={!!this.state.postDescriptionEditing}
        setIsEditing={isEditing => this.setState({ postDescriptionEditing: isEditing })}
      >
        {!this.state.postDescriptionEditing
          ? (this.state.newItemDescription
            ? (<PostDescription variant='page' description={this.state.newItemDescription} />)
            : (<Typography className={this.props.classes.postDescriptionAdd}>Add description</Typography>)
          )
          : this.renderEditDescription({
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
    const editCategory = this.renderEditCategory(categoryOptions, selectedCategory, {
      SelectionPickerProps: {
        forceDropdownIcon: true,
        TextFieldComponent: BareTextField,
      },
    });
    const editStatus = this.renderEditStatus(selectedCategory, {
      SelectionPickerProps: {
        width: 'unset',
        forceDropdownIcon: true,
        TextFieldComponent: BareTextField,
      },
    });
    const editTags = this.renderEditTags(selectedCategory, {
      SelectionPickerProps: {
        width: 'unset',
        forceDropdownIcon: true,
        clearIndicatorNeverHide: true,
        limitTags: 3,
        TextFieldComponent: BareTextField,
        ...(!this.state.newItemChosenTagIds?.length ? {
          placeholder: 'Add tags',
          inputMinWidth: 60,
        } : {}),
      },
    });
    const editUser = this.renderEditUser({
      SelectionPickerProps: {
        width: 'unset',
        forceDropdownIcon: true,
        TextFieldComponent: BareTextField,
        TextFieldProps: {
          fullWidth: false,
        },
      },
    });
    const editNotify = this.renderEditNotify(selectedCategory);
    const editNotifyTitle = this.renderEditNotifyTitle(selectedCategory, ({
      autoFocusAndSelect: true,
      singlelineWrap: true,
    } as React.ComponentProps<typeof BareTextField>) as any, BareTextField);
    const editNotifyBody = this.renderEditNotifyBody(selectedCategory, ({
      singlelineWrap: true,
    } as React.ComponentProps<typeof BareTextField>) as any, BareTextField);
    const buttonSubmit = this.renderButtonSubmit(enableSubmit);

    return (
      <div className={this.props.classes.postContainer}>
        <div className={this.props.classes.postTitleDesc}>
          {editUser}
          {editTitle}
          {editDescription}
        </div>
        <div className={this.props.classes.postFooter}>
          {editCategory}
          {editStatus}
          {editTags}
        </div>
        <div className={this.props.classes.postNotify}>
          {editNotify}
          {(editNotifyTitle || editNotifyBody) && (
            <OutlinePostContent className={this.props.classes.postNotifyEnvelope}>
              <Typography variant='h5' component='div'>{editNotifyTitle}</Typography>
              <Typography variant='body1' component='div'>{editNotifyBody}</Typography>
            </OutlinePostContent>
          )}
        </div>
        <DialogActions>
          {buttonSubmit}
        </DialogActions>
      </div>
    );
  }

  renderEditTitle(PostEditTitleProps?: Partial<React.ComponentProps<typeof PostEditTitle>>): React.ReactNode {
    return (
      <PostEditTitle
        value={this.state.newItemTitle || this.props.defaultTitle || ''}
        onChange={value => {
          if (this.state.newItemTitle === value) {
            return;
          }
          this.searchSimilarDebounced?.(value, this.state.newItemChosenCategoryId);
          this.setState({ newItemTitle: value })
        }}
        isSubmitting={this.state.newItemIsSubmitting}
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
  renderEditDescription(PostEditDescriptionProps?: Partial<React.ComponentProps<typeof PostEditDescription>>): React.ReactNode {
    return (
      <PostEditDescription
        server={this.props.server}
        postAuthorId={this.state.newItemAuthorLabel?.value}
        isSubmitting={this.state.newItemIsSubmitting}
        value={this.state.newItemDescription || this.props.defaultDescription || ''}
        onChange={value => {
          if (this.state.newItemDescription === value
            || (!this.state.newItemDescription && !value)) {
            return;
          }
          this.setState({
            newItemDescription: value,
          })
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
          this.searchSimilarDebounced?.(this.state.newItemTitle, categoryId);
          this.setState({
            newItemChosenCategoryId: categoryId,
            newItemChosenStatusId: undefined,
            newItemChosenTagIds: undefined,
          });
        }}
        errorText={!selectedCategory ? 'Choose a category' : undefined}
        disabled={this.state.newItemIsSubmitting}
        {...CategorySelectProps}
      />
    );
  }
  renderEditStatus(
    selectedCategory?: Client.Category,
    StatusSelectProps?: Partial<React.ComponentProps<typeof StatusSelect>>,
  ): React.ReactNode | null {
    if (!this.state.adminControlsExpanded || !PostCreateForm.showModOptions(this.props) || !selectedCategory?.workflow.statuses.length) return null;
    return (
      <StatusSelect
        show='all'
        workflow={selectedCategory?.workflow}
        variant='outlined'
        size={this.props.type === 'large' ? 'medium' : 'small'}
        disabled={this.state.newItemIsSubmitting}
        initialStatusId={selectedCategory.workflow.entryStatus}
        statusId={this.state.newItemChosenStatusId}
        onChange={(statusId) => this.setState({ newItemChosenStatusId: statusId })}
        {...StatusSelectProps}
      />
    );
  }
  renderEditTags(
    selectedCategory?: Client.Category,
    TagSelectProps?: Partial<React.ComponentProps<typeof TagSelect>>,
  ): React.ReactNode | null {
    if (!selectedCategory) return null;
    return (
      <TagSelect
        variant='outlined'
        size={this.props.type === 'large' ? 'medium' : 'small'}
        label='Tags'
        category={selectedCategory}
        tagIds={this.state.newItemChosenTagIds}
        isModOrAdminLoggedIn={PostCreateForm.showModOptions(this.props)}
        onChange={(tagIds, errorStr) => this.setState({
          newItemChosenTagIds: tagIds,
          newItemTagSelectHasError: !!errorStr,
        })}
        disabled={this.state.newItemIsSubmitting}
        mandatoryTagIds={this.props.mandatoryTagIds}
        {...TagSelectProps}
        SelectionPickerProps={{
          limitTags: 1,
          ...TagSelectProps?.SelectionPickerProps,
        }}
      />
    );
  }
  renderEditUser(UserSelectionProps?: Partial<React.ComponentProps<typeof UserSelection>>): React.ReactNode | null {
    if (!this.state.adminControlsExpanded || !PostCreateForm.showModOptions(this.props)) return null;
    return (
      <UserSelection
        variant='outlined'
        size={this.props.type === 'large' ? 'medium' : 'small'}
        server={this.props.server}
        label='As user'
        errorMsg='Select author'
        width='100%'
        disabled={this.state.newItemIsSubmitting}
        suppressInitialOnChange
        onChange={selectedUserLabel => this.setState({ newItemAuthorLabel: selectedUserLabel })}
        allowCreate
        {...UserSelectionProps}
      />
    );
  }
  renderEditNotify(
    selectedCategory?: Client.Category,
    FormControlLabelProps?: Partial<React.ComponentProps<typeof FormControlLabel>>,
    SwitchProps?: Partial<React.ComponentProps<typeof Switch>>,
  ): React.ReactNode | null {
    if (!this.state.adminControlsExpanded
      || !PostCreateForm.showModOptions(this.props)
      || !selectedCategory?.subscription) return null;
    return (
      <FormControlLabel
        disabled={this.state.newItemIsSubmitting}
        control={(
          <Switch
            checked={!!this.state.newItemNotifySubscribers}
            onChange={(e, checked) => this.setState({
              newItemNotifySubscribers: !this.state.newItemNotifySubscribers,
              ...(!this.state.newItemNotifyTitle ? { newItemNotifyTitle: `New ${selectedCategory.name}` } : undefined),
              ...(!this.state.newItemNotifyBody ? { newItemNotifyBody: `Check out my new ${selectedCategory.name}: ${this.state.newItemTitle || 'My title here'}` } : undefined),
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
    selectedCategory?: Client.Category,
    TextFieldProps?: Partial<React.ComponentProps<typeof TextField>>,
    TextFieldComponent?: React.ElementType<React.ComponentProps<typeof TextField>>,
  ): React.ReactNode {
    if (!this.state.adminControlsExpanded
      || !PostCreateForm.showModOptions(this.props)
      || !selectedCategory?.subscription
      || !this.state.newItemNotifySubscribers) return null;
    const TextFieldCmpt = TextFieldComponent || TextField;
    return (
      <TextFieldCmpt
        variant='outlined'
        size={this.props.type === 'large' ? 'medium' : 'small'}
        disabled={this.state.newItemIsSubmitting}
        label='Notification Title'
        value={this.state.newItemNotifyTitle || ''}
        onChange={e => this.setState({ newItemNotifyTitle: e.target.value })}
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
    selectedCategory?: Client.Category,
    TextFieldProps?: Partial<React.ComponentProps<typeof TextField>>,
    TextFieldComponent?: React.ElementType<React.ComponentProps<typeof TextField>>,
  ): React.ReactNode {
    if (!this.state.adminControlsExpanded
      || !PostCreateForm.showModOptions(this.props)
      || !selectedCategory?.subscription
      || !this.state.newItemNotifySubscribers) return null;
    const TextFieldCmpt = TextFieldComponent || TextField;
    return (
      <TextFieldCmpt
        variant='outlined'
        size={this.props.type === 'large' ? 'medium' : 'small'}
        disabled={this.state.newItemIsSubmitting}
        label='Notification Body'
        multiline
        value={this.state.newItemNotifyBody || ''}
        onChange={e => this.setState({ newItemNotifyBody: e.target.value })}
        {...TextFieldProps}
        inputProps={{
          maxLength: PostTitleMaxLength,
          ...TextFieldProps?.inputProps,
        }}
      />
    );
  }

  renderButtonSubmit(
    enableSubmit?: boolean,
    SubmitButtonProps?: Partial<React.ComponentProps<typeof SubmitButton>>,
  ): React.ReactNode | null {
    if (!!this.props.externalSubmit) return null;

    return (
      <SubmitButton
        color='primary'
        variant='contained'
        disableElevation
        isSubmitting={this.state.newItemIsSubmitting}
        disabled={!enableSubmit || this.state.newItemIsSubmitting}
        onClick={e => enableSubmit && this.createClickSubmit()}
      >
        {!this.getAuthorUserId() && this.props.unauthenticatedSubmitButtonTitle || 'Submit'}
      </SubmitButton>
    );
  }

  getAuthorUserId(): string | undefined {
    return this.state.newItemAuthorLabel?.value || this.props.loggedInUserId;
  }

  createClickSubmit(): Promise<string> {
    if (!!this.getAuthorUserId()) {
      return this.createSubmit();
    } else {
      // open log in page, submit on success
      return this.props.logIn().then(() => this.createSubmit());
    }
  }

  async createSubmit(): Promise<string> {
    this.setState({ newItemIsSubmitting: true });
    var idea: Client.Idea | Admin.Idea;
    try {
      if (this.props.server.isModOrAdminLoggedIn()) {
        idea = await (await this.props.server.dispatchAdmin()).ideaCreateAdmin({
          projectId: this.props.server.getProjectId(),
          ideaCreateAdmin: {
            authorUserId: this.getAuthorUserId()!,
            title: this.state.newItemTitle!,
            description: this.state.newItemDescription,
            categoryId: this.state.newItemChosenCategoryId!,
            statusId: this.state.newItemChosenStatusId,
            notifySubscribers: !this.state.newItemNotifySubscribers ? undefined : {
              title: this.state.newItemNotifyTitle!,
              body: this.state.newItemNotifyBody!,
            },
            tagIds: [...(this.props.mandatoryTagIds || []), ...(this.state.newItemChosenTagIds || [])],
          },
        });
      } else {
        idea = await (await this.props.server.dispatch()).ideaCreate({
          projectId: this.props.server.getProjectId(),
          ideaCreate: {
            authorUserId: this.state.newItemAuthorLabel?.value || this.props.loggedInUserId!,
            title: this.state.newItemTitle!,
            description: this.state.newItemDescription,
            categoryId: this.state.newItemChosenCategoryId!,
            tagIds: [...(this.props.mandatoryTagIds || []), ...(this.state.newItemChosenTagIds || [])],
          },
        });
      }
    } catch (e) {
      this.setState({
        newItemIsSubmitting: false,
      });
      throw e;
    }
    this.setState({
      newItemTitle: undefined,
      newItemDescription: undefined,
      newItemSearchText: undefined,
      newItemIsSubmitting: false,
    });
    this.props.onCreated?.(idea.ideaId);
    return idea.ideaId;
  }

  static showModOptions(props: React.ComponentProps<typeof PostCreateForm>): boolean {
    return props.adminControlsDefaultVisibility !== 'none'
      && props.server.isModOrAdminLoggedIn();
  }

  static getCategoryOptions(props: React.ComponentProps<typeof PostCreateForm>): Client.Category[] {
    const showModOptions = PostCreateForm.showModOptions(props);
    return (props.mandatoryCategoryIds?.length
      ? props.categories?.filter(c => (showModOptions || c.userCreatable) && props.mandatoryCategoryIds?.includes(c.categoryId))
      : props.categories?.filter(c => showModOptions || c.userCreatable)
    ) || [];
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  return {
    configver: state.conf.ver, // force rerender on config change
    categories: state.conf.conf?.content.categories,
    loggedInUserId: state.users.loggedIn.user ? state.users.loggedIn.user.userId : undefined,
  }
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(withWidth({ initialWidth })(PostCreateForm))));

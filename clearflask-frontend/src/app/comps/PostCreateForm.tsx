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
import loadable from '@loadable/component';
import { Button, Collapse, FormControlLabel, Grid, Switch, TextField, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import RichEditorImageUpload from '../../common/RichEditorImageUpload';
import SubmitButton from '../../common/SubmitButton';
import debounce, { SimilarTypeDebounceTime } from '../../common/util/debounce';
import { initialWidth } from '../../common/util/screenUtil';
import { importFailed, importSuccess } from '../../Main';
import UserSelection from '../../site/dashboard/UserSelection';
import Loading from '../utils/Loading';
import CategorySelect from './CategorySelect';
import { Label } from './SelectionPicker';
import StatusSelect from './StatusSelect';
import TagSelect from './TagSelect';

/** If changed, also change in Sanitizer.java */
export const PostTitleMaxLength = 100

const RichEditor = loadable(() => import(/* webpackChunkName: "RichEditor", webpackPrefetch: true */'../../common/RichEditor').then(importSuccess).catch(importFailed), { fallback: (<Loading />), ssr: false });

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
  descriptionLarge: {
    '& .ql-container': {
      minHeight: 60,
    }
  },
});

interface Props {
  server: Server;
  type?: 'regular' | 'large';
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
}

class PostCreateForm extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & RouteComponentProps & WithWidthProps, State> {
  readonly panelSearchRef: React.RefObject<any> = React.createRef();
  readonly searchSimilarDebounced?: (title?: string, categoryId?: string) => void;
  readonly richEditorImageUploadRef = React.createRef<RichEditorImageUpload>();

  constructor(props) {
    super(props);

    this.state = {
      adminControlsExpanded: props.adminControlsDefaultVisibility === 'expanded',
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

  render() {
    const showModOptions = PostCreateForm.showModOptions(this.props);
    const categoryOptions = PostCreateForm.getCategoryOptions(this.props);
    const selectedCategory = categoryOptions.find(c => c.categoryId === this.state.newItemChosenCategoryId);
    const enableSubmit = this.state.newItemTitle && this.state.newItemChosenCategoryId && !this.state.newItemTagSelectHasError;
    return (
      <Grid
        container
        justify={this.props.type === 'large' ? 'flex-end' : undefined}
        alignItems='flex-start'
        className={this.props.classes.createFormFields}
      >
        <Grid item xs={this.props.type === 'large' ? 9 : 12} className={this.props.classes.createGridItem}>
          <TextField
            variant='outlined'
            size='small'
            disabled={this.state.newItemIsSubmitting}
            className={this.props.classes.createFormField}
            label='Title'
            value={this.state.newItemTitle || this.props.defaultTitle || ''}
            onChange={e => {
              if (this.state.newItemTitle === e.target.value) {
                return;
              }
              this.searchSimilarDebounced?.(e.target.value, this.state.newItemChosenCategoryId);
              this.setState({ newItemTitle: e.target.value })
            }}
            InputProps={{
              inputRef: this.props.titleInputRef,
            }}
            inputProps={{
              maxLength: PostTitleMaxLength,
            }}
          />
        </Grid>
        {this.props.type === 'large' && (
          <Grid item xs={3} className={this.props.classes.createGridItem} />
        )}
        <Grid item xs={12} className={this.props.classes.createGridItem}>
          <RichEditor
            uploadImage={(file) => this.richEditorImageUploadRef.current?.uploadImage(file)}
            variant='outlined'
            size='small'
            id='createDescription'
            multiline
            showControlsImmediately={this.props.type === 'large'}
            disabled={this.state.newItemIsSubmitting}
            className={classNames(this.props.classes.createFormField, this.props.type === 'large' && this.props.classes.descriptionLarge)}
            label='Details'
            iAgreeInputIsSanitized
            value={this.state.newItemDescription || this.props.defaultDescription || ''}
            onChange={(e, delta, source, editor) => {
              const value = e.target.value;
              if (this.state.newItemDescription === value
                || (!this.state.newItemDescription && !value)) {
                return;
              }
              const descriptionTextOnly = editor.getText();
              this.setState({
                newItemDescription: value,
              })
            }}
          />
          <RichEditorImageUpload
            ref={this.richEditorImageUploadRef}
            server={this.props.server}
            asAuthorId={this.state.newItemAuthorLabel?.value}
          />
        </Grid>
        {categoryOptions.length > 1 && (
          <Grid item xs={this.props.type === 'large' ? 6 : 12} className={this.props.classes.createGridItem}>
            <CategorySelect
              variant='outlined'
              size='small'
              label='Category'
              className={this.props.classes.createFormField}
              categoryOptions={categoryOptions}
              value={selectedCategory?.categoryId || ''}
              onChange={categoryId => {
                this.searchSimilarDebounced?.(this.state.newItemTitle, categoryId);
                this.setState({ newItemChosenCategoryId: categoryId });
              }}
              errorText={!selectedCategory ? 'Choose a category' : undefined}
              disabled={this.state.newItemIsSubmitting}
            />
          </Grid>
        )}
        {!!this.state.adminControlsExpanded && showModOptions && !!selectedCategory?.workflow.statuses.length && (
          <Grid item xs={this.props.type === 'large' ? 6 : 12} className={this.props.classes.createGridItem}>
            <div className={this.props.classes.createFormField}>
              <StatusSelect
                show='all'
                workflow={selectedCategory?.workflow}
                variant='outlined'
                size='small'
                disabled={this.state.newItemIsSubmitting}
                initialStatusId={selectedCategory.workflow.entryStatus}
                statusId={this.state.newItemChosenStatusId}
                onChange={(statusId) => this.setState({ newItemChosenStatusId: statusId })}
              />
            </div>
          </Grid>
        )}
        {!!selectedCategory && (
          <TagSelect
            wrapper={(children) => (
              <Grid item xs={this.props.type === 'large' ? 6 : 12} className={this.props.classes.createGridItem}>
                <div className={this.props.classes.createFormField}>
                  {children}
                </div>
              </Grid>
            )}
            variant='outlined'
            size='small'
            label='Tags'
            category={selectedCategory}
            tagIds={this.state.newItemChosenTagIds}
            isModOrAdminLoggedIn={showModOptions}
            onChange={(tagIds, errorStr) => this.setState({
              newItemChosenTagIds: tagIds,
              newItemTagSelectHasError: !!errorStr,
            })}
            disabled={this.state.newItemIsSubmitting}
            mandatoryTagIds={this.props.mandatoryTagIds}
            SelectionPickerProps={{
              limitTags: 1,
            }}
          />
        )}
        {!!this.state.adminControlsExpanded && showModOptions && (
          <Grid item xs={this.props.type === 'large' ? 6 : 12} className={this.props.classes.createGridItem} justify='flex-end'>
            <UserSelection
              variant='outlined'
              size='small'
              server={this.props.server}
              label='As user'
              errorMsg='Select author'
              width='100%'
              className={this.props.classes.createFormField}
              disabled={this.state.newItemIsSubmitting}
              suppressInitialOnChange
              onChange={selectedUserLabel => this.setState({ newItemAuthorLabel: selectedUserLabel })}
              allowCreate
            />
          </Grid>
        )}
        {!!this.state.adminControlsExpanded && showModOptions && !!selectedCategory?.subscription && (
          <>
            <Grid item xs={12} className={this.props.classes.createGridItem}>
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
                  />
                )}
                label='Notify all subscribers'
              />
            </Grid>
            <Collapse in={!!this.state.newItemNotifySubscribers}>
              <Grid item xs={12} className={this.props.classes.createGridItem}>
                <TextField
                  variant='outlined'
                  size='small'
                  disabled={this.state.newItemIsSubmitting}
                  className={this.props.classes.createFormField}
                  label='Notification Title'
                  value={this.state.newItemNotifyTitle || ''}
                  onChange={e => this.setState({ newItemNotifyTitle: e.target.value })}
                  inputProps={{
                    maxLength: PostTitleMaxLength,
                  }}
                />
              </Grid>
              <Grid item xs={12} className={this.props.classes.createGridItem}>
                <TextField
                  variant='outlined'
                  size='small'
                  disabled={this.state.newItemIsSubmitting}
                  className={this.props.classes.createFormField}
                  label='Notification Body'
                  value={this.state.newItemNotifyBody || ''}
                  onChange={e => this.setState({ newItemNotifyBody: e.target.value })}
                  inputProps={{
                    maxLength: PostTitleMaxLength,
                  }}
                />
              </Grid>
            </Collapse>
          </>
        )}
        {this.props.type === 'large' && (
          <Grid item xs={6} className={this.props.classes.createGridItem} />
        )}
        <Grid item xs={this.props.type === 'large' ? 6 : 12} container justify='flex-end' className={this.props.classes.createGridItem}>
          <Grid item>
            {!!showModOptions && !this.state.adminControlsExpanded && (
              <Button
                onClick={e => this.setState({ adminControlsExpanded: true })}
              >
                More
              </Button>
            )}
            <SubmitButton
              color='primary'
              isSubmitting={this.state.newItemIsSubmitting}
              disabled={!enableSubmit || this.state.newItemIsSubmitting}
              onClick={e => enableSubmit && this.createClickSubmit()}
            >
              Submit
            </SubmitButton>
          </Grid>
        </Grid>
      </Grid>
    );
  }

  createClickSubmit() {
    if (!!this.state.newItemAuthorLabel || !!this.props.loggedInUserId) {
      this.createSubmit();
    } else {
      // open log in page, submit on success
      this.props.logIn().then(() => this.createSubmit());
    }
  }

  createSubmit() {
    this.setState({ newItemIsSubmitting: true });
    var createPromise: Promise<Client.Idea | Admin.Idea>;
    if (this.props.server.isModOrAdminLoggedIn()) {
      createPromise = this.props.server.dispatchAdmin().then(d => d.ideaCreateAdmin({
        projectId: this.props.server.getProjectId(),
        ideaCreateAdmin: {
          authorUserId: this.state.newItemAuthorLabel?.value || this.props.loggedInUserId!,
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
      }))
    } else {
      createPromise = this.props.server.dispatch().then(d => d.ideaCreate({
        projectId: this.props.server.getProjectId(),
        ideaCreate: {
          authorUserId: this.state.newItemAuthorLabel?.value || this.props.loggedInUserId!,
          title: this.state.newItemTitle!,
          description: this.state.newItemDescription,
          categoryId: this.state.newItemChosenCategoryId!,
          tagIds: [...(this.props.mandatoryTagIds || []), ...(this.state.newItemChosenTagIds || [])],
        },
      }));
    }
    createPromise.then(idea => {
      this.setState({
        newItemTitle: undefined,
        newItemDescription: undefined,
        newItemSearchText: undefined,
        newItemIsSubmitting: false,
      });
      this.props.onCreated?.(idea.ideaId);
    }).catch(e => this.setState({
      newItemIsSubmitting: false,
    }));
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

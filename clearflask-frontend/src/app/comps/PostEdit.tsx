import { Button, Checkbox, Collapse, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, Grid, Switch, TextField } from '@material-ui/core';
import { createStyles, makeStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import React, { Component, useRef, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import CreditView from '../../common/config/CreditView';
import RichEditor from '../../common/RichEditor';
import RichEditorImageUpload from '../../common/RichEditorImageUpload';
import SubmitButton from '../../common/SubmitButton';
import { notEmpty } from '../../common/util/arrayUtil';
import { WithMediaQuery, withMediaQuery } from '../../common/util/MediaQuery';
import StatusSelect from './StatusSelect';
import TagSelect from './TagSelect';

const styles = (theme: Theme) => createStyles({
  row: {
    padding: theme.spacing(2),
  },
  saveButtonActionContainer: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  saveButtonActionSubmit: {
    alignSelf: 'flex-end',
  },
});
const useStyles = makeStyles(styles);
interface Props {
  server: Server;
  category: Client.Category;
  credits?: Client.Credits;
  loggedInUser?: Client.User;
  idea: Client.Idea;
  open?: boolean;
  onClose: () => void;
}
interface State {
  deleteDialogOpen?: boolean;
  isSubmitting?: boolean;
  title?: string;
  description?: string;
  response?: string;
  statusId?: string;
  tagIds?: string[];
  tagIdsHasError?: boolean;
  fundGoal?: string;
  suppressNotifications?: boolean;
}
class PostEdit extends Component<Props & WithMediaQuery & WithStyles<typeof styles, true>, State> {
  state: State = {};

  render() {
    const isModOrAdminLoggedIn = this.props.server.isModOrAdminLoggedIn();
    const fundGoalHasError = !!this.state.fundGoal && (!parseInt(this.state.fundGoal) || !+this.state.fundGoal || +this.state.fundGoal <= 0 || parseInt(this.state.fundGoal) !== parseFloat(this.state.fundGoal));
    const canSubmit = (
      this.state.tagIdsHasError !== true
      && !fundGoalHasError
      && (this.state.title !== undefined
        || this.state.description !== undefined
        || this.state.response !== undefined
        || this.state.statusId !== undefined
        || this.state.tagIds !== undefined
        || this.state.fundGoal !== undefined)
    );
    const notifyReasons = [
      this.state.statusId !== undefined ? 'status' : undefined,
      this.state.response !== undefined ? 'response' : undefined,
    ].filter(notEmpty).join(' and ') || undefined;

    return (
      <>
        <Dialog
          open={this.props.open || false}
          onClose={this.props.onClose.bind(this)}
          scroll='body'
          fullScreen={this.props.mediaQuery}
          fullWidth
        >
          <DialogTitle>Edit post</DialogTitle>
          <DialogContent>
            <Grid container alignItems='baseline'>
              <Grid item xs={isModOrAdminLoggedIn ? 8 : 12} className={this.props.classes.row}>
                <PostEditTitle
                  value={(this.state.title === undefined ? this.props.idea.title : this.state.title) || ''}
                  onChange={title => this.setState({ title })}
                  isSubmitting={this.state.isSubmitting}
                />
              </Grid>
              {isModOrAdminLoggedIn && (
                <Grid item xs={4} className={this.props.classes.row}>
                  <TextField
                    variant='outlined'
                    size='small'
                    disabled={this.state.isSubmitting}
                    label='Post ID'
                    fullWidth
                    value={this.props.idea.ideaId}
                    InputProps={{
                      readOnly: true,
                    }}
                  />
                </Grid>
              )}
              <Grid item xs={12} className={this.props.classes.row}>
                <PostEditDescription
                  server={this.props.server}
                  value={(this.state.description === undefined ? this.props.idea.description : this.state.description) || ''}
                  onChange={description => this.setState({ description })}
                  postAuthorId={isModOrAdminLoggedIn ? this.props.idea.authorUserId : undefined}
                  isSubmitting={this.state.isSubmitting}
                />
              </Grid>
              {isModOrAdminLoggedIn && (
                <>
                  <Grid item xs={12} className={this.props.classes.row}>
                    <PostEditResponse
                      server={this.props.server}
                      value={(this.state.response === undefined ? this.props.idea.response : this.state.response) || ''}
                      onChange={response => this.setState({ response })}
                      isSubmitting={this.state.isSubmitting}
                    />
                  </Grid>
                  {(isModOrAdminLoggedIn && this.props.category.workflow.statuses.length > 0) && (
                    <Grid item xs={12} sm={4} className={this.props.classes.row}>
                      <PostEditStatus
                        initialValue={this.props.idea.statusId}
                        value={this.state.statusId}
                        server={this.props.server}
                        categoryId={this.props.category.categoryId}
                        onChange={(statusId) => this.setState({ statusId })}
                        isSubmitting={this.state.isSubmitting}
                      />
                    </Grid>
                  )}
                  {this.props.category.tagging.tags.length > 0 && (
                    <Grid item xs={12} sm={8} className={this.props.classes.row}>
                      <PostEditTags
                        value={this.state.tagIds === undefined ? this.props.idea.tagIds : this.state.tagIds}
                        server={this.props.server}
                        categoryId={this.props.category.categoryId}
                        onChange={(tagIds, errorStr) => this.setState({
                          tagIds,
                          tagIdsHasError: !!errorStr,
                        })}
                        isSubmitting={this.state.isSubmitting}
                      />
                    </Grid>
                  )}
                  {!!this.props.category.support.fund && this.props.credits && (
                    <Grid item xs={12} className={this.props.classes.row}>
                      <TextField
                        variant='outlined'
                        size='small'
                        disabled={this.state.isSubmitting}
                        label='Funding Goal'
                        fullWidth
                        value={(this.state.fundGoal === undefined ? this.props.idea.fundGoal : this.state.fundGoal) || ''}
                        type='number'
                        inputProps={{
                          step: 1,
                        }}
                        error={fundGoalHasError}
                        helperText={fundGoalHasError ? 'Invalid value' : (
                          ((this.state.fundGoal !== undefined && this.state.fundGoal !== '') || this.props.idea.fundGoal !== undefined) ? (
                            <CreditView
                              val={this.state.fundGoal === undefined ? this.props.idea.fundGoal || 0 : +this.state.fundGoal}
                              credits={this.props.credits}
                            />
                          ) : undefined)}
                        onChange={e => this.setState({ fundGoal: e.target.value })}
                      />
                    </Grid>
                  )}
                  <Grid item xs={12}>
                    <Collapse in={!!notifyReasons}>
                      <FormControlLabel
                        className={this.props.classes.row}
                        disabled={this.state.isSubmitting}
                        control={(
                          <Switch
                            checked={!this.state.suppressNotifications}
                            onChange={(e, checked) => this.setState({ suppressNotifications: !checked })}
                            color='primary'
                          />
                        )}
                        label={`Notify subscribers of ${notifyReasons}`}
                      />
                    </Collapse>
                  </Grid>
                </>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.props.onClose()}>Close</Button>
            <SubmitButton
              isSubmitting={this.state.isSubmitting}
              style={{ color: !this.state.isSubmitting ? this.props.theme.palette.error.main : undefined }}
              onClick={() => this.setState({ deleteDialogOpen: true })}
            >Delete</SubmitButton>
            <SubmitButton color='primary' isSubmitting={this.state.isSubmitting} disabled={!canSubmit} onClick={() => {
              this.setState({ isSubmitting: true });
              (isModOrAdminLoggedIn
                ? this.props.server.dispatchAdmin().then(d => d.ideaUpdateAdmin({
                  projectId: this.props.server.getProjectId(),
                  ideaId: this.props.idea.ideaId,
                  ideaUpdateAdmin: {
                    title: this.state.title,
                    description: this.state.description,
                    response: this.state.response,
                    statusId: this.state.statusId,
                    tagIds: this.state.tagIds,
                    fundGoal: !this.state.fundGoal ? undefined : +this.state.fundGoal,
                    suppressNotifications: this.state.suppressNotifications,
                  },
                }))
                : this.props.server.dispatch().then(d => d.ideaUpdate({
                  projectId: this.props.server.getProjectId(),
                  ideaId: this.props.idea.ideaId,
                  ideaUpdate: {
                    title: this.state.title,
                    description: this.state.description,
                  },
                })))
                .then(idea => {
                  this.setState({
                    isSubmitting: false,
                    title: undefined,
                    description: undefined,
                    response: undefined,
                    statusId: undefined,
                    tagIds: undefined,
                    fundGoal: undefined,
                    suppressNotifications: undefined,
                  });
                  this.props.onClose();
                })
                .catch(e => this.setState({ isSubmitting: false }))
            }}>Save</SubmitButton>
          </DialogActions>
        </Dialog>
        <Dialog
          open={!!this.state.deleteDialogOpen && !!this.props.open}
          onClose={() => this.setState({ deleteDialogOpen: false })}
        >
          <DialogTitle>Delete Post</DialogTitle>
          <DialogContent>
            <DialogContentText>Are you sure you want to permanently delete this post?</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ deleteDialogOpen: false })}>Cancel</Button>
            <SubmitButton
              isSubmitting={this.state.isSubmitting}
              style={{ color: !this.state.isSubmitting ? this.props.theme.palette.error.main : undefined }}
              onClick={() => {
                this.setState({ isSubmitting: true });
                (isModOrAdminLoggedIn
                  ? this.props.server.dispatchAdmin().then(d => d.ideaDeleteAdmin({
                    projectId: this.props.server.getProjectId(),
                    ideaId: this.props.idea.ideaId,
                  }))
                  : this.props.server.dispatch().then(d => d.ideaDelete({
                    projectId: this.props.server.getProjectId(),
                    ideaId: this.props.idea.ideaId,
                  })))
                  .then(() => {
                    this.setState({
                      isSubmitting: false,
                      deleteDialogOpen: false,
                    });
                    this.props.onClose();
                  })
                  .catch(e => this.setState({ isSubmitting: false }))
              }}>Delete</SubmitButton>
          </DialogActions>
        </Dialog>
      </>
    );
  }
}
export default withStyles(styles, { withTheme: true })(
  withMediaQuery(theme => theme.breakpoints.down('xs'))(PostEdit));

export const PostEditTitleInline = (props: {
  server: Server;
  post: Client.Idea;
  TextFieldProps?: Partial<React.ComponentProps<typeof TextField>>;
}) => {
  const [title, setTitle] = useState<string | undefined>();
  const [isSubmitting, setSubmitting] = useState<boolean>(false);

  const changed = title !== undefined;
  return (
    <PostSaveButton
      open={changed}
      isSubmitting={isSubmitting}
      onClick={() => {
        setSubmitting(true);
        postSave(
          props.server,
          props.post.ideaId,
          { title },
          () => { setTitle(undefined); setSubmitting(false); },
          () => setSubmitting(false),
        );
      }}
    >
      <PostEditTitle
        value={(title === undefined ? props.post.title : title) || ''}
        onChange={title => setTitle(title)}
        isSubmitting={isSubmitting}
        TextFieldProps={props.TextFieldProps}
      />
    </PostSaveButton>
  );
}

export const PostEditDescriptionInline = (props: {
  server: Server;
  post: Client.Idea;
  RichEditorProps?: Partial<React.ComponentPropsWithoutRef<typeof RichEditor>>;
}) => {
  const [description, setDescription] = useState<string | undefined>();
  const [isSubmitting, setSubmitting] = useState<boolean>(false);

  const changed = description !== undefined;
  return (
    <PostSaveButton
      open={changed}
      isSubmitting={isSubmitting}
      onClick={() => {
        setSubmitting(true);
        postSave(
          props.server,
          props.post.ideaId,
          { description },
          () => { setDescription(undefined); setSubmitting(false); },
          () => setSubmitting(false),
        );
      }}
    >
      <PostEditDescription
        value={(description === undefined ? props.post.description : description) || ''}
        onChange={description => setDescription(description)}
        isSubmitting={isSubmitting}
        server={props.server}
        postAuthorId={props.post.authorUserId}
        RichEditorProps={props.RichEditorProps}
      />
    </PostSaveButton>
  );
}

export const PostEditTitle = (props: {
  value?: string;
  onChange: (value: string) => void;
  isSubmitting?: boolean;
  TextFieldProps?: Partial<React.ComponentProps<typeof TextField>>;
}) => {
  return (
    <TextField
      variant='outlined'
      size='small'
      label='Title'
      fullWidth
      value={props.value === undefined ? '' : props.value}
      onChange={e => props.onChange(e.target.value)}
      disabled={props.isSubmitting}
      {...props.TextFieldProps}
    />
  );
}

export const PostEditDescription = (props: {
  value?: string;
  postAuthorId?: string;
  server: Server;
  onChange: (value: string) => void;
  isSubmitting?: boolean;
  RichEditorProps?: Partial<React.ComponentPropsWithoutRef<typeof RichEditor>>;
}) => {
  const imageUploadRef = useRef<RichEditorImageUpload>(null);
  return (
    <>
      <RichEditor
        uploadImage={(file) => imageUploadRef.current!.uploadImage(file)}
        variant='outlined'
        size='small'
        disabled={props.isSubmitting}
        label='Description'
        fullWidth
        iAgreeInputIsSanitized
        value={props.value === undefined ? '' : props.value}
        onChange={e => props.onChange(e.target.value)}
        multiline
        rows={1}
        rowsMax={15}
        {...props.RichEditorProps}
      />
      <RichEditorImageUpload
        ref={imageUploadRef}
        server={props.server}
        asAuthorId={props.server.isModOrAdminLoggedIn() ? props.postAuthorId : undefined}
      />
    </>
  );
}

export const PostEditStatusAndResponseInline = (props: {
  server: Server;
  post?: Client.Idea;
  TextFieldPropsStatus?: Partial<React.ComponentProps<typeof TextField>>;
  RichEditorPropsResponse?: Partial<React.ComponentPropsWithoutRef<typeof RichEditor>>;
  // If unset, response can be edited from previous
  // If set, a blank response is open when status is changed
  showResponseOnlyWithStatus?: boolean;
}) => {
  const [statusId, setStatusId] = useState<string | undefined>();
  const [response, setResponse] = useState<string | undefined>();
  const [isSubmitting, setSubmitting] = useState<boolean>(false);
  if (!props.post) return null;
  const changed = statusId !== undefined || response !== undefined;
  return (
    <PostSaveButton
      open={changed}
      isSubmitting={isSubmitting}
      showNotify
      onClick={(doNotify) => {
        setSubmitting(true);
        postSave(
          props.server,
          props.post!.ideaId,
          {
            ...(statusId !== undefined ? { statusId } : {}),
            ...(response !== undefined ? { response } : {}),
            suppressNotifications: !doNotify,
          },
          () => { setStatusId(undefined); setResponse(undefined); setSubmitting(false); },
          () => setSubmitting(false),
        );
      }}
    >
      <PostEditStatus
        server={props.server}
        categoryId={props.post.categoryId}
        initialValue={props.post.statusId}
        value={statusId}
        onChange={statusId => setStatusId(statusId)}
        isSubmitting={isSubmitting}
        TextFieldProps={props.TextFieldPropsStatus}
      />
      <Collapse in={changed || !props.showResponseOnlyWithStatus}>
        <PostEditResponse
          server={props.server}
          value={response !== undefined
            ? response
            : (props.showResponseOnlyWithStatus ? undefined : props.post.response)}
          onChange={response => setResponse((response === undefined || response === '') ? undefined : response)}
          isSubmitting={isSubmitting}
          RichEditorProps={{
            placeholder: props.showResponseOnlyWithStatus ? 'Add a response' : undefined,
            ...props.RichEditorPropsResponse,
          }}
        />
      </Collapse>
    </PostSaveButton>
  );
}

export const PostEditResponse = (props: {
  value?: string;
  server: Server;
  onChange: (value: string) => void;
  isSubmitting?: boolean;
  RichEditorProps?: Partial<React.ComponentPropsWithoutRef<typeof RichEditor>>;
}) => {
  const imageUploadRef = useRef<RichEditorImageUpload>(null);
  return (
    <>
      <RichEditor
        uploadImage={(file) => imageUploadRef.current!.uploadImage(file)}
        variant='outlined'
        size='small'
        disabled={props.isSubmitting}
        label='Response'
        fullWidth
        iAgreeInputIsSanitized
        value={props.value === undefined ? '' : props.value}
        onChange={e => props.onChange(e.target.value)}
        multiline
        rows={1}
        rowsMax={3}
        {...props.RichEditorProps}
      />
      <RichEditorImageUpload
        ref={imageUploadRef}
        server={props.server}
      />
    </>
  );
}

export const PostEditStatus = (props: {
  initialValue?: string;
  value?: string;
  server: Server;
  categoryId: string;
  onChange: (value?: string) => void;
  isSubmitting?: boolean;
  TextFieldProps?: Partial<React.ComponentProps<typeof TextField>>;
}) => {
  const category = useSelector<ReduxState, Client.Category | undefined>(state => state.conf.conf?.content.categories.find(c => c.categoryId === props.categoryId), shallowEqual);
  if (!category?.workflow.statuses.length) return null;
  return (
    <StatusSelect
      show='next'
      workflow={category?.workflow}
      variant='outlined'
      size='small'
      label='Status'
      initialStatusId={props.initialValue}
      statusId={props.value}
      onChange={props.onChange}
      disabled={props.isSubmitting}
      SelectionPickerProps={{
        width: undefined,
        TextFieldProps: {
          fullWidth: true,
          ...props.TextFieldProps,
        },
      }}
    />
  );
}

export const PostEditTagsInline = (props: {
  server: Server;
  post?: Client.Idea;
  TextFieldProps?: Partial<React.ComponentProps<typeof TextField>>;
}) => {
  const [unsavedTagIds, setUnsavedTagIds] = useState<string[] | undefined>();
  const [isSubmitting, setSubmitting] = useState<boolean>(false);
  if (!props.post) return null;
  return (
    <PostEditTags
      value={unsavedTagIds || props.post.tagIds}
      server={props.server}
      categoryId={props.post.categoryId}
      onChange={(tagIds, errorStr) => {
        if (!!errorStr) {
          setUnsavedTagIds(tagIds);
        } else {
          setSubmitting(true);
          postSave(
            props.server,
            props.post!.ideaId,
            { tagIds },
            () => {
              !!unsavedTagIds && setUnsavedTagIds(undefined);
              setSubmitting(false);
            },
            () => setSubmitting(false),
          );
        }
      }}
      isSubmitting={isSubmitting}
      TextFieldProps={props.TextFieldProps}
    />
  );
}

export const PostEditTags = (props: {
  value?: string[];
  server: Server;
  categoryId: string;
  onChange: (value: string[], errorStr?: string) => void;
  isSubmitting?: boolean;
  TextFieldProps?: Partial<React.ComponentProps<typeof TextField>>;
}) => {
  const category = useSelector<ReduxState, Client.Category | undefined>(state => state.conf.conf?.content.categories.find(c => c.categoryId === props.categoryId), shallowEqual);
  const isModOrAdminLoggedIn = props.server.isModOrAdminLoggedIn();
  if (!category || !CategoryTagsSelectable(category, isModOrAdminLoggedIn)) return null;
  return (
    <TagSelect
      variant='outlined'
      size='small'
      label='Tags'
      disabled={props.isSubmitting}
      category={category}
      tagIds={props.value}
      isModOrAdminLoggedIn={isModOrAdminLoggedIn}
      onChange={props.onChange}
      SelectionPickerProps={{
        disableClearable: true,
        width: undefined,
        TextFieldProps: {
          fullWidth: true,
          ...props.TextFieldProps,
        },
      }}
    />
  );
}
export const CategoryTagsSelectable = (
  category?: Client.Category,
  isModOrAdminLoggedIn?: boolean,
): boolean => !!category?.tagging.tagGroups?.some(g => g.userSettable || !!isModOrAdminLoggedIn)

const postSave = (
  server: Server,
  ideaId: string,
  update: Client.IdeaUpdate | Admin.IdeaUpdateAdmin,
  onSaved: () => void,
  onFailure: () => void,
) => {
  (server.isModOrAdminLoggedIn()
    ? server.dispatchAdmin().then(d => d.ideaUpdateAdmin({
      projectId: server.getProjectId(),
      ideaId,
      ideaUpdateAdmin: update,
    }))
    : server.dispatch().then(d => d.ideaUpdate({
      projectId: server.getProjectId(),
      ideaId,
      ideaUpdate: update as Client.IdeaUpdate,
    })))
    .then(idea => onSaved())
    .catch(e => onFailure())
}

export const PostSaveButton = (props: {
  children?: any;
  open?: boolean;
  showNotify?: boolean;
  isSubmitting?: boolean;
  onClick: (doNotify: boolean) => void;
}) => {
  const classes = useStyles();
  const [doNotify, setNotify] = useState<boolean>(!!props.showNotify);
  return (
    <>
      {props.children}
      <Collapse in={!!props.open}>
        <div className={classes.saveButtonActionContainer}>
          {props.showNotify && (
            <FormControlLabel
              disabled={props.isSubmitting}
              control={(
                <Checkbox
                  checked={doNotify}
                  onChange={(e, checked) => setNotify(!doNotify)}
                  color='default'
                  size='small'
                />
              )}
              label='Notify subscribers'
            />
          )}
          <SubmitButton
            wrapperClassName={classes.saveButtonActionSubmit}
            isSubmitting={props.isSubmitting}
            color='primary'
            onClick={() => props.onClick(doNotify)}
          >Save</SubmitButton>
        </div>
      </Collapse>
    </>
  );
}

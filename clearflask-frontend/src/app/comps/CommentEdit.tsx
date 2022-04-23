// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@material-ui/core';
import { createStyles, Theme, useTheme, WithStyles, withStyles } from '@material-ui/core/styles';
import React, { Component, useState } from 'react';
import * as Client from '../../api/client';
import { Server } from '../../api/server';
import BareTextField from '../../common/BareTextField';
import RichEditor from '../../common/RichEditor';
import RichEditorImageUpload from '../../common/RichEditorImageUpload';
import SubmitButton from '../../common/SubmitButton';
import { WithMediaQuery, withMediaQuery } from '../../common/util/MediaQuery';
import MyButton from './MyButton';

const styles = (theme: Theme) => createStyles({
});
interface Props {
  server: Server;
  comment: Client.CommentWithVote;
  loggedInUser?: Client.User;
  open?: boolean;
  bare?: boolean;
  forceOutline?: boolean;
  onBlur: () => void;
  onCancel?: () => void;
  onUpdated?: () => void;
}
interface State {
  deleteDialogOpen?: boolean;
  isSubmitting?: boolean;
  content?: string;
}
class CommentEdit extends Component<Props & WithMediaQuery & WithStyles<typeof styles, true>, State> {
  state: State = {};
  readonly richEditorImageUploadRef = React.createRef<RichEditorImageUpload>();

  render() {
    const canSubmit = this.state.content !== undefined;

    return (
      <>
        <RichEditor
          uploadImage={(file) => this.richEditorImageUploadRef.current!.uploadImage(file)}
          autoFocusAndSelect
          variant='outlined'
          size='small'
          disabled={this.state.isSubmitting}
          label='Content'
          fullWidth
          iAgreeInputIsSanitized
          value={(this.state.content === undefined ? this.props.comment.content : this.state.content) || ''}
          onChange={e => this.setState({ content: e.target.value })}
          multiline
          rows={1}
          rowsMax={15}
          component={!!this.props.bare ? BareTextField : undefined}
          {...{ forceOutline: this.props.forceOutline }}
          onBlur={this.props.onBlur}
        />
        <RichEditorImageUpload
          ref={this.richEditorImageUploadRef}
          server={this.props.server}
        />
        <DialogActions>
          {this.props.onCancel && (
            <MyButton
              buttonVariant='post'
              onClick={() => this.props.onCancel?.()}
            >Cancel</MyButton>
          )}
          <MyButton
            buttonVariant='post'
            disabled={this.state.isSubmitting}
            style={{ color: !this.state.isSubmitting ? this.props.theme.palette.error.main : undefined }}
            onClick={() => this.setState({ deleteDialogOpen: true })}
          >Delete</MyButton>
          <SubmitButton color='primary' isSubmitting={this.state.isSubmitting} disabled={!canSubmit || this.state.isSubmitting} onClick={() => {
            this.setState({ isSubmitting: true });
            this.props.server.dispatch().then(d => d.commentUpdate({
              projectId: this.props.server.getProjectId(),
              ideaId: this.props.comment.ideaId,
              commentId: this.props.comment.commentId,
              commentUpdate: {
                content: this.state.content,
              },
            })).then(idea => {
              this.setState({
                isSubmitting: false,
              });
              this.props.onUpdated?.();
            })
              .catch(e => this.setState({ isSubmitting: false }))
          }}>Publish</SubmitButton>
        </DialogActions>
        <CommentDelete
          server={this.props.server}
          comment={this.props.comment}
          asAdmin={false}
          open={this.state.deleteDialogOpen}
          onClose={() => this.setState({ deleteDialogOpen: false })}
          onDelete={() => {
            this.setState({ deleteDialogOpen: false });
            this.props.onUpdated?.();
          }}
        />
      </>
    );
  }
}

export const CommentDelete = (props: {
  server: Server;
  comment: Client.CommentWithVote;
  asAdmin: boolean
  open?: boolean;
  onClose: () => void;
  onDelete: () => void;
}) => {
  const [isSubmitting, setSubmitting] = useState(false);
  const theme = useTheme();
  return (
    <Dialog
      open={!!props.open}
      onClose={props.onClose}
    >
      <DialogTitle>Delete comment</DialogTitle>
      <DialogContent>
        <DialogContentText>Are you sure you want to permanently delete this comment?</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancel</Button>
        <SubmitButton
          isSubmitting={isSubmitting}
          style={{ color: !isSubmitting ? theme.palette.error.main : undefined }}
          onClick={() => {
            setSubmitting(true);
            (props.asAdmin
              ? props.server.dispatchAdmin().then(d => d.commentDeleteAdmin({
                projectId: props.server.getProjectId(),
                ideaId: props.comment.ideaId,
                commentId: props.comment.commentId,
              }))
              : props.server.dispatch().then(d => d.commentDelete({
                projectId: props.server.getProjectId(),
                ideaId: props.comment.ideaId,
                commentId: props.comment.commentId,
              })))
              .then(() => {
                setSubmitting(false);
                props.onDelete();
              })
              .catch(e => setSubmitting(false))
          }}>
          Delete
        </SubmitButton>
      </DialogActions>
    </Dialog>
  )
};

export default withStyles(styles, { withTheme: true })(
  withMediaQuery(theme => theme.breakpoints.down('xs'))(CommentEdit));

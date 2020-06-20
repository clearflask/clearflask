import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Grid } from '@material-ui/core';
import { createStyles, Theme, WithStyles, withStyles, WithTheme, withTheme } from '@material-ui/core/styles';
import React, { Component, useState } from 'react';
import * as Client from '../../api/client';
import { Server } from '../../api/server';
import RichEditor from '../../common/RichEditor';
import { WithMediaQuery, withMediaQuery } from '../../common/util/MediaQuery';

const styles = (theme: Theme) => createStyles({
  row: {
    margin: theme.spacing(2),
  }
});

interface Props {
  server: Server;
  comment: Client.CommentWithVote;
  loggedInUser?: Client.User;
  open?: boolean;
  onClose: () => void;
}
interface State {
  deleteDialogOpen?: boolean;
  isSubmitting?: boolean;
  content?: string;
}
class CommentEdit extends Component<Props & WithMediaQuery & WithStyles<typeof styles, true>, State> {
  state: State = {};

  render() {
    const canSubmit = this.state.content !== undefined;

    return (
      <React.Fragment>
        <Dialog
          open={this.props.open || false}
          onClose={this.props.onClose.bind(this)}
          scroll='body'
          fullScreen={this.props.mediaQuery}
          fullWidth
        >
          <DialogTitle>Edit</DialogTitle>
          <DialogContent>
            <Grid container alignItems='baseline'>
              <Grid item xs={12} className={this.props.classes.row}>
                <RichEditor
                  disabled={this.state.isSubmitting}
                  label='Content'
                  fullWidth
                  value={this.state.content === undefined ? this.props.comment.content : this.state.content}
                  onChange={e => this.setState({ content: e.target.value })}
                  multiline
                  rows={1}
                  rowsMax={15}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.props.onClose()}>Close</Button>
            <Button
              disabled={this.state.isSubmitting}
              style={{ color: !this.state.isSubmitting ? this.props.theme.palette.error.main : undefined }}
              onClick={() => this.setState({ deleteDialogOpen: true })}
            >Delete</Button>
            <Button color='primary' disabled={!canSubmit || this.state.isSubmitting} onClick={() => {
              this.setState({ isSubmitting: true });
              this.props.server.dispatch().commentUpdate({
                projectId: this.props.server.getProjectId(),
                ideaId: this.props.comment.ideaId,
                commentId: this.props.comment.commentId,
                commentUpdate: {
                  content: this.state.content,
                },
              })
                .then(idea => {
                  this.setState({
                    isSubmitting: false,
                    content: undefined,
                  });
                  this.props.onClose();
                })
                .catch(e => this.setState({ isSubmitting: false }))
            }}>Publish</Button>
          </DialogActions>
        </Dialog>
        <CommentDelete
          server={this.props.server}
          comment={this.props.comment}
          asAdmin={false}
          open={this.state.deleteDialogOpen}
          onClose={() => this.setState({ deleteDialogOpen: false })}
        />
      </React.Fragment>
    );
  }
}

export const CommentDelete = withTheme((props: {
  server: Server;
  comment: Client.CommentWithVote;
  asAdmin: boolean
  open?: boolean;
  onClose: () => void;
} & WithTheme) => {
  const [isSubmitting, setSubmitting] = useState(false);
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
        <Button
          disabled={isSubmitting}
          style={{ color: !isSubmitting ? props.theme.palette.error.main : undefined }}
          onClick={() => {
            setSubmitting(true);
            (props.asAdmin
              ? props.server.dispatchAdmin().then(d => d.commentDeleteAdmin({
                projectId: props.server.getProjectId(),
                ideaId: props.comment.ideaId,
                commentId: props.comment.commentId,
              }))
              : props.server.dispatch().commentDelete({
                projectId: props.server.getProjectId(),
                ideaId: props.comment.ideaId,
                commentId: props.comment.commentId,
              }))
              .then(() => {
                setSubmitting(false);
                props.onClose();
              })
              .catch(e => setSubmitting(false))
          }}>Delete</Button>
      </DialogActions>
    </Dialog>
  )
});

export default withStyles(styles, { withTheme: true })(
  withMediaQuery(theme => theme.breakpoints.down('xs'))(CommentEdit));

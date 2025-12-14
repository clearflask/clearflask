// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, Collapse } from '@material-ui/core';
import { Theme, WithStyles, createStyles, withStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { WithTranslation, withTranslation } from 'react-i18next';
import { Server } from '../../api/server';
import RichEditor from '../../common/RichEditor';
import RichEditorImageUpload from '../../common/RichEditorImageUpload';
import ScrollAnchor from '../../common/util/ScrollAnchor';
import UserSelection from '../../site/dashboard/UserSelection';

const styles = (theme: Theme) => createStyles({
  addCommentForm: {
    display: 'inline-flex',
    flexDirection: 'column',
    margin: theme.spacing(1, 0),
    alignItems: 'flex-end',
    width: '100%',
    maxWidth: '100%',
  },
  addCommentFormOuter: {
    maxWidth: 600,
  },
  addCommentField: {
    transition: theme.transitions.create('width'),
    width: '100%',
  },
  addCommentSubmitButton: {
    margin: theme.spacing(1),
  },
  userSelection: {
    marginBottom: theme.spacing(1),
  },
});

interface Props {
  className?: string;
  collapseIn?: boolean;
  focusOnIn?: boolean;
  server: Server;
  ideaId: string;
  parentCommentId?: string;
  mergedPostId?: string;
  inputLabel?: string;
  logIn: () => Promise<void>;
  onSubmitted?: () => void;
  onBlurAndEmpty?: () => void;
}

interface State {
  newCommentInput?: string;
  selectedAuthorId?: string;
}

class Post extends Component<Props & WithTranslation<'app'> & WithStyles<typeof styles, true>, State> {
  state: State = {};
  readonly richEditorImageUploadRef = React.createRef<RichEditorImageUpload>();
  readonly inputRef: React.RefObject<HTMLInputElement> = React.createRef();

  componentDidMount() {
    if (this.props.focusOnIn && this.props.collapseIn === true) {
      this.inputFocus();
    };
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (this.props.focusOnIn
      && prevProps.collapseIn !== true
      && this.props.collapseIn === true) {
      this.inputFocus();
    };
  }

  inputFocus() {
    // Focus after smooth scrolling finishes to prevent rapid scroll
    setTimeout(() => this.inputRef.current?.focus(), 200);
  }

  render() {
    const isMod = this.props.server.isModOrAdminLoggedIn();
    return (
      <Collapse
        mountOnEnter
        in={this.props.collapseIn !== false}
        className={classNames(this.props.className, this.props.classes.addCommentFormOuter)}
      >
        <div className={this.props.classes.addCommentForm}>
          {isMod && (
            <UserSelection
              className={this.props.classes.userSelection}
              variant='outlined'
              size='small'
              server={this.props.server}
              label={this.props.t('as-user')}
              width='100%'
              suppressInitialOnChange
              onChange={selectedUserLabel => this.setState({ selectedAuthorId: selectedUserLabel?.value })}
              allowCreate
            />
          )}
          <RichEditor
            uploadImage={(file) => this.richEditorImageUploadRef.current!.uploadImage(file)}
            variant='outlined'
            size='small'
            id='createComment'
            className={this.props.classes.addCommentField}
            label={this.props.inputLabel}
            iAgreeInputIsSanitized
            minInputHeight={60}
            value={this.state.newCommentInput || ''}
            onChange={e => this.setState({ newCommentInput: e.target.value })}
            multiline
            rowsMax={10}
            InputProps={{
              inputRef: this.inputRef,
              // onBlurAndEmpty after a while, fixes issue where pasting causes blur.
              onBlur: () => setTimeout(() => !this.state.newCommentInput && this.props.onBlurAndEmpty && this.props.onBlurAndEmpty(), 200),
            }}
          />
          <RichEditorImageUpload
            ref={this.richEditorImageUploadRef}
            server={this.props.server}
          />
          <Collapse in={!!this.state.newCommentInput}>
            <Button
              color='primary'
              variant='contained'
              disableElevation
              className={this.props.classes.addCommentSubmitButton}
              disabled={!this.state.newCommentInput}
              onClick={e => {
                this.props.logIn().then(() => {
                  const commentData = {
                    content: this.state.newCommentInput!,
                    parentCommentId: this.props.mergedPostId === this.props.parentCommentId ? undefined : this.props.parentCommentId,
                    mergedPostId: this.props.mergedPostId,
                  };
                  if (this.state.selectedAuthorId) {
                    return this.props.server.dispatchAdmin().then(d => d.commentCreateAdmin({
                      projectId: this.props.server.getProjectId(),
                      ideaId: this.props.ideaId,
                      commentCreateAdmin: {
                        ...commentData,
                        authorUserId: this.state.selectedAuthorId!,
                      },
                    }));
                  } else {
                    return this.props.server.dispatch().then(d => d.commentCreate({
                      projectId: this.props.server.getProjectId(),
                      ideaId: this.props.ideaId,
                      commentCreate: commentData,
                    }));
                  }
                }).then(comment => {
                  this.setState({ newCommentInput: undefined, selectedAuthorId: undefined })
                  this.props.onSubmitted && this.props.onSubmitted();
                }).catch(err => {
                  // Error will be displayed by the server's error handling
                  // Keep the form state so user can retry or fix the issue
                  console.error('Failed to create comment:', err);
                });
              }}
            >
              {this.props.t('submit')}
            </Button>
          </Collapse>
          {!!this.props.focusOnIn && (
            <ScrollAnchor scrollNow={this.props.collapseIn} />
          )}
        </div>
      </Collapse>
    );
  }
}

export default withStyles(styles, { withTheme: true })(withTranslation('app', { withRef: true })(Post));

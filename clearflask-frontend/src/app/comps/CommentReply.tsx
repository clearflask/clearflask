import loadable from '@loadable/component';
import { Button, Collapse } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { Server } from '../../api/server';
import ScrollAnchor from '../../common/util/ScrollAnchor';
import { importFailed, importSuccess } from '../../Main';
import Loading from '../utils/Loading';

const RichEditor = loadable(() => import('../../common/RichEditor'/* webpackChunkName: "RichEditor", webpackPrefetch: true */).then(importSuccess).catch(importFailed), { fallback: (<Loading />), ssr: false });

const styles = (theme: Theme) => createStyles({
  addCommentForm: {
    display: 'inline-flex',
    flexDirection: 'column',
    margin: theme.spacing(4),
    alignItems: 'flex-end',
  },
  addCommentField: {
    transition: theme.transitions.create('width'),
    width: '100%',
  },
  addCommentSubmitButton: {
  },
});

interface Props {
  className?: string;
  server: Server;
  ideaId: string;
  parentCommentId?: string;
  focusOnMount?: boolean;
  logIn: () => Promise<void>;
  onSubmitted?: () => void;
  onBlurAndEmpty?: () => void;
}

interface State {
  newCommentInput?: string;
}

class Post extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = {};
  readonly inputRef: React.RefObject<HTMLInputElement> = React.createRef();

  componentDidMount() {
    if (this.props.focusOnMount) {
      // Focus after smooth scrolling finishes to prevent rapid scroll
      setTimeout(() => this.inputRef.current?.focus(), 200)
    };
  }

  render() {
    return (
      <div className={`${this.props.classes.addCommentForm} ${this.props.className || ''}`}>
        <RichEditor
          variant='outlined'
          size='small'
          id='createComment'
          className={this.props.classes.addCommentField}
          label='Comment'
          iAgreeInputIsSanitized
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
        <Collapse in={!!this.state.newCommentInput}>
          <Button
            color='primary'
            disabled={!this.state.newCommentInput}
            onClick={e => {
              this.props.logIn().then(() => this.props.server.dispatch().commentCreate({
                projectId: this.props.server.getProjectId(),
                ideaId: this.props.ideaId,
                commentCreate: {
                  content: this.state.newCommentInput!,
                  parentCommentId: this.props.parentCommentId,
                },
              })).then(comment => {
                this.setState({ newCommentInput: undefined })
                this.props.onSubmitted && this.props.onSubmitted();
              });
            }}
          >
            Submit
        </Button>
        </Collapse>
        <ScrollAnchor scrollOnMount />
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(Post);

import { Button, Collapse, TextField } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { Server } from '../../api/server';
import ScrollAnchor from '../../common/util/ScrollAnchor';

const styles = (theme: Theme) => createStyles({
  addCommentForm: {
    display: 'inline-flex',
    flexDirection: 'column',
    marginLeft: theme.spacing(2),
    alignItems: 'flex-end',
  },
  addCommentField: {
    transition: theme.transitions.create('width'),
  },
  addCommentFieldCollapsed: {
    width: 73,
  },
  addCommentFieldExpanded: {
    width: 250,
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
        <TextField
          id='createComment'
          className={`${this.props.classes.addCommentField} ${!!this.state.newCommentInput
            ? this.props.classes.addCommentFieldExpanded : this.props.classes.addCommentFieldCollapsed}`}
          label='Comment'
          value={this.state.newCommentInput || ''}
          onChange={e => this.setState({ newCommentInput: e.target.value })}
          multiline
          rowsMax={10}
          InputProps={{
            inputRef: this.inputRef,
            onBlur: () => !this.state.newCommentInput && this.props.onBlurAndEmpty && this.props.onBlurAndEmpty(),
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

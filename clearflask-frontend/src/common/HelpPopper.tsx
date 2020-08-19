import { Button, Fade, Paper, Popper, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import HelpIcon from '@material-ui/icons/InfoOutlined';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
  iconButton: {
    // fontSize: '2em',
    padding: '0px',
    borderRadius: '100px',
    minWidth: 'unset',
    color: theme.palette.text.hint,
  },
  content: {
    padding: theme.spacing(2),
    maxWidth: 500,
  },
});

interface Props extends WithStyles<typeof styles, true> {
  title?: string;
  description?: string;
}
interface State {
  open?: HTMLButtonElement;
}
class HelpPopper extends Component<Props, State> {
  state: State = {};

  render() {
    return (
      <React.Fragment>
        <Button
          className={this.props.classes.iconButton}
          onClick={e => this.setState({ open: this.state.open ? undefined : e.currentTarget })}
          onMouseOver={e => this.setState({ open: e.currentTarget })}
          onMouseOut={e => this.setState({ open: undefined })}
        >
          <HelpIcon fontSize='inherit' />
        </Button>
        <Popper
          open={!!this.state.open}
          anchorEl={this.state.open}
          placement='bottom'
          transition
          modifiers={{
            flip: {
              enabled: true,
            },
            preventOverflow: {
              enabled: true,
              boundariesElement: 'scrollParent',
            },
          }}
        >
          {({ TransitionProps }) => (
            <Fade {...TransitionProps}>
              <Paper variant='outlined' className={this.props.classes.content}>
                {this.props.title && (<Typography variant='subtitle2'>{this.props.title}</Typography>)}
                {this.props.description && (<Typography variant='body1'>{this.props.description}</Typography>)}
                {this.props.children}
              </Paper>
            </Fade>
          )}
        </Popper>
      </React.Fragment>
    );
  }
}

export default withStyles(styles, { withTheme: true })(HelpPopper);

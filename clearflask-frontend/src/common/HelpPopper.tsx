import { Button, Fade, Paper, Popper, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import HelpIcon from '@material-ui/icons/InfoOutlined';
import classNames from 'classnames';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
  iconButton: {
    // fontSize: '2em',
    padding: '0px',
    borderRadius: '100px',
    minWidth: 'unset',
    textTransform: 'unset',
  },
  content: {
    padding: theme.spacing(2),
    maxWidth: 500,
  },
  popper: {
    zIndex: theme.zIndex.tooltip + 1,
  },
});

interface Props extends WithStyles<typeof styles, true> {
  className?: string;
  title?: string;
  description?: string;
  children?: React.ReactNode;
}
interface State {
  open?: HTMLButtonElement;
}
class HelpPopper extends Component<Props, State> {
  state: State = {};

  render() {
    return (
      <>
        <Button
          color='inherit'
          className={classNames(this.props.className, this.props.classes.iconButton)}
          onClick={e => this.setState({ open: this.state.open ? undefined : e.currentTarget })}
          onMouseOver={e => this.setState({ open: e.currentTarget })}
          onMouseOut={e => this.setState({ open: undefined })}
        >
          {this.props.children || (
            <HelpIcon fontSize='inherit' color='inherit' />
          )}
        </Button>
        <Popper
          className={this.props.classes.popper}
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
                {this.props.title && (<Typography variant='h6'>{this.props.title}</Typography>)}
                {this.props.description && (<Typography variant='body1'>{this.props.description}</Typography>)}
              </Paper>
            </Fade>
          )}
        </Popper>
      </>
    );
  }
}

export default withStyles(styles, { withTheme: true })(HelpPopper);

import { Fade, Paper, Popper } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { Server } from '../api/server';
import NotificationList from './comps/NotificationList';

const styles = (theme: Theme) => createStyles({
  popper: {
    '&[x-placement*="bottom"] $arrow': {
      top: 0,
      right: 12,
      marginTop: '-0.9em',
      width: '3em',
      height: '1em',
      '&::before': {
        borderWidth: '0 1em 1em 1em',
        borderColor: `transparent transparent ${theme.palette.background.paper} transparent`,
      },
    },
  },
  arrow: {
    position: 'absolute',
    fontSize: 7,
    width: '3em',
    height: '3em',
    '&::before': {
      content: '""',
      margin: 'auto',
      display: 'block',
      width: 0,
      height: 0,
      borderStyle: 'solid',
    },
  },
  paper: {
    boxShadow: '-7px 4px 42px 8px rgba(0,0,0,.3)',
    maxWidth: 400,
    overflow: 'auto',
  },
});
interface Props {
  server: Server;
  anchorEl?: HTMLElement;
  onClose: () => void;
}
class NotificationPopup extends Component<Props & WithStyles<typeof styles, true>> {
  readonly arrowRef: React.RefObject<HTMLSpanElement> = React.createRef();

  render() {
    return (
      <React.Fragment>
        <Popper
          open={!!this.props.anchorEl}
          className={this.props.classes.popper}
          placement='bottom-end'
          anchorEl={this.props.anchorEl}
          modifiers={{
            flip: {
              enabled: true,
            },
            preventOverflow: {
              enabled: true,
              boundariesElement: 'viewport',
            },
            arrow: {
              enabled: true,
              element: this.arrowRef.current,
            },
          }}
          transition
        >
          {({ TransitionProps }) => (
            <Fade {...TransitionProps} timeout={350}>
              <Paper className={this.props.classes.paper}>
                <span className={this.props.classes.arrow} ref={this.arrowRef} />
                <NotificationList server={this.props.server} />
              </Paper>
            </Fade>
          )}
        </Popper>
      </React.Fragment>
    );
  }
}

export default withStyles(styles, { withTheme: true })(NotificationPopup);

import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { Server } from '../api/server';
import ClosablePopper from '../common/ClosablePopper';
import NotificationList from './comps/NotificationList';

const styles = (theme: Theme) => createStyles({
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
        <ClosablePopper
          open={!!this.props.anchorEl}
          onClose={this.props.onClose.bind(this)}
          placement='bottom-end'
          anchorEl={this.props.anchorEl}
          arrow
          clickAway
          disableCloseButton
        >
          <NotificationList server={this.props.server} />
        </ClosablePopper>
      </React.Fragment>
    );
  }
}

export default withStyles(styles, { withTheme: true })(NotificationPopup);

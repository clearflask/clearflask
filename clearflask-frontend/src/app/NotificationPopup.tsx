// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
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
      <>
        <ClosablePopper
          anchorType='element'
          anchor={this.props.anchorEl}
          open={!!this.props.anchorEl}
          onClose={this.props.onClose.bind(this)}
          placement='bottom-end'
          arrow
          clickAway
          closeButtonPosition='disable'
        >
          <NotificationList server={this.props.server} isInsidePaper />
        </ClosablePopper>
      </>
    );
  }
}

export default withStyles(styles, { withTheme: true })(NotificationPopup);

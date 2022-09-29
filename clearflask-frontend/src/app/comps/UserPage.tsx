// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { ReduxState, Server } from '../../api/server';
import UserContributions from '../../common/UserContributions';
import { setAppTitle } from '../../common/util/titleUtil';
import UserEdit from './UserEdit';

const styles = (theme: Theme) => createStyles({
  page: {
    margin: theme.spacing(1),
  },
  pageContainer: {
  },
  title: {
    margin: theme.spacing(0, 5),
  },
  userViewTable: {
    margin: theme.spacing(1),
    width: 'auto',
    maxWidth: '100%',
  },
  userViewTableCell: {
    borderBottom: 'none',
  },
  overview: {
    marginTop: theme.spacing(3),
    minWidth: 300,
    maxWidth: '100%',
    flex: '1 1 0px',
  },
});
interface Props {
  server: Server;
  userId?: string;
  suppressSignOut?: boolean;
  onDeleted?: () => void;
}
interface ConnectProps {
  projectName?: string,
  suppressSetTitle?: boolean,
}
class UserPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {
  render() {
    if (this.props.projectName && !this.props.suppressSetTitle) {
      setAppTitle(this.props.projectName, 'User');
    }

    return (
      <div className={this.props.classes.page}>
        <div className={this.props.classes.pageContainer}>
          <UserEdit
            setTitle
            className={this.props.classes.overview}
            server={this.props.server}
            userId={this.props.userId}
            suppressSignOut={this.props.suppressSignOut}
            onDeleted={this.props.onDeleted}
          />
          {this.props.userId && (
            <UserContributions
              server={this.props.server}
              userId={this.props.userId}
            />
          )}
        </div>
      </div>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const connectProps: ConnectProps = {
    projectName: state.conf.conf?.layout.pageTitleSuffix || state.conf.conf?.name,
    suppressSetTitle: state.settings.suppressSetTitle,
  };
  return connectProps;
})(withStyles(styles, { withTheme: true })(UserPage));

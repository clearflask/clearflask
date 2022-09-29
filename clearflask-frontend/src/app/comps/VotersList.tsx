// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, Table, TableBody, TableCell, TableRow, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import { Component } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import { Link } from 'react-router-dom';
import * as Admin from '../../api/admin';
import { ReduxState, Server, Status } from '../../api/server';
import { contentScrollApplyStyles, Orientation } from '../../common/ContentScroll';
import UserWithAvatarDisplay from '../../common/UserWithAvatarDisplay';
import { preserveEmbed } from '../../common/util/historyUtil';
import Loading from '../utils/Loading';

const styles = (theme: Theme) => createStyles({
  container: {
  },
  table: (props: Props) => ({
    maxHeight: 300,
    whiteSpace: 'nowrap',
    ...contentScrollApplyStyles({
      theme,
      orientation: Orientation.Vertical,
      backgroundColor: props.isInsidePaper ? theme.palette.background.paper : undefined,
    }),
  }),
  noNotificationsLabel: {
    margin: theme.spacing(3),
    color: theme.palette.text.secondary,
  },
  button: {
    margin: 'auto',
    display: 'block',
  },
});

interface Props {
  className?: string;
  server: Server;
  postId: string;
  isInsidePaper?: boolean;
}

interface ConnectProps {
  callOnMount?: () => void,
  voters?: Admin.UserAdmin[];
  status?: Status;
  getNextVoters?: () => void;
}

class VotersList extends Component<Props & ConnectProps & WithTranslation<'app'> & WithStyles<typeof styles, true> & RouteComponentProps> {

  constructor(props) {
    super(props);

    props.callOnMount?.();
  }

  render() {
    return (
      <div className={classNames(this.props.className, this.props.classes.container)}>
        <div className={this.props.classes.table}>
          <Table size='medium'>
            <TableBody>
              {!this.props.voters?.length ? (
                <Typography
                  className={this.props.classes.noNotificationsLabel}
                  variant='overline'
                >{this.props.t('no-voters')}</Typography>
              ) : this.props.voters.map(voter => (
                <TableRow
                  key={voter.userId}
                  hover
                  component={Link}
                  {...{
                    to: preserveEmbed(`/user/${voter.userId}`),
                  }}
                >
                  <TableCell key='user'>
                    <UserWithAvatarDisplay
                      user={voter}
                      baseline
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            {this.props.status === Status.PENDING && (
              <TableCell key='pending'>
                <Loading />
              </TableCell>
            )}
            {this.props.status === Status.REJECTED && (
              <TableCell key='rejected'>
                Failed to load
              </TableCell>
            )}
          </Table>
        </div>
        {this.props.getNextVoters && (
          <Button fullWidth className={this.props.classes.button} onClick={() => this.props.getNextVoters?.()}>
            {this.props.t('show-more')}
          </Button>
        )}
      </div>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  var getNextVoters;
  var callOnMount;
  const search = state.votes.votersSearchByIdeaId[ownProps.postId];
  if (search?.status === undefined) {
    callOnMount = () => {
      ownProps.server.dispatchAdmin().then(d => d.ideaVotersGetAdmin({
        projectId: ownProps.server.getProjectId(),
        ideaId: ownProps.postId,
      }));
    };
  } else if (!!search?.cursor) {
    getNextVoters = () => ownProps.server.dispatchAdmin().then(d => d.ideaVotersGetAdmin({
      projectId: ownProps.server.getProjectId(),
      ideaId: ownProps.postId,
      cursor: search.cursor,
    }));
  }
  const connectProps: ConnectProps = {
    callOnMount,
    voters: search?.voters,
    getNextVoters,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(withTranslation('app', { withRef: true })(VotersList))));

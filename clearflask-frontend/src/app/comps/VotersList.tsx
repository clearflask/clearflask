// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Box, Button, IconButton, Table, TableBody, TableCell, TableRow, Tooltip, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import RemoveIcon from '@material-ui/icons/Remove';
import classNames from 'classnames';
import { WithSnackbarProps, withSnackbar } from 'notistack';
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
import UserSelection from '../../site/dashboard/UserSelection';
import { Label } from './SelectionPicker';
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
  proxyVoteContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  voterRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  removeButton: {
    marginLeft: theme.spacing(1),
    padding: theme.spacing(0.5),
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

interface State {
  selectedUserLabel?: Label;
  isSubmitting?: boolean;
  removingUserId?: string;
}

class VotersList extends Component<Props & ConnectProps & WithTranslation<'app'> & WithStyles<typeof styles, true> & WithSnackbarProps & RouteComponentProps, State> {
  state: State = {};

  constructor(props) {
    super(props);

    props.callOnMount?.();
  }

  handleProxyVote = async (userId: string, vote: Admin.VoteOption) => {
    if (vote === Admin.VoteOption.Upvote) {
      this.setState({ isSubmitting: true });
    } else {
      this.setState({ removingUserId: userId });
    }
    try {
      const dispatcher = await this.props.server.dispatchAdmin();
      await dispatcher.ideaVoteUpdateAdmin({
        projectId: this.props.server.getProjectId(),
        ideaId: this.props.postId,
        ideaVoteUpdateAdmin: {
          voterUserId: userId,
          vote,
        },
      });
      // Refresh the voters list
      await dispatcher.ideaVotersGetAdmin({
        projectId: this.props.server.getProjectId(),
        ideaId: this.props.postId,
      });
      // Clear selection after successful vote
      if (vote === Admin.VoteOption.Upvote) {
        this.setState({ selectedUserLabel: undefined });
      }
    } catch (error) {
      console.error('Failed to update vote:', error);
      this.props.enqueueSnackbar(
        vote === Admin.VoteOption.Upvote
          ? this.props.t('failed-to-add-vote')
          : this.props.t('failed-to-remove-vote'),
        { variant: 'error' }
      );
    } finally {
      this.setState({ isSubmitting: false, removingUserId: undefined });
    }
  };

  handleAddVote = () => {
    const userId = this.state.selectedUserLabel?.value;
    if (userId) {
      this.handleProxyVote(userId, Admin.VoteOption.Upvote);
    }
  };

  handleRemoveVote = (userId: string) => {
    this.handleProxyVote(userId, Admin.VoteOption.None);
  };

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
                >
                  <TableCell key='user'>
                    <div className={this.props.classes.voterRow}>
                      <Link to={preserveEmbed(`/user/${voter.userId}`)} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <UserWithAvatarDisplay
                          user={voter}
                          baseline
                        />
                      </Link>
                      <Tooltip title={this.props.t('remove-vote')}>
                        <IconButton
                          className={this.props.classes.removeButton}
                          size='small'
                          onClick={() => this.handleRemoveVote(voter.userId)}
                          disabled={this.state.removingUserId === voter.userId}
                        >
                          {this.state.removingUserId === voter.userId ? <Loading /> : <RemoveIcon fontSize='small' />}
                        </IconButton>
                      </Tooltip>
                    </div>
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
        <Box className={this.props.classes.proxyVoteContainer}>
          <UserSelection
            server={this.props.server}
            label={this.props.t('vote-on-behalf')}
            placeholder={this.props.t('search-user')}
            onChange={(userLabel) => this.setState({ selectedUserLabel: userLabel })}
            allowCreate
            allowClear
            size='small'
            variant='outlined'
            minWidth={150}
          />
          <Tooltip title={this.props.t('add-vote')}>
            <span>
              <IconButton
                color='primary'
                onClick={this.handleAddVote}
                disabled={!this.state.selectedUserLabel || this.state.isSubmitting}
              >
                {this.state.isSubmitting ? <Loading /> : <AddIcon />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
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
    status: search?.status,
    getNextVoters,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(withTranslation('app', { withRef: true })(withSnackbar(VotersList)))));

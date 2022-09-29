// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { FormControlLabel, FormHelperText, Switch } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import Templater from '../../common/config/configTemplater';

const styles = (theme: Theme) => createStyles({
  extraControls: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    margin: theme.spacing(1),
  },
});

interface Props {
  templater: Templater;
}

interface State {
  votingEnableDownvote: boolean;
}

class PrioritizationControls extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = { votingEnableDownvote: false };

  render() {
    return (
      <div className={this.props.classes.extraControls}>
        <FormControlLabel
          control={(
            <Switch
              color='primary'
              checked={!!this.state.votingEnableDownvote}
              onChange={this.handleChangeEnableDownvote.bind(this)}
            />
          )}
          label={<FormHelperText component='span'>Downvoting</FormHelperText>}
        />
      </div>
    );
  }

  handleChangeEnableDownvote(e, enableDownvote) {
    this.setState({ votingEnableDownvote: enableDownvote });
    this.props.templater.supportVoting(0, enableDownvote);
  }
}

export default withStyles(styles, { withTheme: true })(PrioritizationControls);

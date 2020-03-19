import { FormControlLabel, FormHelperText, Switch } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import Templater from '../../common/config/configTemplater';

const styles = (theme: Theme) => createStyles({
  page: {
  },
  extraControls: {
    minHeight: 200,
    margin: theme.spacing(1),
  },
});

interface Props {
  templater: Templater;
}

interface State {
  votingEnableDownvote?: boolean;
}

class PrioritizationControls extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = {};

  render() {
    return (
      <div className={this.props.classes.page}>
        <div className={this.props.classes.extraControls}>
          <FormControlLabel
            control={(
              <Switch
                color='primary'
                checked={!!this.state.votingEnableDownvote}
                onChange={this.handleChangeEnableDownvote.bind(this)}
              />
            )}
            label={<FormHelperText component='span'>Enable downvoting</FormHelperText>}
          />
        </div>
      </div>
    );
  }

  handleChangeEnableDownvote(e, enableDownvote) {
    this.setState({ votingEnableDownvote: enableDownvote });
    this.props.templater.supportVoting(0, enableDownvote);
  }
}

export default withStyles(styles, { withTheme: true })(PrioritizationControls);

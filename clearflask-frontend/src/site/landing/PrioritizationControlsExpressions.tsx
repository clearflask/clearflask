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
  expressionsLimitEmojis?: boolean;
  expressionsAllowMultiple?: boolean;
}

class PrioritizationControlsExpressions extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = {};

  render() {
    return (
      <div className={this.props.classes.extraControls}>
        <FormControlLabel
          control={(
            <Switch
              color='primary'
              checked={!!this.state.expressionsLimitEmojis}
              onChange={this.handleChangeExpressionsLimitEmojis.bind(this)}
            />
          )}
          label={<FormHelperText component='span'>Limit available emojis</FormHelperText>}
        />
        <FormControlLabel
          control={(
            <Switch
              color='primary'
              checked={!!this.state.expressionsAllowMultiple}
              onChange={this.handleChangeExpressionsLimitSingle.bind(this)}
            />
          )}
          label={<FormHelperText component='span'>Allow selecting multiple</FormHelperText>}
        />
      </div>
    );
  }

  handleChangeExpressionsLimitSingle(e, allowMultiple) {
    this.setState({ expressionsAllowMultiple: allowMultiple });
    this.props.templater.supportExpressingLimitEmojiPerIdea(0, !allowMultiple);
  }

  handleChangeExpressionsLimitEmojis(e, limitEmojis) {
    this.setState({ expressionsLimitEmojis: limitEmojis });
    if (limitEmojis) {
      this.props.templater.supportExpressingFacebookStyle(0, !this.state.expressionsAllowMultiple);
    } else {
      this.props.templater.supportExpressingAllEmojis(0, !this.state.expressionsAllowMultiple);
    }
  }
}

export default withStyles(styles, { withTheme: true })(PrioritizationControlsExpressions);

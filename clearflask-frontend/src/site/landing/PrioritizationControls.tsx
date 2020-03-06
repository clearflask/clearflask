import { FormControlLabel, FormHelperText, Radio, RadioGroup, Switch } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { ToggleButton, ToggleButtonGroup } from '@material-ui/lab';
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
  type: 'funding' | 'voting' | 'expressions';
  fundingType: 'currency' | 'time' | 'beer';
  votingEnableDownvote?: boolean;
  expressionsLimitEmojis?: boolean;
  expressionsAllowMultiple?: boolean;
}

class PrioritizationControls extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = {
    type: 'funding',
    fundingType: 'currency',
  };

  render() {
    return (
      <div className={this.props.classes.page}>
        <ToggleButtonGroup
          {...{ size: 'small' }}
          value={this.state.type}
          exclusive
          style={{ display: 'inline-block' }}
          onChange={this.handleChangeType.bind(this)}
        >
          <ToggleButton value='funding'>Fund</ToggleButton>
          <ToggleButton value='voting'>Vote</ToggleButton>
          <ToggleButton value='expressions'>Express</ToggleButton>
        </ToggleButtonGroup>
        <div className={this.props.classes.extraControls}>
          {this.state.type === 'funding' && (
            <RadioGroup
              value={this.state.fundingType}
              onChange={this.handleChangeFundingType.bind(this)}
            >
              <FormControlLabel value='currency' control={<Radio color='primary' />} label='Currency' />
              <FormControlLabel value='time' control={<Radio color='primary' />} label='Development time' />
              <FormControlLabel value='beer' control={<Radio color='primary' />} label="Customizable" />
            </RadioGroup>
          )}
          {this.state.type === 'voting' && (
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
          )}
          {this.state.type === 'expressions' && (
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
          )}
          {this.state.type === 'expressions' && (
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
          )}
        </div>
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

  handleChangeEnableDownvote(e, enableDownvote) {
    this.setState({ votingEnableDownvote: enableDownvote });
    this.props.templater.supportVoting(0, enableDownvote);
  }

  handleChangeType(e, val) {
    switch (val) {
      case 'funding':
        this.setState({ type: val });
        this.props.templater.supportNone(0);
        this.props.templater.supportFunding(0);
        break;
      case 'voting':
        this.setState({ type: val });
        this.props.templater.supportNone(0);
        this.props.templater.supportVoting(0, this.state.votingEnableDownvote);
        break;
      case 'expressions':
        this.setState({ type: val });
        this.props.templater.supportNone(0);
        this.props.templater.supportExpressingAllEmojis(0, !this.state.expressionsAllowMultiple);
        break;
    }
  }

  handleChangeFundingType(e, val) {
    switch (val) {
      case 'currency':
        this.setState({ fundingType: val });
        this.props.templater.creditsCurrency();
        break;
      case 'time':
        this.setState({ fundingType: val });
        this.props.templater.creditsTime();
        break;
      case 'beer':
        this.setState({ fundingType: val });
        this.props.templater.creditsBeer();
        break;
    }
  }
}

export default withStyles(styles, { withTheme: true })(PrioritizationControls);

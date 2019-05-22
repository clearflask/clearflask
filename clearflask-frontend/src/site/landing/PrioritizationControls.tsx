import React, { Component } from 'react';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import * as ConfigEditor from '../../common/config/configEditor';
import Templater from '../../common/config/configTemplater';
import { ToggleButtonGroup, ToggleButton } from '@material-ui/lab';
import { Grow, RadioGroup, FormControlLabel, Radio, Switch, FormHelperText } from '@material-ui/core';

const styles = (theme:Theme) => createStyles({
  page: {
  },
});

interface Props {
  templater: Templater;
}

interface State {
  type:'funding'|'voting'|'expressions';
  fundingType:'currency'|'time'|'credits'|'beer';
  votingEnableDownvote?:boolean;
}

class PrioritizationControls extends Component<Props&WithStyles<typeof styles, true>, State> {
  state:State = {
    type: 'funding',
    fundingType: 'currency',
  };

  render() {
    return (
      <div className={this.props.classes.page}>
        <ToggleButtonGroup
          value={this.state.type}
          exclusive
          style={{display: 'inline-block'}}
          onChange={this.handleChangeType.bind(this)}
        >
          <ToggleButton value='funding'>Fund</ToggleButton>
          <ToggleButton value='voting'>Vote</ToggleButton>
          <ToggleButton value='expressions'>Express</ToggleButton>
        </ToggleButtonGroup>
        <div style={{minHeight: 200}}>
          {this.state.type === 'funding' && (
            <RadioGroup
              value={this.state.fundingType}
              onChange={this.handleChangeFundingType.bind(this)}
            >
              <FormControlLabel value='currency' control={<Radio />} label='Currency' />
              <FormControlLabel value='time' control={<Radio />} label='Time to complete' />
              <FormControlLabel value='credits' control={<Radio />} label="Virtual credits" />
              <FormControlLabel value='beer' control={<Radio />} label="Customizable" />
            </RadioGroup>
          )}
          {this.state.type === 'voting' && (
            <FormControlLabel
              control={(
                <Switch
                  color='default'
                  checked={!!this.state.votingEnableDownvote}
                  onChange={this.handleChangeEnableDownvote.bind(this)}
                />
              )}
              label={<FormHelperText component='span'>Enable downvoting</FormHelperText>}
            />
          )}
        </div>
      </div>
    );
  }

  handleChangeEnableDownvote(e, enableDownvote) {
    this.setState({votingEnableDownvote: enableDownvote});
    this.props.templater.supportVoting(0, enableDownvote);
  }

  handleChangeType(e, val) {
    switch(val) {
      case 'funding':
        this.setState({type: 'funding'});
        this.props.templater.supportNone(0);
        this.props.templater.supportFunding(0);
        break;
      case 'voting':
        this.setState({type: 'voting'});
        this.props.templater.supportNone(0);
        this.props.templater.supportVoting(0, true);
        break;
      case 'expressions':
        this.setState({type: 'expressions'});
        this.props.templater.supportNone(0);
        this.props.templater.supportExpressingAllEmojis(0);
        break;
    }
  }

  handleChangeFundingType(e, val) {
    switch(val) {
      case 'currency':
        this.setState({fundingType: 'currency'});
        this.props.templater.creditsCurrency();
        break;
      case 'time':
        this.setState({fundingType: 'time'});
        this.props.templater.creditsTime();
        break;
      case 'credits':
        this.setState({fundingType: 'credits'});
        this.props.templater.creditsUnitless();
        break;
      case 'beer':
        this.setState({fundingType: 'beer'});
        this.props.templater.creditsBeer();
        break;
    }
  }
}

export default withStyles(styles, { withTheme: true })(PrioritizationControls);

import { FormControlLabel, Radio, RadioGroup } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import Templater from '../../common/config/configTemplater';

const styles = (theme: Theme) => createStyles({
  page: {
  },
  extraControls: {
    margin: theme.spacing(1),
  },
});

interface Props {
  templater: Templater;
}

interface State {
  fundingType: 'currency' | 'time' | 'beer';
}

class PrioritizationControlsCredits extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = {
    fundingType: 'currency',
  };

  render() {
    return (
      <div className={this.props.classes.page}>
        <div className={this.props.classes.extraControls}>
          <RadioGroup
            value={this.state.fundingType}
            onChange={this.handleChangeFundingType.bind(this)}
          >
            <FormControlLabel value='currency' control={<Radio color='primary' />} label='Currency' />
            <FormControlLabel value='time' control={<Radio color='primary' />} label='Development time' />
            <FormControlLabel value='beer' control={<Radio color='primary' />} label="Customizable" />
          </RadioGroup>
        </div>
      </div>
    );
  }

  handleChangeFundingType(e, val) {
    switch (val) {
      case 'currency':
        this.setState({ fundingType: val });
        this.props.templater.creditsCurrencyWithoutCents();
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

export default withStyles(styles, { withTheme: true })(PrioritizationControlsCredits);

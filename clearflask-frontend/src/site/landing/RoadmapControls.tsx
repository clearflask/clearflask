import { FormControlLabel, Radio, RadioGroup } from '@material-ui/core';
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
  type: 'development' | 'funding' | 'custom';
}

class PrioritizationControlsCredits extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = {
    type: 'development',
  };

  render() {
    return (
      <RadioGroup
        className={this.props.classes.extraControls}
        value={this.state.type}
        onChange={(e, val) => {
          switch (val) {
            case 'development':
              this.setState({ type: val });
              this.props.templater.demoBoardPreset('development');
              break;
            case 'funding':
              this.setState({ type: val });
              this.props.templater.demoBoardPreset('funding');
              break;
            case 'custom':
              this.setState({ type: val });
              this.props.templater.demoBoardPreset('design');
              break;
          }
        }}
      >
        <FormControlLabel value='development' control={<Radio color='primary' />} label='Development' />
        <FormControlLabel value='funding' control={<Radio color='primary' />} label='Crowd-funding' />
        <FormControlLabel value='custom' control={<Radio color='primary' />} label="Custom" />
      </RadioGroup>
    );
  }
}

export default withStyles(styles, { withTheme: true })(PrioritizationControlsCredits);

import { Slider } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
});
interface Props {
}
interface State {
  value?: number;
}
class PricingSlider extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = {};
  render() {
    return (
      <div>
        <Slider
          value={this.state.value || 50}
          min={0}
          max={2000}
          onChange={(e, val) => {
            const value = val as any as number;
            this.setState({ value });
          }}
          valueLabelFormat={(val) => (
            <div>{val}</div>
          )}
        />
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(PricingSlider);

import React, { Component } from 'react';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import * as ConfigEditor from '../../common/config/configEditor';
import Templater from '../../common/config/configTemplater';
import { ToggleButtonGroup, ToggleButton } from '@material-ui/lab';

const styles = (theme:Theme) => createStyles({
  page: {
  },
});

interface Props {
  templater: Templater;
}

interface State {
  type:'funding'|'voting'|'expressions';
}

class PrioritizationControls extends Component<Props&WithStyles<typeof styles, true>, State> {
  state:State = {type:'funding'};

  render() {
    return (
      <div className={this.props.classes.page}>
        <ToggleButtonGroup
          value={this.state.type}
          exclusive
          style={{display: 'inline-block'}}
          onChange={this.handleChangeType.bind(this)}
        >
          <ToggleButton value='funding'>Funding</ToggleButton>
          <ToggleButton value='voting'>Voting</ToggleButton>
          <ToggleButton value='expressions'>Expressions</ToggleButton>
        </ToggleButtonGroup>
      </div>
    );
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
}

export default withStyles(styles, { withTheme: true })(PrioritizationControls);

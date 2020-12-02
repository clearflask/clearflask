import React, { Component } from 'react';
import Demo from './Demo';
import TemplateDemoControls, { demoOptions } from './TemplateDemoControls';

interface State {
  option: string;
}
class TemplateDemoWithControls extends Component<React.ComponentProps<typeof Demo>, State> {
  state: State = {
    option: 'Out of the box',
  };

  render() {
    return (
      <Demo
        key={this.state.option}
        noSpacing
        type='demoOnly'
        demoFixedHeight={500}
        demoScrollYOnClick
        {...demoOptions[this.state.option]}
        controls={project => (
          <TemplateDemoControls
            project={project}
            value={this.state.option}
            onChange={option => this.setState({ option })}
          />
        )}
        {...this.props}
      />
    );
  }
}

export default TemplateDemoWithControls;

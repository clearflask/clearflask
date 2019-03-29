import React, { Component } from 'react';
import * as ConfigEditor from '../configEditor';

interface Props {
  page:ConfigEditor.Page;
}

class Page extends Component<Props> {

  render() {
    const childProps = this.props.page.getChildren().props;

    return (
      <div>
        {childProps.map(childProp => (
          <div>
            {childProp.name || childProp.path.join('.')}
          </div>
        ))}
      </div>
    );
  }
}

export default Page;

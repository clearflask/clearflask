import React, { Component } from 'react';
import * as ConfigEditor from '../configEditor';


interface Props {
  editor:ConfigEditor.Editor;
}

export default class ConfigView extends Component<Props> {
  unsubscribe?:()=>void;

  componentDidMount() {
    this.unsubscribe = this.props.editor.subscribe(this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    return (
      <pre>
        {JSON.stringify(this.props.editor.getConfig(), null, 2)}
      </pre>
    )
  }
}

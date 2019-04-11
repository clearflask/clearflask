import React, { Component } from 'react';
import * as ConfigEditor from '../configEditor';


interface Props {
  editor:ConfigEditor.Editor|undefined;
}

export default class ConfigView extends Component<Props> {
  unsubscribe?:()=>void;

  componentDidMount() {
    this.unsubscribe = this.props.editor && this.props.editor.subscribe(this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    if(this.unsubscribe === undefined && this.props.editor !== undefined) {
      this.unsubscribe = this.props.editor.subscribe(this.forceUpdate.bind(this));
    }
    return (
      <pre>
        {JSON.stringify(this.props.editor && this.props.editor.getConfig(), null, 2)}
      </pre>
    )
  }
}

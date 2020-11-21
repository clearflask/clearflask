import React from 'react';

interface Props {
  iAgreeInputIsSanitized: true;
  html: string;
}
class RichViewer extends React.Component<Props> {
  render() {
    return (
      <div dangerouslySetInnerHTML={{ __html: this.props.html }} />
    );
  }
}

export default RichViewer;

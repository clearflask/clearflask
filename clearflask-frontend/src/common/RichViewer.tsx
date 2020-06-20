import { convertFromRaw, EditorState } from 'draft-js';
import 'draft-js/dist/Draft.css';
import React from 'react';
import ErrorMsg from '../app/ErrorMsg';
import StyledDraftJsEditor from './StyledDraftJsEditor';

interface Props {
  raw: string;
}
class RichViewer extends React.Component<Props> {
  render() {
    var recoveredEditorState: EditorState | undefined = undefined;
    try {
      recoveredEditorState = EditorState.createWithContent(convertFromRaw(JSON.parse(this.props.raw)));
    } catch (er) {
      console.log('ERROR: Corrupted content: ', this.props.raw, er);
      return (
        <ErrorMsg msg='Failed to display corrupted data' />
      );
    }

    return (
      <StyledDraftJsEditor
        editorState={recoveredEditorState}
        onChange={() => { }}
        readOnly
      />
    );
  }
}

export default RichViewer;

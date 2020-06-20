import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { convertFromRaw, Editor, EditorState } from 'draft-js';
import 'draft-js/dist/Draft.css';
import React from 'react';
import ErrorMsg from '../app/ErrorMsg';

const styles = (theme: Theme) => createStyles({
});
interface Props {
  raw: string;
}
class RichViewer extends React.Component<Props & WithStyles<typeof styles, true>> {
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
      <Editor
        editorState={recoveredEditorState}
        onChange={() => { }}
        readOnly
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(RichViewer);

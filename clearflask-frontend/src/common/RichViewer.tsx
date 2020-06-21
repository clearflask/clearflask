import { convertFromRaw, EditorState } from 'draft-js';
import 'draft-js/dist/Draft.css';
import { filterEditorState } from "draftjs-filters";
import React from 'react';
import ErrorMsg from '../app/ErrorMsg';
import StyledDraftJsEditor from './StyledDraftJsEditor';

// Docs: https://github.com/thibaudcolas/draftjs-filters
interface DraftjsFilterConfig {
  // Whitelist of allowed block types. unstyled and atomic are always included.
  blocks: Array<string>;
  // Whitelist of allowed inline styles.
  styles: Array<string>;
  // Whitelist of allowed entities.
  entities: Array<{
    // Entity type, eg. "LINK"
    type: string;
    // Allowed attributes. Other attributes will be removed. If this is omitted, all attributes are kept.
    attributes?: Array<string>;
    // Refine which entities are kept by whitelisting acceptable values with regular expression patterns.
    // It's also possible to use "true" to signify that a field is required to be present,
    // and "false" for fields required to be absent.
    // If this is omitted, all entities are kept.
    whitelist?: {
      [attribute: string]: string | boolean,
    };
  }>;
  // Maximum amount of depth for lists (0 = no nesting).
  maxNesting: number;
  // Characters to replace with whitespace.
  whitespacedCharacters: Array<string>;
  // Optional: Rules used to automatically convert blocks from one type to another
  // based on the block’s text. Also supports setting the block depth.
  // Defaults to the filters’ built-in block prefix rules.
  blockTextRules?: Array<{
    // A regex as a string, to match against block text, e.g. "^(◦|o |o\t)".
    test: string;
    // The type to convert the block to if the test regex matches.
    type: string;
    // The depth to set (e.g. for list items with different prefixes per depth).
    depth: number;
  }>;
}
export const filteringEnabled = true;
export const draftjsFilterConfig: DraftjsFilterConfig = {
  blocks: ['blockquote', 'code-block', 'ordered-list-item', 'unordered-list-item'],
  styles: ['BOLD', 'ITALIC', 'STRIKETHROUGH', 'UNDERLINE', 'CODE'],
  entities: [],
  maxNesting: 0,
  whitespacedCharacters: [],
};
interface Props {
  initialRaw: string;
}
interface State {
  editorState?: EditorState;
}
class RichViewer extends React.Component<Props, State> {

  constructor(props: Props) {
    super(props);

    var recoveredEditorState: EditorState | undefined = undefined;
    try {
      const contentState = convertFromRaw(JSON.parse(props.initialRaw));
      recoveredEditorState = EditorState.createWithContent(contentState);
      if (filteringEnabled) {
        recoveredEditorState = filterEditorState(draftjsFilterConfig, recoveredEditorState) as EditorState;
      }
    } catch (er) {
      console.log('ERROR: Cannot parse content:', props.initialRaw, er);
    }

    this.state = {
      editorState: recoveredEditorState,
    };
  }

  render() {
    if (!this.state.editorState) {
      return (
        <ErrorMsg msg='Failed to display corrupted data' />
      );
    }

    return (
      <StyledDraftJsEditor
        readOnly
        editorState={this.state.editorState}
        onChange={newEditorState => {
          var currentContent = newEditorState.getCurrentContent();

          if (filteringEnabled
            && currentContent !== this.state.editorState?.getCurrentContent()
            && newEditorState.getLastChangeType() === "insert-fragment") {
            newEditorState = filterEditorState(draftjsFilterConfig, newEditorState) as EditorState;
          }
          this.setState({ editorState: newEditorState });
        }}
      />
    );
  }
}

export default RichViewer;

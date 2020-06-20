import { Collapse, IconButton, InputProps, StandardTextFieldProps, TextField } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import CodeIcon from "@material-ui/icons/Code";
import BoldIcon from "@material-ui/icons/FormatBold";
import ItalicIcon from "@material-ui/icons/FormatItalic";
import ListUnorderedIcon from "@material-ui/icons/FormatListBulleted";
import ListOrderedIcon from "@material-ui/icons/FormatListNumbered";
import QuoteIcon from "@material-ui/icons/FormatQuote";
import StrikethroughIcon from "@material-ui/icons/FormatStrikethrough";
import UnderlineIcon from "@material-ui/icons/FormatUnderlined";
import { convertFromRaw, convertToRaw, Editor, EditorState, RichUtils } from 'draft-js';
import 'draft-js/dist/Draft.css';
import { withSnackbar, WithSnackbarProps } from 'notistack';
import React from 'react';
import StyledDraftJsEditor from './StyledDraftJsEditor';

const styles = (theme: Theme) => createStyles({
  textField: {
    '& .DraftEditor-root': {
      width: '100%',
      padding: '6px 0 7px',
    },
    '& .public-DraftEditorPlaceholder-root': {
      opacity: 0,
      color: theme.palette.text.hint,
    },
    '& .public-DraftEditorPlaceholder-hasFocus': {
      opacity: 1,
    },
  },
});
class RichEditor extends React.Component<StandardTextFieldProps & WithStyles<typeof styles, true> & WithSnackbarProps> {
  render() {
    return (
      <TextField
        className={this.props.classes.textField}
        {...this.props}
        InputProps={{
          ...this.props.InputProps || {},
          inputComponent: RichEditorInputRefWrap as any,
          inputProps: {
            classes: this.props.classes,
            theme: this.props.theme,
            enqueueSnackbar: this.props.enqueueSnackbar,
            closeSnackbar: this.props.closeSnackbar,
            ...this.props.InputProps?.inputProps || {},
          },
        }}
      />
    );
  }
}

interface PropsInputRef {
  focus(): void;
  blur(): void;
  value?: string;
}
interface PropsRichEditorInputRefWrap extends PropsDraftJs {
  /** Required by TextField */
  inputRef?: React.Ref<PropsInputRef>;
}
class RichEditorInputRefWrap extends React.Component<PropsRichEditorInputRefWrap & WithStyles<typeof styles, true> & WithSnackbarProps> {
  render() {
    return (
      <RichEditorDraftJs
        ref={this.props.inputRef as any}
        {...this.props}
      />
    );
  }
}

interface PropsDraftJs extends Omit<InputProps, 'onChange'> {
  onChange?: (e) => void;
}
interface StateDraftJs {
  editorState: EditorState;
  isFocused?: boolean;
}
class RichEditorDraftJs extends React.Component<PropsDraftJs & WithStyles<typeof styles, true> & WithSnackbarProps, StateDraftJs> implements PropsInputRef {
  readonly editorRef: React.RefObject<Editor> = React.createRef();
  value?: string;

  constructor(props) {
    super(props);

    this.value = props.value || props.defaultValue;

    var recoveredEditorState: EditorState | undefined = undefined;
    if (this.value !== undefined) {
      try {
        recoveredEditorState = EditorState.createWithContent(convertFromRaw(JSON.parse(this.value)));
      } catch (er) {
        props.enqueueSnackbar('Some content is corrupted and could not be displayed', {
          variant: 'warning',
          preventDuplicate: true,
        });
        console.log('ERROR: Cannot parse content:', props.defaultValue, er);
      }
    }

    this.state = {
      editorState: recoveredEditorState || EditorState.createEmpty(),
    };
  }

  focus(): void {
    this.editorRef.current?.focus();
  }

  blur(): void {
    this.editorRef.current?.blur();
  }

  render() {
    const { onChange, ...otherInputProps } = this.props;
    const curStyle = this.state.editorState.getCurrentInlineStyle();
    const selection = this.state.editorState.getSelection();
    const blockType = this.state.editorState.getCurrentContent().getBlockForKey(selection.getStartKey()).getType();
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        width: '100%',
      }}>
        <StyledDraftJsEditor
          {...otherInputProps as any}
          editorRef={this.editorRef}
          editorState={this.state.editorState}
          onChange={newEditorState => {
            const currentContent = newEditorState.getCurrentContent();
            if (currentContent.hasText()) {
              this.value = JSON.stringify(convertToRaw(newEditorState.getCurrentContent()));
            } else {
              this.value = undefined;
            }
            this.setState({ editorState: newEditorState });
            onChange && onChange({ target: { value: this.value } });
          }}
          onFocus={e => {
            otherInputProps.onFocus && otherInputProps.onFocus(e as any);
            this.setState({ isFocused: true });
          }}
          onBlur={e => {
            otherInputProps.onBlur && otherInputProps.onBlur(e as any);
            this.setState({ isFocused: undefined });
          }}
          handleKeyCommand={(command, editorState) => {
            const newEditorState = RichUtils.handleKeyCommand(editorState, command);
            if (newEditorState) {
              this.setState({ editorState: newEditorState });
              return 'handled';
            }

            return 'not-handled';
          }}
        />
        <Collapse in={this.state.isFocused || this.state.editorState.getCurrentContent().hasText()}>
          <div>
            <IconButton size='small' onMouseDown={e => e.preventDefault()} onClick={e => this.toggleInlineStyle(e, 'BOLD')}>
              <BoldIcon color={curStyle.contains('BOLD') ? 'primary' : undefined} fontSize='inherit' />
            </IconButton>
            <IconButton size='small' onMouseDown={e => e.preventDefault()} onClick={e => this.toggleInlineStyle(e, 'ITALIC')}>
              <ItalicIcon color={curStyle.contains('ITALIC') ? 'primary' : undefined} fontSize='inherit' />
            </IconButton>
            <IconButton size='small' onMouseDown={e => e.preventDefault()} onClick={e => this.toggleInlineStyle(e, 'STRIKETHROUGH')}>
              <StrikethroughIcon color={curStyle.contains('STRIKETHROUGH') ? 'primary' : undefined} fontSize='inherit' />
            </IconButton>
            <IconButton size='small' onMouseDown={e => e.preventDefault()} onClick={e => this.toggleInlineStyle(e, 'UNDERLINE')}>
              <UnderlineIcon color={curStyle.contains('UNDERLINE') ? 'primary' : undefined} fontSize='inherit' />
            </IconButton>
            <IconButton size='small' onMouseDown={e => e.preventDefault()} onClick={e => this.toggleBlockType(e, 'blockquote')}>
              <QuoteIcon color={blockType === 'blockquote' ? 'primary' : undefined} fontSize='inherit' />
            </IconButton>
            <IconButton size='small' onMouseDown={e => e.preventDefault()} onClick={e => this.toggleCode(e)}>
              <CodeIcon color={(curStyle.contains('CODE') || blockType === 'codeblock') ? 'primary' : undefined} fontSize='inherit' />
            </IconButton>
            <IconButton size='small' onMouseDown={e => e.preventDefault()} onClick={e => this.toggleBlockType(e, 'ordered-list-item')}>
              <ListOrderedIcon color={blockType === 'ordered-list-item' ? 'primary' : undefined} fontSize='inherit' />
            </IconButton>
            <IconButton size='small' onMouseDown={e => e.preventDefault()} onClick={e => this.toggleBlockType(e, 'unordered-list-item')}>
              <ListUnorderedIcon color={blockType === 'unordered-list-item' ? 'primary' : undefined} fontSize='inherit' />
            </IconButton>
            {/* <IconButton size='small' onMouseDown={e => e.preventDefault()} onClick={e => this.toggleCode(e, 'LINK')}>
              <LinkIcon color={curStyle.contains('LINK') ? 'primary' : undefined} fontSize='inherit' />
            </IconButton> */}
          </div>
        </Collapse>
      </div>
    );
  }

  toggleInlineStyle(e, style: string) {
    this.setState({ editorState: RichUtils.toggleInlineStyle(this.state.editorState, style) });
    e.preventDefault();
  }

  toggleBlockType(e, block: string) {
    this.setState({ editorState: RichUtils.toggleBlockType(this.state.editorState, block) });
    e.preventDefault();
  }

  toggleCode(e) {
    // Clear all style since markdown doesn't support styling within code block
    this.setState({ editorState: RichUtils.toggleCode(this.state.editorState) });
    e.preventDefault();
  }

  toggleLink(e, link: string | null) {
    this.setState({ editorState: RichUtils.toggleLink(this.state.editorState, this.state.editorState.getSelection(), link) });
    e.preventDefault();
  }
}

export default withSnackbar(withStyles(styles, { withTheme: true })(RichEditor));

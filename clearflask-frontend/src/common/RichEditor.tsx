import { Collapse, InputProps, TextField } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import CodeIcon from "@material-ui/icons/Code";
import BoldIcon from "@material-ui/icons/FormatBold";
import ItalicIcon from "@material-ui/icons/FormatItalic";
import ListUnorderedIcon from "@material-ui/icons/FormatListBulleted";
import ListOrderedIcon from "@material-ui/icons/FormatListNumbered";
import QuoteIcon from "@material-ui/icons/FormatQuote";
import StrikethroughIcon from "@material-ui/icons/FormatStrikethrough";
import UnderlineIcon from "@material-ui/icons/FormatUnderlined";
import { ToggleButton, ToggleButtonGroup } from '@material-ui/lab';
import { withSnackbar, WithSnackbarProps } from 'notistack';
import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const styles = (theme: Theme) => createStyles({
  textField: {
    '& .DraftEditor-root': {
      width: '100%',
      padding: '6px 0 7px',
    },
    '& .public-DraftEditorPlaceholder-root': {
      opacity: 0,
      color: theme.palette.text.secondary,
    },
    '& .public-DraftEditorPlaceholder-hasFocus': {
      opacity: 1,
    },
  },
  toggleButton: {
    height: 'initial',
    padding: theme.spacing(0.5),
  },
  toggleButtonGroups: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  toggleButtonGroup: {
    margin: theme.spacing(1, 0.25, 0.5),
  },
});
interface PropsRichEditor {
  iAgreeInputIsSanitized: true;
  value: never;
}
interface StateRichEditor {
  shrink?: boolean;
}
class RichEditor extends React.Component<Omit<PropsRichEditor & React.ComponentProps<typeof TextField>, 'value'> & WithStyles<typeof styles, true> & WithSnackbarProps, StateRichEditor> {
  constructor(props) {
    super(props);

    this.state = {
      shrink: (props.defaultValue !== undefined && props.defaultValue !== ''),
    };
  }

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
        onChange={e => {
          const shrink = (e.target.value !== undefined && e.target.value !== '') ? true : undefined;
          if (this.state.shrink !== shrink) {
            this.setState({ shrink: shrink });
          }
          this.props.onChange && this.props.onChange(e);
        }}
        InputLabelProps={{
          shrink: this.state.shrink,
          ...this.props.InputLabelProps || {},
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
interface PropsRichEditorInputRefWrap extends PropsQuill {
  /** Required by TextField */
  inputRef?: React.Ref<PropsInputRef>;
}
class RichEditorInputRefWrap extends React.Component<PropsRichEditorInputRefWrap & WithStyles<typeof styles, true> & WithSnackbarProps> {
  render() {
    return (
      <RichEditorQuill
        ref={this.props.inputRef as any}
        {...this.props}
      />
    );
  }
}

interface PropsQuill extends Omit<InputProps, 'onChange'> {
  onChange?: (e) => void;
}
interface StateQuill {
  isFocused?: boolean;
}
class RichEditorQuill extends React.Component<PropsQuill & WithStyles<typeof styles, true> & WithSnackbarProps, StateQuill> implements PropsInputRef {
  readonly editorRef: React.RefObject<Editor> = React.createRef();

  focus(): void {
    this.editorRef.current?.focus();
  }

  blur(): void {
    this.editorRef.current?.blur();
  }

  render() {
    const { onChange, ...otherInputProps } = this.props;
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        width: '100%',
      }}>
        <ReactQuill
          {...otherInputProps as any}
          editorRef={this.editorRef}
          editorState={this.state.editorState}
          onChange={this.handleOnChange.bind(this)}
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
              this.handleOnChange(newEditorState);
              return 'handled';
            }

            return 'not-handled';
          }}
        />
        <Collapse in={this.state.isFocused}>
          <div className={this.props.classes.toggleButtonGroups}>
            <ToggleButtonGroup className={this.props.classes.toggleButtonGroup}>
              {this.renderToggleButton(BoldIcon, curStyle.contains('BOLD'), e => this.toggleInlineStyle(e, 'BOLD'))}
              {this.renderToggleButton(ItalicIcon, curStyle.contains('ITALIC'), e => this.toggleInlineStyle(e, 'ITALIC'))}
              {this.renderToggleButton(StrikethroughIcon, curStyle.contains('STRIKETHROUGH'), e => this.toggleInlineStyle(e, 'STRIKETHROUGH'))}
              {this.renderToggleButton(UnderlineIcon, curStyle.contains('UNDERLINE'), e => this.toggleInlineStyle(e, 'UNDERLINE'))}
            </ToggleButtonGroup>
            <ToggleButtonGroup className={this.props.classes.toggleButtonGroup}>
              {this.renderToggleButton(QuoteIcon, blockType === 'blockquote', e => this.toggleBlockType(e, 'blockquote'))}
              {this.renderToggleButton(CodeIcon, curStyle.contains('CODE') || blockType === 'code-block', e => this.toggleCode(e))}
              {this.renderToggleButton(ListOrderedIcon, blockType === 'ordered-list-item', e => this.toggleBlockType(e, 'ordered-list-item'))}
              {this.renderToggleButton(ListUnorderedIcon, blockType === 'unordered-list-item', e => this.toggleBlockType(e, 'unordered-list-item'))}
            </ToggleButtonGroup>
          </div>
        </Collapse>
      </div>
    );
  }

  renderToggleButton(IconCmpt, checked: boolean, toggle: (event) => void) {
    return (
      <ToggleButton
        className={this.props.classes.toggleButton}
        value='check'
        selected={checked}
        onMouseDown={e => e.preventDefault()}
        onChange={e => toggle(e)}
        onClick={e => toggle(e)}
      >
        <IconCmpt fontSize='inherit' />
      </ToggleButton>
    );
  }

  toggleInlineStyle(e, style: string) {
    this.handleOnChange(RichUtils.toggleInlineStyle(this.state.editorState, style));
    e.preventDefault();
  }

  toggleBlockType(e, block: string) {
    this.handleOnChange(RichUtils.toggleBlockType(this.state.editorState, block));
    e.preventDefault();
  }

  toggleCode(e) {
    // Clear all style since markdown doesn't support styling within code block
    this.handleOnChange(RichUtils.toggleCode(this.state.editorState));
    e.preventDefault();
  }

  handleOnChange(newEditorState) {
    var currentContent = newEditorState.getCurrentContent();

    if (filteringEnabled
      && currentContent !== this.state.editorState.getCurrentContent()
      && newEditorState.getLastChangeType() === "insert-fragment") {
      newEditorState = filterEditorState(draftjsFilterConfig, newEditorState) as EditorState;
    }

    const prevValue = this.state.value;
    var newValue: string | undefined;
    if (currentContent.hasText()) {
      newValue = JSON.stringify(convertToRaw(newEditorState.getCurrentContent()));
    } else {
      newValue = '';
    }
    this.setState({
      editorState: newEditorState,
      value: newValue,
    });
    if (prevValue !== newValue) {
      this.props.onChange && this.props.onChange({ target: { value: newValue } });
    }
  }
}

export default withSnackbar(withStyles(styles, { withTheme: true })(RichEditor));

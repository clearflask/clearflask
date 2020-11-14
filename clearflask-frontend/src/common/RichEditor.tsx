import { Collapse, InputProps, TextField, TextFieldProps } from '@material-ui/core';
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
import { convertFromRaw, convertToRaw, Editor, EditorState, RichUtils } from 'draft-js';
import 'draft-js/dist/Draft.css';
import { filterEditorState } from "draftjs-filters";
import { withSnackbar, WithSnackbarProps } from 'notistack';
import React from 'react';
import { draftjsFilterConfig, filteringEnabled } from './RichViewer';
import StyledDraftJsEditor from './StyledDraftJsEditor';

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
class RichEditor extends React.Component<TextFieldProps & WithStyles<typeof styles, true> & WithSnackbarProps> {
  render() {
    var shrink = (this.props.value !== undefined && this.props.value !== '') ? true : undefined;
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
        InputLabelProps={{
          shrink,
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
  value?: string;
  isFocused?: boolean;
  linkPopoverOpen?: boolean;
  linkName?: string;
  linkUrl?: string;
}
class RichEditorDraftJs extends React.Component<PropsDraftJs & WithStyles<typeof styles, true> & WithSnackbarProps, StateDraftJs> implements PropsInputRef {
  readonly editorRef: React.RefObject<Editor> = React.createRef();

  constructor(props) {
    super(props);

    const value = props.value || props.defaultValue;

    var recoveredEditorState: EditorState | undefined = undefined;
    if (value !== undefined) {
      try {
        recoveredEditorState = EditorState.createWithContent(convertFromRaw(JSON.parse(value)));
        if (filteringEnabled) {
          recoveredEditorState = filterEditorState(draftjsFilterConfig, recoveredEditorState) as EditorState;
        }
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
      value,
    };
  }

  focus(): void {
    this.editorRef.current?.focus();
  }

  blur(): void {
    this.editorRef.current?.blur();
  }

  static getDerivedStateFromProps(props: (PropsDraftJs & WithStyles<typeof styles, true> & WithSnackbarProps), state: StateDraftJs) {
    var stateValue;
    if (state.editorState.getCurrentContent().hasText()) {
      stateValue = JSON.stringify(convertToRaw(state.editorState.getCurrentContent()));
    } else {
      stateValue = undefined;
    }
    var propsValue = props.value || props.defaultValue;
    if (propsValue === stateValue) {
      return null;
    }

    return {
      editorState: propsValue === undefined
        ? EditorState.createEmpty()
        : EditorState.createWithContent(convertFromRaw(JSON.parse(propsValue as string))),
      value: propsValue,
    };
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

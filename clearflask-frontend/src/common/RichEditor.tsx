import { InputProps, TextField } from '@material-ui/core';
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
import Quill, { DeltaStatic, RangeStatic, Sources } from 'quill';
import React from 'react';
import ReactQuill, { UnprivilegedEditor } from 'react-quill';
import 'react-quill/dist/quill.core.css';

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
  variant: 'standard' | 'outlined' | 'filled';
  onChange?(event: { target: { value: string } }, delta: DeltaStatic, source: Sources, editor: UnprivilegedEditor): void;
  iAgreeInputIsSanitized: true;
  inputRef?: React.Ref<ReactQuill>;
}
interface StateRichEditor {
  hasText?: boolean;
  isFocused?: boolean;
}
class RichEditor extends React.Component<PropsRichEditor & Omit<React.ComponentProps<typeof TextField>, 'onChange' | 'inputRef'> & WithStyles<typeof styles, true> & WithSnackbarProps, StateRichEditor> {
  constructor(props) {
    super(props);

    this.state = {
      hasText: (props.defaultValue !== undefined && props.defaultValue !== ''),
    };
  }

  render() {
    return (
      <TextField
        className={this.props.classes.textField}
        {...this.props as any /** Weird issue with variant */}
        InputProps={{
          ...this.props.InputProps || {},
          inputComponent: RichEditorInputRefWrap as any,
          inputProps: {
            ...this.props.InputProps?.inputProps || {},
            classes: this.props.classes,
            theme: this.props.theme,
            enqueueSnackbar: this.props.enqueueSnackbar,
            closeSnackbar: this.props.closeSnackbar,
            onFocus: e => this.setState({ isFocused: true }),
            onBlur: e => this.setState({ isFocused: false }),
          },
        }}
        onChange={(e) => {
          // Unpack these from the event defined in PropsQuill
          const delta = e.target['delta'];
          const source = e.target['source'];
          const editor = e.target['editor'];

          const hasText = (e.target.value !== undefined && e.target.value !== '') ? true : undefined;
          if (this.state.hasText !== hasText) {
            this.setState({ hasText });
          }
          this.props.onChange && this.props.onChange(e, delta, source, editor);
        }}
        InputLabelProps={{
          shrink: this.state.hasText || this.state.isFocused || false,
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
interface PropsRichEditorInputRefWrap extends React.ComponentProps<typeof RichEditorQuill> {
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

interface PropsQuill {
  onChange?: (e: {
    target: {
      value: string;
      delta: DeltaStatic;
      source: Sources;
      editor: UnprivilegedEditor;
    }
  }) => void;
}
interface StateQuill {
  activeFormats?: string[];
}
class RichEditorQuill extends React.Component<PropsQuill & Omit<InputProps, 'onChange'> & WithStyles<typeof styles, true> & WithSnackbarProps, StateQuill> implements PropsInputRef {
  state: StateQuill = {};
  readonly editorRef: React.RefObject<ReactQuill> = React.createRef();

  focus(): void {
    this.editorRef.current?.focus();
  }

  blur(): void {
    this.editorRef.current?.blur();
  }

  componentDidMount() {
    const editor = this.editorRef.current!.getEditor();
    editor.on('editor-change', (type, range) => {
      if (type === 'selection-change') {
        this.updateFormats(editor, range);
      }
    });
    editor.on('scroll-optimize' as any, () => {
      const [range] = editor['selection'].getRange(); // quill.getSelection triggers update
      this.updateFormats(editor, range || undefined);
    });
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
          theme={false /** core theme */}
          ref={this.editorRef}
          onChange={this.handleOnChange.bind(this)}
        />
        <div className={this.props.classes.toggleButtonGroups}>
          <ToggleButtonGroup className={this.props.classes.toggleButtonGroup}>
            {this.renderToggleButton(BoldIcon, 'bold')}
            {this.renderToggleButton(ItalicIcon, 'italic')}
            {this.renderToggleButton(StrikethroughIcon, 'strike')}
            {this.renderToggleButton(UnderlineIcon, 'underline')}
          </ToggleButtonGroup>
          <ToggleButtonGroup className={this.props.classes.toggleButtonGroup}>
            {this.renderToggleButton(QuoteIcon, 'blockquote')}
            {this.renderToggleButton(CodeIcon, 'code')}
            {this.renderToggleButton(ListOrderedIcon, 'ordered-list-item')}
            {this.renderToggleButton(ListUnorderedIcon, 'unordered-list-item')}
          </ToggleButtonGroup>
        </div>
      </div>
    );
  }

  updateFormats(editor: Quill, range?: RangeStatic) {
    if (!range) {
      this.setState({ activeFormats: undefined });
    } else {
      const newActiveFormats = Object.keys(editor.getFormat(range));
      this.setState({ activeFormats: newActiveFormats });
    }
  }

  renderToggleButton(IconCmpt, format: string) {
    const isActive = this.state.activeFormats?.includes(format);
    return (
      <ToggleButton
        className={this.props.classes.toggleButton}
        value='check'
        selected={isActive}
        onMouseDown={e => e.preventDefault()}
        onChange={e => this.setFormat(e, format, !isActive)}
        onClick={e => this.setFormat(e, format, !isActive)}
      >
        <IconCmpt fontSize='inherit' />
      </ToggleButton>
    );
  }

  setFormat(e, format: string, val: boolean) {
    this.editorRef.current?.getEditor().format(format, val, 'user');
    e.preventDefault();
  }

  handleOnChange(value: string, delta: DeltaStatic, source: Sources, editor: UnprivilegedEditor) {
    this.props.onChange && this.props.onChange({
      target: {
        value,
        delta,
        source,
        editor,
      }
    });
  }
}

export default withSnackbar(withStyles(styles, { withTheme: true })(RichEditor));

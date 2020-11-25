import { Button, InputProps, TextField } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import ListCheckIcon from "@material-ui/icons/CheckBox";
import CodeIcon from "@material-ui/icons/Code";
import BoldIcon from "@material-ui/icons/FormatBold";
import ItalicIcon from "@material-ui/icons/FormatItalic";
import ListUnorderedIcon from "@material-ui/icons/FormatListBulleted";
import ListOrderedIcon from "@material-ui/icons/FormatListNumbered";
import QuoteIcon from "@material-ui/icons/FormatQuote";
import StrikethroughIcon from "@material-ui/icons/FormatStrikethrough";
import UnderlineIcon from "@material-ui/icons/FormatUnderlined";
import LinkIcon from "@material-ui/icons/Link";
import MoreIcon from "@material-ui/icons/MoreHoriz";
import { withSnackbar, WithSnackbarProps } from 'notistack';
import Quill, { DeltaStatic, RangeStatic, Sources } from 'quill';
import React from 'react';
import ReactQuill, { UnprivilegedEditor } from 'react-quill';
import ClosablePopper from './ClosablePopper';
import { QuillViewStyle } from './RichViewer';

const styles = (theme: Theme) => createStyles({
  textField: {
  },
  toggleButton: {
    height: 'initial',
    padding: theme.spacing(0.5),
    border: 'none',
    minWidth: 'unset',
  },
  toggleButtonGroups: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  toggleButtonGroup: {
    margin: theme.spacing(1, 0.25, 0.5),
    display: 'flex',
    flexWrap: 'nowrap',
  },
  editLinkContainer: {
    margin: theme.spacing(1),
  },
  editLinkContent: {
    padding: theme.spacing(0.5, 1),
    display: 'flex',
    alignItems: 'baseline',
    '& a': {
      color: 'unset',
      borderBottom: '1px dashed',
      textDecoration: 'none',
      '&:hover': {
        borderBottomStyle: 'solid',
      },
    },
  },
  editLinkA: {
    margin: theme.spacing(0, 1),
  },
  editLinkButton: {
    padding: theme.spacing(0.5),
    border: 'none',
    minWidth: 'unset',
  },
  editLinkButtonLabel: {
    lineHeight: 'normal',
    textTransform: 'none',
  },
  editLinkUrlRoot: {
    margin: theme.spacing(0, 1),
  },
  editLinkUrlInput: {
    padding: theme.spacing(0.5),
    margin: theme.spacing(0, 0.5),
    width: 100,
  },
  editorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    width: '100%',
  },
  quill: {
    '& .ql-container .ql-clipboard': {
      left: -100000,
      height: 1,
      overflowY: 'hidden',
      position: 'absolute',
      top: '50%',
      '& p': {
        margin: '0',
        padding: '0',
      },
    },
    '& .ql-container': {
      boxSizing: 'border-box',
      height: '100%',
      width: '100%',
      margin: '0px',
      position: 'relative',
    },
    '& ul[data-checked=true], & ul[data-checked=false]': {
      pointerEvents: 'none'
    },
    '& ul[data-checked=true] > li *, & ul[data-checked=false] > li *': {
      pointerEvents: 'all'
    },
    '& ul[data-checked=true] > li::before, & ul[data-checked=false] > li::before': {
      cursor: 'pointer',
      pointerEvents: 'all'
    },
    '& .ql-container .ql-tooltip': { visibility: 'hidden' },
    '& .ql-container .ql-editor ul[data-checked] > li::before': {
      cursor: 'pointer',
      pointerEvents: 'all',
    },
    '& .ql-container.ql-disabled .ql-tooltip': { visibility: 'hidden' },
    '& .ql-container.ql-disabled .ql-editor ul[data-checked] > li::before': {
      cursor: 'unset',
      pointerEvents: 'none',
    },
    '& .ql-container .ql-editor': {
      cursor: 'text',
      paddingBottom: 1, // Compensate for link border-bottom, which otherwise overflows
      ...QuillViewStyle(theme),
    },
  },
});
interface PropsRichEditor {
  variant: 'standard' | 'outlined' | 'filled';
  onChange?(event: { target: { value: string } }, delta: DeltaStatic, source: Sources, editor: UnprivilegedEditor): void;
  iAgreeInputIsSanitized: true;
  inputRef?: React.Ref<ReactQuill>;
  /**
   * To add single-line support visit https://github.com/quilljs/quill/issues/1432
   * Be careful, when adding keyboard module, handlers somehow stop working.
   */
  multiline: true;
}
interface StateRichEditor {
  hasText?: boolean;
  isFocused?: boolean;
}
class RichEditor extends React.Component<PropsRichEditor & Omit<React.ComponentProps<typeof TextField>, 'onChange' | 'inputRef' | 'multiline'> & WithStyles<typeof styles, true> & WithSnackbarProps, StateRichEditor> {
  constructor(props) {
    super(props);

    this.state = {
      hasText: (props.defaultValue !== undefined && props.defaultValue !== ''),
    };
  }

  render() {
    const { onChange, theme, enqueueSnackbar, closeSnackbar, classes, iAgreeInputIsSanitized, ...TextFieldProps } = this.props;
    return (
      <TextField
        className={this.props.classes.textField}
        {...TextFieldProps as any /** Weird issue with variant */}
        InputProps={{
          ...this.props.InputProps || {},
          inputComponent: RichEditorInputRefWrap as any,
          inputProps: {
            ...this.props.InputProps?.inputProps || {},
            classes: this.props.classes,
            theme: theme,
            enqueueSnackbar: enqueueSnackbar,
            closeSnackbar: closeSnackbar,
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
  activeFormats?: { [key: string]: any };
  editLinkShow?: RangeStatic;
  editLinkEditing?: boolean;
  editLinkPrevValue?: string;
  editLinkValue?: string;
  showMoreFormatting?: boolean;
}
class RichEditorQuill extends React.Component<PropsQuill & Omit<InputProps, 'onChange'> & WithStyles<typeof styles, true> & WithSnackbarProps, StateQuill> implements PropsInputRef {
  state: StateQuill = {};
  readonly editorContainerRef: React.RefObject<HTMLDivElement> = React.createRef();
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
      const range = editor.getSelection();
      this.updateFormats(editor, range || undefined);
    });
  }

  render() {
    const { onChange, ...otherInputProps } = this.props;
    return (
      <div
        className={this.props.classes.editorContainer}
        ref={this.editorContainerRef}
      >
        <ReactQuill
          {...otherInputProps as any}
          className={this.props.classes.quill}
          theme={false /** core theme */}
          ref={this.editorRef}
          onChange={this.handleOnChange.bind(this)}
          formats={['bold', 'strike', 'list', 'link', 'italic', 'underline', 'blockquote', 'code-block', 'indent']}
        />
        <div className={this.props.classes.toggleButtonGroups}>
          <ClosablePopper
            open={!!this.state.showMoreFormatting}
            onClose={() => this.setState({ showMoreFormatting: false })}
            disableCloseButton
            clickAway
          >
            <div className={this.props.classes.toggleButtonGroup}>
              {this.renderToggleButton(BoldIcon, 'bold', undefined, true)}
              {this.renderToggleButton(StrikethroughIcon, 'strike', undefined, true)}
              {this.renderToggleButton(ListOrderedIcon, undefined, 'list', 'bullet')}
              {this.renderToggleButton(ListCheckIcon, undefined, 'list', 'unchecked', ['unchecked', 'checked'])}
              {this.renderToggleButtonLink(LinkIcon)}
            </div>
            <div className={this.props.classes.toggleButtonGroup}>
              {this.renderToggleButton(ItalicIcon, 'italic', undefined, true)}
              {this.renderToggleButton(UnderlineIcon, 'underline', undefined, true)}
              {this.renderToggleButton(ListUnorderedIcon, undefined, 'list', 'ordered')}
              {this.renderToggleButton(QuoteIcon, undefined, 'blockquote', true)}
              {this.renderToggleButton(CodeIcon, undefined, 'code-block', true)}
            </div>
          </ClosablePopper>
          <div className={this.props.classes.toggleButtonGroup}>
            {this.renderToggleButton(BoldIcon, 'bold', undefined, true)}
            {this.renderToggleButton(StrikethroughIcon, 'strike', undefined, true)}
            {this.renderToggleButton(ListOrderedIcon, undefined, 'list', 'bullet')}
            {this.renderToggleButton(ListCheckIcon, undefined, 'list', 'unchecked', ['unchecked', 'checked'])}
            {this.renderToggleButtonLink(LinkIcon)}
            {this.renderToggleButtonCmpt(MoreIcon, false, () => this.setState({ showMoreFormatting: !this.state.showMoreFormatting }))}
          </div>
        </div>
        {this.renderEditLinkPopper()}
      </div>
    );
  }

  renderEditLinkPopper() {
    const editor = this.editorRef.current?.getEditor();
    var anchorElGetter;
    if (this.state.editLinkShow && editor) {
      anchorElGetter = () => {
        const editorRect = this.editorContainerRef.current!.getBoundingClientRect();
        const selection = editor.getSelection();
        if (!selection) {
          return;
        }
        const bounds = { ...editor.getBounds(selection.index, selection.length) };
        return {
          height: bounds.height,
          width: bounds.width,
          bottom: editorRect.bottom - editorRect.height + bounds.bottom,
          left: editorRect.left + bounds.left,
          right: editorRect.right - editorRect.width + bounds.right,
          top: editorRect.top + bounds.top,
        }
      }
    }
    return (
      <ClosablePopper
        anchorElGetter={anchorElGetter}
        disableCloseButton
        arrow
        clickAway
        clickAwayProps={{
          onClickAway: () => {
            if (this.editorRef.current?.editor?.hasFocus()) return;
            this.setState({
              editLinkShow: undefined,
            });
          }
        }}
        placement='top-start'
        open={!!this.state.editLinkShow}
        onClose={() => this.setState({
          editLinkShow: undefined,
        })}
        className={this.props.classes.editLinkContainer}
        classes={{
          paper: this.props.classes.editLinkContent,
        }}
      >
        {(!this.state.editLinkPrevValue || this.state.editLinkEditing) ? (
          <React.Fragment>
            <div>Enter link:</div>
            <TextField
              variant='standard'
              size='small'
              margin='none'
              placeholder='https://'
              value={(this.state.editLinkValue === undefined
                ? this.state.editLinkPrevValue
                : this.state.editLinkValue) || ''}
              onChange={e => this.setState({ editLinkValue: e.target.value })}
              InputProps={{
                classes: {
                  input: this.props.classes.editLinkUrlInput,
                },
              }}
              classes={{
                root: this.props.classes.editLinkUrlRoot,
              }}
            />
            <Button
              size='small'
              color='primary'
              classes={{
                root: this.props.classes.editLinkButton,
                label: this.props.classes.editLinkButtonLabel
              }}
              disabled={!this.state.editLinkValue || this.state.editLinkValue === this.state.editLinkPrevValue}
              onClick={e => {
                if (!editor || !this.state.editLinkShow || !this.state.editLinkValue) return;
                editor.formatText(this.state.editLinkShow, { link: this.state.editLinkValue }, 'user');
                editor.setSelection(this.state.editLinkShow.index, this.state.editLinkShow.length, 'user');
                this.setState({
                  editLinkPrevValue: this.state.editLinkValue,
                  editLinkEditing: undefined,
                  editLinkValue: undefined,
                });
              }}
            >Save</Button>
            {(!!this.state.editLinkPrevValue) && (
              <Button
                size='small'
                color='primary'
                classes={{
                  root: this.props.classes.editLinkButton,
                  label: this.props.classes.editLinkButtonLabel
                }}
                onClick={e => {
                  if (!editor || !this.state.editLinkShow) return;
                  const editLinkShow = this.state.editLinkShow;
                  this.setState({
                    editLinkShow: undefined,
                  }, () => {
                    editor.formatText(editLinkShow, { link: undefined }, 'user');
                  });
                }}
              >Remove</Button>
            )}
          </React.Fragment>
        ) : (
            <React.Fragment>
              <div>Visit</div>
              <a
                href={this.state.editLinkPrevValue}
                className={this.props.classes.editLinkA}
                target="_blank"
                rel="noreferrer noopener ugc"
              >{this.state.editLinkPrevValue}</a>
              <Button
                size='small'
                color='primary'
                classes={{
                  root: this.props.classes.editLinkButton,
                  label: this.props.classes.editLinkButtonLabel
                }}
                onClick={e => {
                  this.setState({
                    editLinkEditing: true,
                  })
                }}
              >Edit</Button>
              <Button
                size='small'
                color='primary'
                classes={{
                  root: this.props.classes.editLinkButton,
                  label: this.props.classes.editLinkButtonLabel
                }}
                onClick={e => {
                  if (!editor || !this.state.editLinkShow) return;
                  const editLinkShow = this.state.editLinkShow;
                  this.setState({
                    editLinkShow: undefined,
                  }, () => {
                    editor.formatText(editLinkShow, { link: undefined }, 'user');
                  });
                }}
              >Remove</Button>
            </React.Fragment>
          )}

      </ClosablePopper >
    );
  }

  renderToggleButtonLink(IconCmpt) {
    const isActive = !!this.state.activeFormats?.link;
    return this.renderToggleButtonCmpt(
      IconCmpt,
      isActive,
      e => {
        const editor = this.editorRef.current?.getEditor();
        const selection = editor?.getSelection();
        if (!editor || !selection) return;
        const range = selection.length > 0
          ? selection
          : this.getWordBoundary(editor, selection.index);
        editor.setSelection(range, 'user');
        this.setState({
          editLinkShow: range,
          editLinkPrevValue: this.state.activeFormats?.link,
          editLinkEditing: true,
          editLinkValue: undefined,
        });
      })
  }

  updateFormats(editor: Quill, range?: RangeStatic) {
    if (!range) {
      if (!!this.state.editLinkShow && !this.state.editLinkEditing) {
        this.setState({
          activeFormats: undefined,
          editLinkShow: undefined,
        });
      } else {
        this.setState({ activeFormats: undefined });
      }
    } else {
      const newActiveFormats = editor.getFormat(range);
      const isLinkActive = !!newActiveFormats.link;
      if (isLinkActive !== !!this.state.editLinkShow) {
        var rangeWord: RangeStatic | undefined;
        const selection = editor.getSelection();
        if (!!selection) {
          rangeWord = selection.length > 0
            ? selection
            : this.getWordBoundary(editor, selection.index);
        }

        this.setState({
          activeFormats: newActiveFormats,
          ...((isLinkActive && !!rangeWord) ? {
            editLinkShow: rangeWord,
            editLinkPrevValue: newActiveFormats.link,
            editLinkEditing: undefined,
            editLinkValue: undefined,
          } : {
              editLinkShow: undefined,
            })
        });
      } else {
        this.setState({ activeFormats: newActiveFormats });
      }
    }
  }

  renderToggleButton(IconCmpt, format: string | undefined, formatLine: string | undefined, defaultValue: any, valueOpts: any[] = [defaultValue]) {
    const isActiveFormat = !!this.state.activeFormats && !!format && valueOpts.includes(this.state.activeFormats[format]);
    const isActiveFormatLine = !!this.state.activeFormats && !!formatLine && valueOpts.includes(this.state.activeFormats[formatLine]);
    const toggle = e => {
      const editor = this.editorRef.current?.getEditor();
      if (!editor) return;
      const range = editor.getSelection();
      const hasSelection = !!range && range.length > 0;
      // Use inline formatting if we have selected text or if there is no line formatting
      if (format && (!formatLine || hasSelection)) {
        if (hasSelection || !range) {
          editor.format(format, isActiveFormat ? undefined : defaultValue, 'user');
        } else {
          const wordBoundaryRange = this.getWordBoundary(editor, range.index);
          if (wordBoundaryRange.length > 0) {
            editor.formatText(wordBoundaryRange, { [format]: isActiveFormat ? undefined : defaultValue }, 'user');
          } else {
            editor.format(format, isActiveFormat ? undefined : defaultValue, 'user');
          }
        }
      } else if (!!formatLine) {
        editor.format(formatLine, isActiveFormatLine ? undefined : defaultValue, 'user');
      }
    };
    return this.renderToggleButtonCmpt(
      IconCmpt,
      isActiveFormat || isActiveFormatLine,
      toggle);
  }

  renderToggleButtonCmpt(IconCmpt, isActive, onClick) {
    const onChange = e => {
      onClick && onClick(e);
      e.preventDefault();
    };
    return (
      <Button
        className={this.props.classes.toggleButton}
        value='check'
        color={isActive ? 'primary' : 'inherit'}
        style={{ color: isActive ? undefined : this.props.theme.palette.text.hint }}
        onMouseDown={e => e.preventDefault()}
        onChange={onChange}
        onClick={onChange}
      >
        <IconCmpt fontSize='inherit' />
      </Button>
    );
  }

  getWordBoundary(editor: Quill, index: number): RangeStatic {
    const [line, offset] = editor.getLine(index);
    if (!line) return { index, length: 0 };
    const text = editor.getText(
      editor.getIndex(line),
      line.length());
    var boundaryIndex = index;
    for (var x = offset - 1; x >= 0; x--) {
      if (' \t\n\r\v'.indexOf(text[x]) > -1) {
        break;
      }
      boundaryIndex--;
    }
    var boundaryLength = index - boundaryIndex;
    for (var y = offset; y < text.length; y++) {
      if (' \t\n\r\v'.indexOf(text[y]) > -1) {
        break;
      }
      boundaryLength++;
    }
    return { index: boundaryIndex, length: boundaryLength };
  }

  handleOnChange(value: string, delta: DeltaStatic, source: Sources, editor: UnprivilegedEditor) {
    const isEmpty = editor.getLength() === 0;
    this.props.onChange && this.props.onChange({
      target: {
        value: isEmpty ? '' : value,
        delta,
        source,
        editor,
      }
    });
  }
}

export default withSnackbar(withStyles(styles, { withTheme: true })(RichEditor));

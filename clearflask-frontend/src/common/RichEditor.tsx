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
import { ToggleButton, ToggleButtonGroup } from '@material-ui/lab';
import { withSnackbar, WithSnackbarProps } from 'notistack';
import { ReferenceObject } from 'popper.js';
import Quill, { DeltaStatic, RangeStatic, Sources } from 'quill';
import React from 'react';
import ReactQuill, { UnprivilegedEditor } from 'react-quill';
import 'react-quill/dist/quill.core.css';
import ClosablePopper from './ClosablePopper';

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
    border: 'none',
  },
  toggleButtonGroups: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  toggleButtonGroup: {
    margin: theme.spacing(1, 0.25, 0.5),
  },
  editLinkContainer: {
    margin: theme.spacing(1),
  },
  editLinkContent: {
    padding: theme.spacing(0.5, 1),
    display: 'flex',
    alignItems: 'center',
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
  activeFormats?: { [key: string]: any };
  editLinkShow?: RangeStatic;
  editLinkEditing?: boolean;
  editLinkValue?: string;
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
          theme={false /** core theme */}
          ref={this.editorRef}
          onChange={this.handleOnChange.bind(this)}
        />
        <div className={this.props.classes.toggleButtonGroups}>
          <ToggleButtonGroup className={this.props.classes.toggleButtonGroup}>
            {this.renderToggleButton(BoldIcon, 'bold', undefined, true)}
            {this.renderToggleButton(ItalicIcon, 'italic', undefined, true)}
            {this.renderToggleButton(StrikethroughIcon, 'strike', undefined, true)}
            {this.renderToggleButton(UnderlineIcon, 'underline', undefined, true)}
            {this.renderToggleButtonLink(LinkIcon)}
          </ToggleButtonGroup>
          <ToggleButtonGroup className={this.props.classes.toggleButtonGroup}>
            {this.renderToggleButton(QuoteIcon, undefined, 'blockquote', true)}
            {this.renderToggleButton(CodeIcon, undefined, 'code-block', true)}
            {this.renderToggleButton(ListOrderedIcon, undefined, 'list', 'bullet')}
            {this.renderToggleButton(ListUnorderedIcon, undefined, 'list', 'ordered')}
            {this.renderToggleButton(ListCheckIcon, undefined, 'list', 'checked')}
          </ToggleButtonGroup>
        </div>
        {this.renderEditLinkPopper()}
      </div>
    );
  }

  renderEditLinkPopper() {
    const editor = this.editorRef.current?.getEditor();
    const url = this.state.activeFormats?.link;
    var anchorEl: ReferenceObject | null = null;
    if (this.state.editLinkShow) {
      const editorRect = this.editorContainerRef.current?.getBoundingClientRect();
      const selection = editor?.getSelection();
      console.log('debug', selection, editorRect);
      if (editorRect && editor && selection) {
        const bounds = { ...editor.getBounds(selection.index, selection.length) };
        anchorEl = {
          clientHeight: bounds.height,
          clientWidth: bounds.width,
          getBoundingClientRect: () => ({
            height: bounds.height,
            width: bounds.width,
            bottom: editorRect.bottom - editorRect.height + bounds.bottom,
            left: editorRect.left + bounds.left,
            right: editorRect.right - editorRect.width + bounds.right,
            top: editorRect.top + bounds.top,
          }),
        };
        console.log('debug', anchorEl, bounds, editorRect);
      }
    }
    return (
      <ClosablePopper
        anchorEl={anchorEl}
        disableCloseButton
        lightShadow
        placement='top'
        open={!!this.state.editLinkShow}
        onClose={() => this.setState({
          editLinkShow: undefined,
          editLinkEditing: undefined,
          editLinkValue: undefined,
        })}
        className={this.props.classes.editLinkContainer}
        classes={{
          paper: this.props.classes.editLinkContent,
        }}
      >
        {(!url || this.state.editLinkEditing) ? (
          <React.Fragment>
            <div>Enter link:</div>
            <TextField
              variant='outlined'
              size='small'
              margin='none'
              placeholder='https://'
              value={(this.state.editLinkValue === undefined ? url : this.state.editLinkValue) || ''}
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
              className={this.props.classes.editLinkButton}
              disabled={this.state.editLinkValue === undefined}
              onClick={e => {
                if (!editor || !this.state.editLinkShow || !this.state.editLinkValue) return;
                editor.formatText(this.state.editLinkShow, { link: this.state.editLinkValue }, 'user');
                editor.setSelection(this.state.editLinkShow.index, this.state.editLinkShow.length, 'api');
                this.setState({
                  editLinkEditing: undefined,
                  editLinkValue: undefined,
                });
              }}
            >Save</Button>
            <Button
              size='small'
              className={this.props.classes.editLinkButton}
              onClick={e => {
                this.setState({
                  editLinkShow: undefined,
                  editLinkEditing: undefined,
                  editLinkValue: undefined,
                })
              }}
            >Cancel</Button>
          </React.Fragment>
        ) : (
            <React.Fragment>
              <div>Visit</div>
              <a
                href={url}
                className={this.props.classes.editLinkA}
                target="_blank"
                rel="noreferrer noopener ugc"
              >{url}</a>
              <Button
                size='small'
                className={this.props.classes.editLinkButton}
                onClick={e => {
                  this.setState({
                    editLinkEditing: true,
                  })
                }}
              >Edit</Button>
              <Button
                size='small'
                className={this.props.classes.editLinkButton}
                onClick={e => {
                  if (!editor || !this.state.editLinkShow) return;
                  const editLinkShow = this.state.editLinkShow;
                  this.setState({
                    editLinkShow: undefined,
                    editLinkEditing: undefined,
                    editLinkValue: undefined,
                  }, () => {
                    editor.formatText(editLinkShow, { link: undefined }, 'user');
                  });
                }}
              >Remove</Button>
            </React.Fragment>
          )}

      </ClosablePopper>
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
          editLinkEditing: undefined,
          editLinkValue: undefined,
        });
      } else {
        this.setState({ activeFormats: undefined });
      }
    } else {
      const newActiveFormats = editor.getFormat(range);
      const isLinkActive = !!newActiveFormats.link;
      if (isLinkActive !== !!this.state.editLinkShow) {
        var range: RangeStatic | undefined;
        const selection = editor.getSelection();
        if (!!selection) {
          range = selection.length > 0
            ? selection
            : this.getWordBoundary(editor, selection.index);
        }

        this.setState({
          activeFormats: newActiveFormats,
          ...((isLinkActive && !!range) ? {
            editLinkShow: range,
            editLinkEditing: undefined,
            editLinkValue: undefined,
          } : {
              editLinkShow: undefined,
              editLinkEditing: undefined,
              editLinkValue: undefined,
            })
        });
      } else {
        this.setState({ activeFormats: newActiveFormats });
      }
    }
  }

  renderToggleButton(IconCmpt, format: string | undefined, formatLine: string | undefined, value) {
    const isActiveFormat = !!this.state.activeFormats && !!format && !!this.state.activeFormats[format];
    const isActiveFormatLine = !!this.state.activeFormats && !!formatLine && !!this.state.activeFormats[formatLine];
    const toggle = e => {
      const editor = this.editorRef.current?.getEditor();
      if (!editor) return;
      const range = editor.getSelection();
      const hasSelection = !!range && range.length > 0;
      // Use inline formatting if we have selected text or if there is no line formatting
      if (format && (!formatLine || hasSelection)) {
        if (hasSelection || !range) {
          editor.format(format, isActiveFormat ? undefined : value, 'user');
        } else {
          const wordBoundaryRange = this.getWordBoundary(editor, range.index);
          if (wordBoundaryRange.length > 0) {
            editor.formatText(wordBoundaryRange, { [format]: isActiveFormat ? undefined : value }, 'user');
          } else {
            editor.format(format, isActiveFormat ? undefined : value, 'user');
          }
        }
      } else if (!!formatLine) {
        const range = editor.getSelection();
        if (!range) return;
        editor.formatLine(range.index, range.length, formatLine, isActiveFormatLine ? undefined : value, 'user');
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
      <ToggleButton
        className={this.props.classes.toggleButton}
        value='check'
        selected={isActive}
        onMouseDown={e => e.preventDefault()}
        onChange={onChange}
        onClick={onChange}
      >
        <IconCmpt fontSize='inherit' />
      </ToggleButton>
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

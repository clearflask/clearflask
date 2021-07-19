import { Button, Collapse, Fade, InputProps, TextField } from '@material-ui/core';
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
import ImageIcon from "@material-ui/icons/Image";
import LinkIcon from "@material-ui/icons/Link";
import MoreIcon from "@material-ui/icons/MoreHoriz";
import classNames from 'classnames';
import { withSnackbar, WithSnackbarProps } from 'notistack';
import Quill, { DeltaStatic, RangeStatic, Sources } from 'quill';
import Delta from "quill-delta";
import ImageResize from 'quill-image-resize';
import React from 'react';
import Dropzone, { DropzoneRef } from 'react-dropzone';
import ReactQuill, { UnprivilegedEditor } from 'react-quill';
import ClosablePopper from './ClosablePopper';
import Heading2Icon from './icon/Heading2Icon';
import Heading3Icon from './icon/Heading3Icon';
import Heading4Icon from './icon/Heading4Icon';
import QuillBlockExtended from './quill-format-block';
import QuillFormatLinkExtended, { sanitize } from './quill-format-link';
import ToolbarExtended from './quill-image-resize-toolbar';
import { QuillViewStyle } from './RichViewer';
import debounce from './util/debounce';
import { dataImageToBlob } from './util/imageUtil';

Quill.register('modules/imageResize', ImageResize, true);
Quill.register('formats/link', QuillFormatLinkExtended, true);
Quill.register('blots/block', QuillBlockExtended, true);

const WhitespaceChars = ' \t\n\r\v';

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
    alignSelf: 'flex-end',
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  toggleButtonGroup: {
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
    },
    '& .ql-container': {
      boxSizing: 'border-box',
      height: '100%',
      width: '100%',
      margin: '0px',
      position: 'relative',
      minHeight: (props: PropsRichEditor) => props.minInputHeight,
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
    '& .ql-container .ql-editor.ql-blank::before': {
      opacity: 0.42,
      transition: theme.transitions.create('opacity'),
      color: 'currentColor',
      content: 'attr(data-placeholder)',
      position: 'absolute',
      '&.ql-direction-rtl': {
        left: '15px',
      },
      '&:not(.ql-direction-rtl)': {
        right: '15px',
      },
    },
    '&.hidePlaceholder .ql-container .ql-editor.ql-blank::before': {
      opacity: 0,
    },
    '& .ql-container .ql-editor': {
      cursor: 'text',
      ...QuillViewStyle(theme),
    },
  },
});
interface PropsRichEditor {
  variant: 'standard' | 'outlined' | 'filled';
  uploadImage: (file: Blob) => Promise<string>,
  onChange?(event: { target: { value: string } }, delta: DeltaStatic, source: Sources, editor: UnprivilegedEditor): void;
  iAgreeInputIsSanitized: true;
  inputRef?: React.Ref<ReactQuill>;
  showControlsImmediately?: boolean;
  minInputHeight?: string | number;
  autoFocusAndSelect?: boolean;
  component?: React.ElementType<React.ComponentProps<typeof TextField>>;
}
interface StateRichEditor {
  hasText?: boolean;
  isFocused?: boolean;
}
class RichEditor extends React.Component<PropsRichEditor & Omit<React.ComponentProps<typeof TextField>, 'onChange' | 'inputRef'> & WithStyles<typeof styles, true> & WithSnackbarProps, StateRichEditor> {
  constructor(props) {
    super(props);

    this.state = {
      hasText: (props.defaultValue !== undefined && props.defaultValue !== '')
        || (props.value !== undefined && props.value !== ''),
    };
  }

  render() {
    const { onChange, theme, enqueueSnackbar, closeSnackbar, classes, iAgreeInputIsSanitized, component, ...TextFieldProps } = this.props;

    /**
     * To add single-line support visit https://github.com/quilljs/quill/issues/1432
     * Be careful, when adding keyboard module, handlers somehow stop working.
     */
    if (!TextFieldProps.multiline) {
      throw new Error('RichEditor only supports multiline');
    }

    const shrink = this.state.hasText || this.state.isFocused || false;
    const TextFieldCmpt = component || TextField;
    return (
      <TextFieldCmpt
        className={this.props.classes.textField}
        {...TextFieldProps as any /** Weird issue with variant */}
        InputProps={{
          ...this.props.InputProps || {},
          inputComponent: RichEditorInputRefWrap,
          inputProps: {
            // Anything here will be passed along to RichEditorQuill below
            ...this.props.InputProps?.inputProps || {},
            autoFocusAndSelect: this.props.autoFocusAndSelect,
            uploadImage: this.props.uploadImage,
            classes: this.props.classes,
            theme: theme,
            hidePlaceholder: !shrink && !!this.props.label,
            showControlsImmediately: this.props.showControlsImmediately,
            enqueueSnackbar: enqueueSnackbar,
            closeSnackbar: closeSnackbar,
            onFocus: e => {
              this.setState({ isFocused: true });
              this.props.InputProps?.onFocus?.(e);
            },
            onBlur: e => {
              this.setState({ isFocused: false });
              this.props.InputProps?.onBlur?.(e);
            },
          },
        }}
        onChange={(e) => {
          // Unpack these from the event defined in PropsQuill
          const delta = e.target['delta'];
          const source = e.target['source'];
          const editor = e.target['editor'];

          const hasText = editor.getLength() > 0 ? true : undefined;
          this.props.onChange && this.props.onChange(e, delta, source, editor);
          if (!!this.state.hasText !== !!hasText) {
            this.setState({ hasText });
          }
        }}
        InputLabelProps={{
          shrink,
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
  uploadImage: (file: Blob) => Promise<string>,
  onChange?: (event: {
    target: {
      value: string;
      delta: DeltaStatic;
      source: Sources;
      editor: UnprivilegedEditor;
    }
  }) => void;
  onFocus?: (event: {
    editor: Quill;
    stopPropagation: () => void; // Dummy method to satisfy TextField
  }) => void;
  onBlur?: (event: {
    editor: Quill;
    stopPropagation: () => void; // Dummy method to satisfy TextField
  }) => void;
  hidePlaceholder?: boolean;
  showControlsImmediately?: boolean;
  autoFocus?: boolean;
  autoFocusAndSelect?: boolean;
}
interface StateQuill {
  activeFormats?: { [key: string]: any };
  editLinkShow?: RangeStatic;
  editLinkEditing?: boolean;
  editLinkPrevValue?: string;
  editLinkError?: boolean;
  editLinkValue?: string;
  showFormats: boolean;
  showFormatsExtended: boolean;
}
class RichEditorQuill extends React.Component<PropsQuill & Omit<InputProps, 'onChange'> & WithStyles<typeof styles, true> & WithSnackbarProps, StateQuill> implements PropsInputRef {
  readonly editorContainerRef: React.RefObject<HTMLDivElement> = React.createRef();
  readonly editorRef: React.RefObject<ReactQuill> = React.createRef();
  readonly dropzoneRef: React.RefObject<DropzoneRef> = React.createRef();
  inputIsFocused: boolean = false;
  isFocused: boolean = false;
  handleFocusBlurDebounced: () => void;

  constructor(props) {
    super(props);

    this.state = {
      showFormats: !!props.showControlsImmediately,
      showFormatsExtended: !!props.showControlsImmediately,
    };

    this.handleFocusBlurDebounced = debounce(() => this.handleFocusBlur(), 100);
  }

  /**
   * Focus and Blur events are tricky in Quill.
   * 
   * See:
   * - https://github.com/quilljs/quill/issues/1680
   * - https://github.com/zenoamaro/react-quill/issues/276
   * 
   * The solution attempts to solve these things:
   * - Focus detection using Quill editor selection AND input selection
   * - Spurious blur/focus flapping during clipboard paste
   * - Spurious blur/focus flapping when link popper open and click into quill editor but not textarea directly
   * - Keep focused during link popper changing
   * 
   * Outstanding issues:
   * - On clipboard paste, editor intermittently loses focus. This is mitigated with a debounce,
   *   but issue still occurrs occassionally if you continuously paste.
   */
  handleFocusBlur() {
    const editor = this.editorRef.current?.getEditor();
    if (!editor) return;
    const inputHasFocus = !!this.inputIsFocused;
    const editorHasSelection = !!editor.getSelection();
    const linkChangeHasFocus = !!this.state.editLinkShow;
    const hasFocus = inputHasFocus || editorHasSelection || linkChangeHasFocus;
    if (!this.isFocused && hasFocus) {
      this.isFocused = true;
      if (!this.state.showFormats) {
        this.setState({ showFormats: true });
      }
      this.props.onFocus?.({
        editor,
        stopPropagation: () => { },
      });
    } else if (this.isFocused && !hasFocus) {
      this.isFocused = false;
      this.props.onBlur?.({
        editor,
        stopPropagation: () => { },
      });
    }
  }

  focus(): void {
    this.editorRef.current?.focus();
  }

  blur(): void {
    this.editorRef.current?.blur();
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (this.state.editLinkShow !== prevState.editLinkShow) {
      this.handleFocusBlurDebounced();
    }
  }

  componentDidMount() {
    const editor = this.editorRef.current!.getEditor();

    editor.root.addEventListener('focus', e => {
      this.inputIsFocused = true;
      this.handleFocusBlurDebounced();
    });
    editor.root.addEventListener('blur', e => {
      this.inputIsFocused = false;
      this.handleFocusBlurDebounced();
    });

    editor.on('editor-change', (type, range) => {
      if (type === 'selection-change') {
        this.updateFormats(editor, range);
        this.handleFocusBlurDebounced();
      }
    });
    editor.on('scroll-optimize' as any, () => {
      const range = editor.getSelection();
      this.updateFormats(editor, range || undefined);
    });
    if (this.props.autoFocus) {
      editor.focus();
    }
    if (this.props.autoFocusAndSelect) {
      editor.setSelection(0, editor.getLength(), 'api');
    }
  }
  counter = 0;
  render() {
    const { value, onChange, onFocus, onBlur, ...otherInputProps } = this.props;

    return (
      <Dropzone
        ref={this.dropzoneRef}
        maxSize={10 * 1024 * 1024}
        multiple
        noClick
        noKeyboard
        onDrop={(acceptedFiles, rejectedFiles, e) => {
          rejectedFiles.forEach(rejectedFile => {
            rejectedFile.errors.forEach(error => {
              this.props.enqueueSnackbar(
                `${rejectedFile.file.name}: ${error.message}`,
                { variant: 'error' });
            })
          })
          this.onDropFiles(acceptedFiles);
        }}
      >
        {({ getRootProps, getInputProps }) => (
          <div
            {...getRootProps()}
            className={this.props.classes.editorContainer}
            ref={this.editorContainerRef}
            onClick={e => this.editorRef.current?.focus()}
          >
            <input {...getInputProps()} />
            <ReactQuill
              {...otherInputProps as any}
              modules={{
                clipboard: {
                  /**
                   * Fixes issue with newlines multiplying
                   * NOTE: When upgrading to Quill V2, this property is deprecated!
                   * https://github.com/KillerCodeMonkey/ngx-quill/issues/357#issuecomment-578138062
                   */
                  matchVisual: false,
                },
                imageResize: {
                  modules: ['Resize', ToolbarExtended],
                  toolbarButtonSvgStyles: {},
                },
              }}
              className={classNames(!!this.props.hidePlaceholder && 'hidePlaceholder', this.props.classes.quill)}
              theme={'' /** core theme */}
              ref={this.editorRef}
              value={value}
              onChange={(valueNew, delta, source, editor) => {
                this.props.onChange && this.props.onChange({
                  target: {
                    value: this.isQuillEmpty(editor) ? '' : valueNew,
                    delta,
                    source,
                    editor,
                  }
                });
                if (delta.ops && source === 'user') {
                  var retainCount = 0;
                  for (const op of delta.ops) {
                    if (op.insert
                      && typeof op.insert === 'object'
                      && op.insert.image
                      && typeof op.insert.image === 'string'
                      && op.insert.image.startsWith('data:')) {
                      this.onDataImageFound(op.insert.image, retainCount - 1);
                    }
                    retainCount += (op.insert ? 1 : 0) + (op.retain || 0) - (op.delete || 0);
                  }
                }
              }}
              formats={[
                'bold',
                'strike',
                'list',
                'link',
                'italic',
                'underline',
                'blockquote',
                'code-block',
                'indent',
                'header',
                'image', 'width', 'align',
              ]}
            />
            <Collapse in={!!this.state.showFormats} className={this.props.classes.toggleButtonGroups}>
              <div className={this.props.classes.toggleButtonGroup}>
                {this.renderToggleButton(BoldIcon, 'bold', undefined, true)}
                {this.renderToggleButton(ItalicIcon, 'italic', undefined, true)}
                {this.renderToggleButton(UnderlineIcon, 'underline', undefined, true)}
                {this.renderToggleButton(StrikethroughIcon, 'strike', undefined, true)}
                {this.renderToggleButtonLink(LinkIcon)}
                {this.renderToggleButtonImage(ImageIcon)}
                {this.renderToggleButton(CodeIcon, undefined, 'code-block', true)}
                <Fade in={!this.state.showFormatsExtended}>
                  {this.renderToggleButtonCmpt(MoreIcon, false, () => this.setState({ showFormatsExtended: true }))}
                </Fade>
              </div>
              <Collapse in={!!this.state.showFormatsExtended}>
                <div className={this.props.classes.toggleButtonGroup}>
                  {this.renderToggleButton(Heading2Icon, undefined, 'header', 2)}
                  {this.renderToggleButton(Heading3Icon, undefined, 'header', 3)}
                  {this.renderToggleButton(Heading4Icon, undefined, 'header', 4)}
                  {this.renderToggleButton(ListCheckIcon, undefined, 'list', 'unchecked', ['unchecked', 'checked'])}
                  {this.renderToggleButton(ListUnorderedIcon, undefined, 'list', 'bullet')}
                  {this.renderToggleButton(ListOrderedIcon, undefined, 'list', 'ordered')}
                  {this.renderToggleButton(QuoteIcon, undefined, 'blockquote', true)}
                </div>
              </Collapse>
            </Collapse>
            {this.renderEditLinkPopper()}
          </div>
        )}
      </Dropzone>
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
        zIndex={this.props.theme.zIndex.modal + 1}
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
        placement='top'
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
          <>
            <div>Enter link:</div>
            <TextField
              autoFocus
              variant='standard'
              size='small'
              margin='none'
              placeholder='https://'
              error={this.state.editLinkError}
              value={(this.state.editLinkValue === undefined
                ? this.state.editLinkPrevValue
                : this.state.editLinkValue) || ''}
              onChange={e => this.setState({
                editLinkValue: e.target.value,
                editLinkError: undefined,
              })}
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
                const url = sanitize(this.state.editLinkValue);
                if (!url) {
                  this.setState({ editLinkError: true });
                  return;
                }
                if (this.state.editLinkShow.length > 0) {
                  editor.formatText(this.state.editLinkShow, 'link', url, 'user');
                } else {
                  editor.format('link', url, 'user');
                }
                this.setState({
                  editLinkPrevValue: url,
                  editLinkEditing: undefined,
                  editLinkValue: undefined,
                  editLinkError: undefined,
                });
              }}
            >Save</Button>
          </>
        ) : (
          <>
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
          </>
        )}
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
                const [link, offset] = (editor.scroll as any).descendant(QuillFormatLinkExtended, editLinkShow.index);
                if (link !== null) {
                  editor.formatText(editLinkShow.index - offset, link.length(), 'link', false, 'user');
                } else {
                  editor.formatText(editLinkShow, { link: false }, 'user');
                }
              });
            }}
          >Remove</Button>
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
        const selection = editor?.getSelection(true);
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
          editLinkError: undefined,
        });
      })
  }

  renderToggleButtonImage(IconCmpt) {
    return this.renderToggleButtonCmpt(
      IconCmpt,
      false,
      e => this.dropzoneRef.current?.open())
  }

  /**
   * Convert data url by uploading and replacing with remote url.
   * 
   * This catches any images drag-n-drop dropzone or uploaded using
   * the image upload button.
   */
  async onDropFiles(files: File[]) {
    const editor = this.editorRef.current?.getEditor();
    if (!editor) return;
    const range = editor.getSelection(true);
    for (const file of files) {
      try {
        const url = await this.props.uploadImage(file);
        editor.insertEmbed(range.index, 'image', url, 'user');
      } catch (e) {
        this.props.enqueueSnackbar(
          `${file.name}: ${e}`,
          { variant: 'error' });
      }
    }
  }

  /**
   * Convert data url by uploading and replacing with remote url.
   * 
   * This catches any images not handled by the dropzone.
   * Particularly if you paste an image into the editor.
   */
  async onDataImageFound(imageDataUrl, retainCount) {
    const editor = this.editorRef.current?.getEditor();
    if (!editor) return;

    const blob = dataImageToBlob(imageDataUrl);

    var imageLink;
    try {
      imageLink = await this.props.uploadImage(blob);
    } catch (e) {
      imageLink = false;
      this.props.enqueueSnackbar(
        `Failed image upload: ${e}`,
        { variant: 'error' });
    };

    // Ensure the image is still in the same spot
    // or find where it was moved to and adjust retainCount
    const isOpOurImage = o => (typeof o?.insert === 'object'
      && typeof o.insert.image === 'string'
      && o.insert.image.startsWith(imageDataUrl.slice(0, Math.min(50, imageDataUrl.length))));
    var op = editor.getContents(retainCount).ops?.[0];
    if (!op || !isOpOurImage(op)) {
      retainCount = -1;
      do {
        retainCount++;
        // There must be a better way to find the index without getting contents
        // for each character here, but:
        // - This is safer than parsing the Delta format
        // - This should be a rare case
        op = editor.getContents(retainCount, 1).ops?.[0];
        if (op === undefined) {
          // The image was deleted while uploaded
          return;
        }
      } while (!isOpOurImage(op));
    }

    if (imageLink) {
      editor.updateContents(new Delta()
        .retain(retainCount)
        .delete(1)
        .insert({ image: imageLink }, op.attributes),
        'silent');
    } else {
      editor.updateContents(new Delta()
        .retain(retainCount)
        .delete(1),
        'silent');
    }
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
            editLinkError: undefined,
          } : (!this.state.editLinkEditing ? {
            editLinkShow: undefined,
          } : {}))
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
      const range = editor.getSelection(true);
      const hasSelection = !!range && range.length > 0;
      // Use inline formatting if we have selected text or if there is no line formatting
      if (format && (!formatLine || hasSelection)) {
        if (hasSelection || !range) {
          editor.format(format, isActiveFormat ? false : defaultValue, 'user');
        } else {
          const wordBoundaryRange = this.getWordBoundary(editor, range.index);
          if (wordBoundaryRange.length > 0) {
            editor.formatText(wordBoundaryRange, { [format]: isActiveFormat ? false : defaultValue }, 'user');
          } else {
            editor.format(format, isActiveFormat ? false : defaultValue, 'user');
          }
        }
      } else if (!!formatLine) {
        editor.format(formatLine, isActiveFormatLine ? false : defaultValue, 'user');
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

  /** 
   * Empty if contains only whitespace.
   * https://github.com/quilljs/quill/issues/163#issuecomment-561341501
   */
  isQuillEmpty(editor: UnprivilegedEditor): boolean {
    if ((editor.getContents()['ops'] || []).length !== 1) {
      return false;
    }
    return editor.getText().trim().length === 0;
  }


  /**
   * Selects whole word if cursor is inside the word (not at the beginning or end)
   */
  getWordBoundary(editor: Quill, index: number): RangeStatic {
    const [line, offset] = editor.getLine(index);
    if (!line) {
      return { index, length: 0 };
    }
    const text = editor.getText(
      editor.getIndex(line),
      line.length());

    // First check we are surrounded by non-whitespace
    if (offset === 0 || (WhitespaceChars.indexOf(text[offset - 1]) > -1)
      || offset >= text.length || (WhitespaceChars.indexOf(text[offset]) > -1)) {
      return { index, length: 0 };
    }

    // Iterate to the left until we find the beginning of word or start of line
    var boundaryIndex = index - 1;
    for (var x = offset - 2; x >= 0; x--) {
      if (WhitespaceChars.indexOf(text[x]) > -1) {
        break;
      }
      boundaryIndex--;
    }

    // Iterate to the right until we find the end of word or end of line
    var boundaryLength = index + 1 - boundaryIndex;
    for (var y = offset + 1; y < text.length; y++) {
      if (WhitespaceChars.indexOf(text[y]) > -1) {
        break;
      }
      boundaryLength++;
    }

    return { index: boundaryIndex, length: boundaryLength };
  }
}

export default withSnackbar(withStyles(styles, { withTheme: true })(RichEditor));

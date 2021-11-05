// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import loadable from '@loadable/component';
import { Collapse, FormControl, FormControlLabel, FormHelperText, IconButton, InputAdornment, InputLabel, MenuItem, Select, Switch, TextField } from '@material-ui/core';
import VisitPageIcon from '@material-ui/icons/MoreHoriz';
import KeyRefreshIcon from '@material-ui/icons/Refresh';
import { BaseEmoji } from 'emoji-mart/dist-es/index.js';
import React, { Component } from 'react';
import { Server } from '../../../api/server';
import { DemoUpdateDelay } from '../../../api/serverAdmin';
import SelectionPicker, { Label } from '../../../app/comps/SelectionPicker';
import Loading from '../../../app/utils/Loading';
import { importFailed, importSuccess } from '../../../Main';
import DynamicMuiIcon from '../../icon/DynamicMuiIcon';
import MyColorPicker from '../../MyColorPicker';
import Overlay from '../../Overlay';
import RichEditor from '../../RichEditor';
import RichEditorImageUpload from '../../RichEditorImageUpload';
import debounce from '../../util/debounce';
import randomUuid from '../../util/uuid';
import * as ConfigEditor from '../configEditor';
import TableProp from './TableProp';
import UpgradeWrapper from './UpgradeWrapper';

const EmojiPicker = loadable(() => import(/* webpackChunkName: "EmojiPicker", webpackPreload: true */'../../EmojiPicker').then(importSuccess).catch(importFailed), { fallback: (<Loading />), ssr: false });

interface Props {
  key: string;
  server: Server;
  prop: ConfigEditor.Page | ConfigEditor.PageGroup | ConfigEditor.Property;
  bare?: boolean;
  marginTop?: number;
  inputMinWidth?: string | number;
  width?: string | number;
  pageClicked?: (path: ConfigEditor.Path) => void;
  isInsideMuiTable?: boolean;
  requiresUpgrade?: (propertyPath: ConfigEditor.Path) => boolean;
  overrideName?: string;
  overrideDescription?: string;
  // If property uses a TextField-like component, will inject these properties
  TextFieldProps?: Partial<React.ComponentProps<typeof TextField>>;
  // If property uses a TableProp, will inject these properties
  TablePropProps?: Partial<React.ComponentProps<typeof TableProp>>;
  // If property uses a SelectionPicker, will inject these properties
  SelectionPickerProps?: Partial<React.ComponentProps<typeof SelectionPicker>>;
  setImmediately?: boolean;
  unhide?: boolean;
}
interface State {
  value?: any;
}
export default class Property extends Component<Props, State> {
  static inputMinWidth = 224;
  readonly colorRef = React.createRef<HTMLDivElement>();
  readonly richEditorImageUploadRef = React.createRef<RichEditorImageUpload>();
  unsubscribe?: () => void;
  propSet;

  constructor(props) {
    super(props);

    this.state = {
      value: props.prop.value,
    };
    if (!!props.setImmediately) {
      this.propSet = props.prop.set;
    } else {
      const setDebounced = debounce(props.prop.set, DemoUpdateDelay);
      this.propSet = value => {
        this.setState({ value });
        setDebounced(value);
      };
    }
  }

  componentDidMount() {
    this.unsubscribe = this.props.prop.subscribe(this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    const prop = this.props.prop;
    const description = this.props.overrideDescription !== undefined ? this.props.overrideDescription : prop.description;
    const name = this.props.overrideName !== undefined ? this.props.overrideName : prop.name || prop.pathStr;
    const inputMinWidth = this.props.inputMinWidth !== undefined ? this.props.inputMinWidth : Property.inputMinWidth;
    var marginTop = this.props.marginTop !== undefined ? this.props.marginTop : 30;
    var propertySetter;
    var shrink = (this.state.value !== undefined && this.state.value !== '') ? true : undefined;

    if (prop.hide && !this.props.unhide) {
      return null;
    }

    OUTER: switch (prop.type) {
      case ConfigEditor.PropertyType.Number:
      case ConfigEditor.PropertyType.Integer:
      case ConfigEditor.PropertyType.String:
        switch (prop.subType) {
          case ConfigEditor.PropSubType.Color:
            propertySetter = (
              <div style={{
                display: 'inline-flex',
                flexDirection: 'column',
              }}>
                <div ref={this.colorRef} style={{ position: 'relative' }}> {/* Div-wrapped so the absolutely positioned picker shows up in the right place */}
                  <MyColorPicker
                    preview
                    clearable={!prop.required}
                    label={!this.props.bare ? name : undefined}
                    name='color'
                    placeholder='#FFF'
                    defaultValue={prop.defaultValue}
                    value={this.state.value || ''}
                    onChange={color => this.propSet(color || undefined)}
                    error={!!prop.errorMsg}
                    InputLabelProps={{
                      shrink: shrink,
                      error: !!prop.errorMsg,
                    }}
                    TextFieldProps={{
                      variant: 'outlined',
                      size: 'small',
                      InputProps: {
                        readOnly: true,
                        style: {
                          minWidth: inputMinWidth,
                          width: this.props.width,
                        },
                        error: !!prop.errorMsg,
                      },
                      ...this.props.TextFieldProps,
                    }}
                  />
                </div>
                {(!this.props.bare && description || prop.errorMsg) && (<FormHelperText style={{ minWidth: inputMinWidth, width: this.props.width }} error={!!prop.errorMsg}>{prop.errorMsg || description}</FormHelperText>)}
              </div>
            );
            break OUTER;
          default:
          // Fall through to below
        }
        var fieldType;
        if (prop.type === ConfigEditor.PropertyType.String) {
          switch (prop.format) {
            case ConfigEditor.StringFormat.DateTime:
              fieldType = 'datetime-local';
              shrink = true;
              break;
            case ConfigEditor.StringFormat.Date:
            case ConfigEditor.StringFormat.Time:
              fieldType = prop.format;
              shrink = true;
              break;
            default:
              fieldType = 'text';
              break;
          }
        } else {
          fieldType = 'number';
        }
        const TextFieldCmpt = prop.subType === ConfigEditor.PropSubType.Rich
          ? RichEditor : TextField;
        propertySetter = (
          <>
            <TextFieldCmpt
              variant='outlined'
              size='small'
              id={prop.pathStr}
              label={!this.props.bare && name}
              {...({ iAgreeInputIsSanitized: true })}
              value={this.state.value || ''}
              onChange={e => this.propSet(e.target.value as never)}
              error={!!prop.errorMsg}
              placeholder={prop.placeholder !== undefined ? (prop.placeholder + '') : undefined}
              helperText={prop.errorMsg || (!this.props.bare && description)}
              margin='none'
              multiline={(prop.subType === ConfigEditor.PropSubType.Multiline
                || prop.subType === ConfigEditor.PropSubType.Rich) as any}
              type={fieldType}
              InputLabelProps={{
                shrink: shrink,
                error: !!prop.errorMsg,
              }}
              InputProps={{
                style: {
                  minWidth: inputMinWidth,
                  width: this.props.width,
                },
                readOnly: prop.subType === ConfigEditor.PropSubType.Emoji || prop.subType === ConfigEditor.PropSubType.Id,
                onFocus: prop.subType === ConfigEditor.PropSubType.KeyGen ? () => {
                  if (!this.state.value) this.propSet(randomUuid());
                } : undefined,
                endAdornment: prop.subType === ConfigEditor.PropSubType.KeyGen ? (
                  <InputAdornment position='end'>
                    <IconButton
                      aria-label='Re-generate key'
                      onClick={() => this.propSet(randomUuid())}
                    >
                      <KeyRefreshIcon fontSize='small' />
                    </IconButton>
                  </InputAdornment>
                ) : (prop.subType === ConfigEditor.PropSubType.Icon ? (
                  <InputAdornment position='end'>
                    <DynamicMuiIcon name={this.state.value || ''} />
                  </InputAdornment>
                ) : undefined),
              }}
              FormHelperTextProps={{
                style: {
                  minWidth: inputMinWidth,
                  width: this.props.width,
                },
              }}
              {...{
                uploadImage: prop.subType === ConfigEditor.PropSubType.Rich
                  ? (file) => this.richEditorImageUploadRef.current!.uploadImage(file)
                  : undefined
              }}
              {...this.props.TextFieldProps}
            />
            {prop.subType === ConfigEditor.PropSubType.Rich && (
              <RichEditorImageUpload
                ref={this.richEditorImageUploadRef}
                server={this.props.server}
              />
            )}
          </>
        );
        if (prop.subType === ConfigEditor.PropSubType.Emoji) {
          propertySetter = (
            <Overlay
              isInsideMuiTable={this.props.isInsideMuiTable}
              popup={(
                <EmojiPicker
                  onSelect={emoji => this.propSet(((emoji as BaseEmoji).native) as never)}
                />
              )}
            >
              {propertySetter}
            </Overlay>
          );
        }
        break;
      case ConfigEditor.PageType:
        const link = !!this.props.pageClicked && (
          <div>
            <IconButton aria-label="Open" onClick={() => {
              this.props.pageClicked && this.props.pageClicked(prop.path);
            }}>
              <VisitPageIcon />
            </IconButton>
          </div>
        );
        const descriptionOrError = (description || prop.errorMsg)
          ? (<FormHelperText style={{ minWidth: inputMinWidth, width: this.props.width }} error={!!prop.errorMsg}>{prop.errorMsg || description}</FormHelperText>)
          : null;
        var content;
        if (prop.required) {
          content = (
            <>
              {descriptionOrError}
              {link}
            </>
          );
        } else {
          content = (
            <div>
              <div>
                <FormControlLabel
                  control={(
                    <Switch
                      checked={!!this.state.value}
                      onChange={(e, checked) => this.propSet(checked ? true : undefined)}
                      color='default'
                    />
                  )}
                  label={!!description && (<FormHelperText >{description}</FormHelperText>)}
                  style={{
                    width: this.props.width,
                    minWidth: inputMinWidth,
                  }}
                />
              </div>
              <Collapse in={this.state.value}>
                {link}
              </Collapse>
            </div>
          );
        }
        marginTop += 16;
        propertySetter = (
          <div>
            <InputLabel error={!!prop.errorMsg}>{name}</InputLabel>
            {content}
          </div>
        );
        break;
      case ConfigEditor.PropertyType.Boolean:
      case ConfigEditor.PropertyType.Enum:
        if (prop.required && prop.type === ConfigEditor.PropertyType.Boolean) {
          propertySetter = (
            <div>
              {!this.props.bare && (<InputLabel error={!!prop.errorMsg}>{name}</InputLabel>)}
              {(!this.props.bare && description || prop.errorMsg) && (<FormHelperText style={{ minWidth: inputMinWidth, width: this.props.width }} error={!!prop.errorMsg}>{prop.errorMsg || description}</FormHelperText>)}
              <div>
                <FormControlLabel
                  control={(
                    <Switch
                      checked={!!this.state.value}
                      onChange={(e, checked) => this.propSet(checked)}
                      color='default'
                    />
                  )}
                  label={!this.props.bare && (<FormHelperText component='span' error={!!prop.errorMsg}>
                    {!!this.state.value
                      ? (prop.trueLabel || 'Enabled')
                      : (prop.falseLabel || 'Disabled')}
                  </FormHelperText>)}
                  style={{
                    width: this.props.width,
                    minWidth: inputMinWidth,
                  }}
                />
              </div>
            </div>
          );
          break;
        }
        var items: ConfigEditor.EnumItem[];
        var currentItem;
        if (prop.type === ConfigEditor.PropertyType.Boolean) {
          items = [
            { name: 'Default', value: 'undefined' },
            { name: 'Enabled', value: 'true' },
            { name: 'Disabled', value: 'false' },
          ];
          if (this.state.value === undefined) {
            currentItem = items.find(item => item.value === 'undefined');
          } else if (this.state.value === true) {
            currentItem = items.find(item => item.value === 'true');
          } else if (this.state.value === false) {
            currentItem = items.find(item => item.value === 'false');
          }
        } else {
          items = prop.items;
          currentItem = items.find(item => item.value === this.state.value);
        }
        shrink = !!(this.state.value !== undefined && currentItem && currentItem.name);
        propertySetter = (
          <FormControl
            variant='outlined'
            size='small'
            style={{
              minWidth: inputMinWidth,
              width: this.props.width,
            }}
          >
            {!this.props.bare && (<InputLabel error={!!prop.errorMsg} shrink={shrink}>{name}</InputLabel>)}
            <Select
              label={!this.props.bare ? name : undefined}
              value={this.state.value !== undefined && currentItem.value ? currentItem.value : ''}
              onChange={e => {
                if (prop.type === ConfigEditor.PropertyType.Boolean) {
                  switch (e.target.value) {
                    case 'undefined':
                      this.propSet(undefined as never)
                      break;
                    case 'true':
                      this.propSet(true as never)
                      break;
                    case 'false':
                      this.propSet(false as never)
                      break;
                  }
                } else {
                  this.propSet((e.target.value) as never)
                }
              }}
              error={!!prop.errorMsg}
            >
              {items.map((item, index) => (
                <MenuItem key={item.name} value={item.value || ''}>{item.value === 'undefined'
                  ? (<em>{item.name}</em>)
                  : item.name
                }</MenuItem>
              ))}
            </Select>
            {(!this.props.bare && description || prop.errorMsg) && (<FormHelperText style={{ minWidth: inputMinWidth, width: this.props.width }} error={!!prop.errorMsg}>{prop.errorMsg || description}</FormHelperText>)}
          </FormControl>
        );
        break;
      case ConfigEditor.PageGroupType:
      case ConfigEditor.PropertyType.Array:
        if (prop.type === ConfigEditor.PropertyType.Array && prop.childType === ConfigEditor.PropertyType.Enum && prop.childEnumItems && prop.required && prop.uniqueItems) {
          const values: Label[] = [];
          const options: Label[] = [];
          const enumValues = new Set((prop.childProperties || []).map(childProp => (childProp as ConfigEditor.EnumProperty)
            .value));
          prop.childEnumItems.forEach(enumItem => {
            const label = { label: enumItem!.name, value: enumItem!.value };
            options.push(label);
            if (enumValues.has(enumItem.value)) {
              values.push(label);
            }
          });
          propertySetter = (
            <SelectionPicker
              TextFieldProps={{
                variant: 'outlined',
                size: 'small',
                ...this.props.TextFieldProps,
              }}
              label={this.props.bare ? undefined : name}
              helperText={this.props.bare ? undefined : description}
              placeholder={prop.placeholder !== undefined ? (prop.placeholder + '') : undefined}
              errorMsg={prop.errorMsg}
              value={values}
              options={options}
              isMulti
              clearOnBlur
              width={this.props.width || 'max-content'}
              minWidth={inputMinWidth}
              onValueChange={labels => prop
                .setRaw(labels.map(label => label.value))}
              {...this.props.SelectionPickerProps}
            />
          );
        } else {
          propertySetter = (
            <TableProp
              key={prop.key}
              server={this.props.server}
              data={prop}
              errorMsg={prop.errorMsg}
              label={name}
              helperText={description}
              width={this.props.width}
              pageClicked={this.props.pageClicked}
              requiresUpgrade={this.props.requiresUpgrade}
              bare={this.props.bare}
              {...this.props.TablePropProps}
            />
          );
        }
        break;
      case ConfigEditor.PropertyType.Object:
        const subProps = (
          <Collapse mountOnEnter in={this.state.value} style={{ marginLeft: '30px' }}>
            {prop.childProperties && prop.childProperties
              .filter(childProp => !childProp.hide)
              .map(childProp => (
                <Property {...this.props} bare={false} key={childProp.key} prop={childProp} />
              ))
            }
          </Collapse>
        );
        const enableObject = !prop.required && (
          <div>
            <FormControlLabel
              control={(
                <Switch
                  checked={!!this.state.value}
                  onChange={(e, checked) => this.propSet(checked ? true : undefined)}
                  color='default'
                />
              )}
              label={!this.props.bare && (<FormHelperText style={{ minWidth: inputMinWidth, width: this.props.width }} error={!!prop.errorMsg}>{!!this.state.value ? 'Enabled' : 'Disabled'}</FormHelperText>)}
              style={{
                marginBottom: '-10px',
                width: this.props.width,
                minWidth: inputMinWidth,
              }}
            />
          </div>
        );
        marginTop += 16;
        propertySetter = (
          <div style={{ marginBottom: '10px' }}>
            {!this.props.bare && (<InputLabel error={!!prop.errorMsg}>{name}</InputLabel>)}
            {(!this.props.bare && description || prop.errorMsg) && (<FormHelperText style={{ minWidth: inputMinWidth, width: this.props.width }} error={!!prop.errorMsg}>{prop.errorMsg || description}</FormHelperText>)}
            {enableObject}
            {subProps}
          </div>
        );
        break;
      case ConfigEditor.PropertyType.Link:
      case ConfigEditor.PropertyType.LinkMulti:
        const onValueChange = labels => {
          if (prop.type === ConfigEditor.PropertyType.LinkMulti) {
            this.propSet(new Set<string>(labels.map(o => o.value)));
          } else {
            this.propSet(labels.length === 0 ? undefined : labels[0].value);
          }
        };
        const onValueCreate = prop.allowCreate ? prop.create.bind(this) : undefined;
        const values: Label[] = [];
        const options: Label[] = [];
        prop.getOptions()
          .forEach(o => {
            options.push({
              label: o.name,
              filterString: o.name,
              value: o.id,
              color: o.color,
            });
          });
        if (this.state.value !== undefined) {
          (prop.type === ConfigEditor.PropertyType.Link
            ? [prop.getOptions().find(o => o.id === this.state.value)]
              .filter(o => o !== undefined)
            : prop.getOptions().filter(o => (this.state.value as Set<string>).has(o.id)))
            .forEach(o => {
              values.push({
                label: o!.name,
                value: o!.id,
                color: o!.color,
              });
            })
        }
        propertySetter = (
          <SelectionPicker
            TextFieldProps={{
              variant: 'outlined',
              size: 'small',
              ...this.props.TextFieldProps,
            }}
            disableInput={!prop.allowCreate}
            disableClearable={prop.required}
            label={this.props.bare ? undefined : name}
            helperText={this.props.bare ? undefined : description}
            placeholder={prop.placeholder !== undefined ? (prop.placeholder + '') : undefined}
            errorMsg={prop.errorMsg}
            value={values}
            options={options}
            showTags
            bareTags={prop.type === ConfigEditor.PropertyType.Link}
            isMulti={prop.type === ConfigEditor.PropertyType.LinkMulti}
            width={this.props.width || 'max-content'}
            minWidth={inputMinWidth}
            onValueChange={onValueChange}
            onValueCreate={onValueCreate}
            {...this.props.SelectionPickerProps}
          />
        );
        break;
      default:
        throw Error(`Unknown property type ${prop['type']}`);
    }

    if (!propertySetter) {
      return null;
    }

    propertySetter = (
      <div style={{ marginTop: this.props.bare ? undefined : marginTop + 'px' }}>
        {propertySetter}
      </div>
    );

    if (!!this.props.requiresUpgrade && this.props.requiresUpgrade(this.props.prop.path)) {
      propertySetter = (
        <UpgradeWrapper
          propertyPath={this.props.prop.path}
        >
          {propertySetter}
        </UpgradeWrapper>
      );
    }

    return propertySetter;
  }
}

import React, { Component } from 'react';
import * as ConfigEditor from '../configEditor';
import { Typography, TextField, RadioGroup, FormControlLabel, Radio, Checkbox, Switch, FormHelperText, FormControl, InputLabel, Select, MenuItem, Input, Collapse, IconButton } from '@material-ui/core';
import TableProp from './TableProp';
import ColorPicker from 'material-ui-color-picker'
import VisitPageIcon from '@material-ui/icons/ArrowRightAlt';
import 'emoji-mart/css/emoji-mart.css';
import { Picker, EmojiData, BaseEmoji } from 'emoji-mart';
import Overlay from '../../Overlay';
import SelectionPicker, { Label, ColorLookup } from '../../../app/comps/SelectionPicker';

interface Props {
  key:string;
  prop:ConfigEditor.Page|ConfigEditor.PageGroup|ConfigEditor.Property;
  bare?:boolean;
  width?:string
  pageClicked:(path:ConfigEditor.Path)=>void;
  isInsideMuiTable?:boolean;
}

export default class Property extends Component<Props> {
  static inputMinWidth = '224px';
  readonly colorRef = React.createRef<HTMLDivElement>();
  unsubscribe?:()=>void;

  componentDidMount() {
    this.unsubscribe = this.props.prop.subscribe(this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    const prop = this.props.prop;
    const name = prop.name || prop.pathStr;
    var marginTop = 30;
    var propertySetter;
    var shrink = (prop.value !== undefined && prop.value !== '') ? true : undefined;
    OUTER: switch(prop.type) {
      case ConfigEditor.PropertyType.Number:
      case ConfigEditor.PropertyType.Integer:
      case ConfigEditor.PropertyType.String:
        switch(prop.subType) {
          case ConfigEditor.PropSubType.Id:
            // ID is an invisible field
            propertySetter = undefined;
            break OUTER;
          case ConfigEditor.PropSubType.Color:
            propertySetter = (
              <div style={{
                display: 'inline-flex',
                flexDirection: 'column',
              }}>
                <div ref={this.colorRef} > {/* Div-wrapped so the absolutely positioned picker shows up in the right place */}
                  <ColorPicker
                    label={!this.props.bare && name}
                    name='color'
                    placeholder='#000'
                    defaultValue={prop.defaultValue}
                    value={prop.value || ''}
                    onChange={color => prop.set(color)}
                    TextFieldProps={{
                      // Hack to modify material-ui-color-picker to fix bug
                      // where a click inside the empty space inside the
                      // picker would dismiss the picker.
                      onFocus: () => setTimeout(() => {
                        var ptr:any = this.colorRef;
                        ['current', 'children', 1, 'children', 1, 'style'].forEach(next => ptr && (ptr = ptr[next]));
                        ptr && (ptr.position = 'relative');
                      },500),
                      InputLabelProps:{
                        shrink: shrink,
                        error: !!prop.errorMsg,
                      },
                      InputProps: {
                        inputProps: {
                          autocomplete: 'off',
                        },
                        style: {
                          color: prop.value,
                          minWidth: Property.inputMinWidth,
                          width: this.props.width,
                        },
                        error: !!prop.errorMsg,
                      }
                    }}
                    error={!!prop.errorMsg}
                  />
                </div>
                {(!this.props.bare && prop.description || prop.errorMsg) && (<FormHelperText style={{minWidth: Property.inputMinWidth, width: this.props.width}} error={!!prop.errorMsg}>{prop.errorMsg || prop.description}</FormHelperText>)}
              </div>
            );
            break OUTER;
          default:
            // Fall through to below
        }
        var fieldType;
        if(prop.type === ConfigEditor.PropertyType.String) {
          switch(prop.format) {
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
        propertySetter = (
          <TextField
            id={prop.pathStr}
            label={!this.props.bare && name}
            value={prop.value || ''}
            onChange={e => prop.set(e.target.value as never)}
            error={!!prop.errorMsg}
            placeholder={prop.placeholder}
            helperText={prop.errorMsg || (!this.props.bare && prop.description)}
            margin='none'
            type={fieldType}
            InputLabelProps={{
              shrink: shrink,
              error: !!prop.errorMsg,
            }}
            InputProps={{
              style: {
                minWidth: Property.inputMinWidth,
                width: this.props.width,
                readonly: prop.subType === ConfigEditor.PropSubType.Emoji,
              },
            }}
            FormHelperTextProps={{
              style: {
                minWidth: Property.inputMinWidth,
                width: this.props.width,
              },
            }}
          />
        );
        if(prop.subType === ConfigEditor.PropSubType.Emoji) {
          propertySetter = (
            <Overlay
              isInsideMuiTable={this.props.isInsideMuiTable}
              popup={(
                <Picker
                  native
                  onSelect={emoji => prop.set(((emoji as BaseEmoji).native) as never)}
                />
              )}
            >
              {propertySetter}
            </Overlay>
          );
        }
        break;
      case ConfigEditor.PageType:
        const link = (
          <div>
            <IconButton aria-label="Open" onClick={() => {
              this.props.pageClicked(prop.path);
            }}>
              <VisitPageIcon />
            </IconButton>
          </div>
        );
        const description = (prop.description || prop.errorMsg)
            ? (<FormHelperText style={{minWidth: Property.inputMinWidth, width: this.props.width}} error={!!prop.errorMsg}>{prop.errorMsg || prop.description}</FormHelperText>)
            : null;
        var content;
        if(prop.required) {
          content = [description, link];
        } else {
          content = (
            <div>
              <div>
                <FormControlLabel
                  control={(
                    <Switch
                      checked={!!prop.value}
                      onChange={(e, checked) => prop.set(checked ? true : undefined)}
                      color='default'
                    />
                  )}
                  label={description}
                />
              </div>
              <Collapse in={prop.value} style={{marginLeft: '30px'}}>
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
        if(prop.required && prop.type === ConfigEditor.PropertyType.Boolean) {
          propertySetter = (
            <div>
              {!this.props.bare && (<InputLabel error={!!prop.errorMsg}>{name}</InputLabel>)}
              <div>
                <FormControlLabel
                  control={(
                    <Switch
                      checked={!!prop.value}
                      onChange={(e, checked) => prop.set(checked)}
                      color='default'
                    />
                  )}
                  label={!this.props.bare && (<FormHelperText component='span' error={!!prop.errorMsg}>{!!prop.value ? 'Enabled' : 'Disabled'}</FormHelperText>)}
                />
              </div>
              {(!this.props.bare && prop.description || prop.errorMsg) && (<FormHelperText style={{minWidth: Property.inputMinWidth, width: this.props.width}} error={!!prop.errorMsg}>{prop.errorMsg || prop.description}</FormHelperText>)}
            </div>
          );
          break;
        }
        const items:{
          name:string;
          value:any;
        }[] = prop.type === ConfigEditor.PropertyType.Boolean
          ? [{name: 'Not set', value: undefined},
            {name: 'Enabled', value: true},
            {name: 'Disabled', value: false}]
          : prop.items;
        const currentItem = items.find(item => item.value === prop.value);
        shrink = !!(prop.value !== undefined && currentItem && currentItem.name);
        propertySetter = (
          <FormControl
            style={{
              minWidth: Property.inputMinWidth,
              width: this.props.width,
            }}
          >
            {!this.props.bare && (<InputLabel error={!!prop.errorMsg} shrink={shrink}>{name}</InputLabel>)}
            <Select
              value={prop.value || ''}
              onChange={e => prop.set((e.target.value) as never)}
              error={!!prop.errorMsg}
            >
              {items.map(item => (
                <MenuItem value={item.value || ''}>{item.value === undefined
                  ? (<em>{item.name}</em>)
                  : item.name
                }</MenuItem>
              ))}
            </Select>
            {(!this.props.bare && prop.description || prop.errorMsg) && (<FormHelperText style={{minWidth: Property.inputMinWidth, width: this.props.width}} error={!!prop.errorMsg}>{prop.errorMsg || prop.description}</FormHelperText>)}
          </FormControl>
        );
        break;
      case ConfigEditor.PageGroupType:
      case ConfigEditor.PropertyType.Array:
        if(prop.type === ConfigEditor.PropertyType.Array && prop.childType === ConfigEditor.PropertyType.Enum && prop.childEnumItems && prop.required && prop.uniqueItems) {
          const values:Label[] = [];
          const options:Label[] = [];
          const enumValues = new Set((prop.childProperties || []).map(childProp => (childProp as ConfigEditor.EnumProperty)
            .value));
          prop.childEnumItems.forEach(enumItem => {
            const label = {label: enumItem!.name, value: enumItem!.value};
            options.push(label);
            if(enumValues.has(enumItem.value)) {
              values.push(label);
            }
          });
          propertySetter = (
            <SelectionPicker
              label={prop.name}
              helperText={prop.description}
              placeholder={prop.placeholder}
              errorMsg={prop.errorMsg}
              value={values}
              options={options}
              isMulti={true}
              bare={this.props.bare}
              width={this.props.width}
              inputMinWidth={Property.inputMinWidth}
              onValueChange={(labels, action) => prop
                .setRaw(labels.map(label => label.value))}
            />
          );
        } else {
          propertySetter = (
            <TableProp
              key={prop.key}
              data={prop}
              errorMsg={prop.errorMsg}
              label={!this.props.bare && name}
              helperText={!this.props.bare && prop.description}
              pageClicked={this.props.pageClicked}
            />
          );
        }
        break;
      case ConfigEditor.PropertyType.Object:
        const subProps = (
          <Collapse in={prop.value} style={{marginLeft: '30px'}}>
            {prop.childProperties && prop.childProperties
              .filter(childProp => childProp.subType !== ConfigEditor.PropSubType.Id)
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
                  checked={!!prop.value}
                  onChange={(e, checked) => prop.set(checked ? true : undefined)}
                  color='default'
                />
              )}
              label={!this.props.bare && (<FormHelperText style={{minWidth: Property.inputMinWidth, width: this.props.width}} error={!!prop.errorMsg}>{!!prop.value ? 'Enabled' : 'Disabled'}</FormHelperText>)}
              style={{ marginBottom: '-10px'}}
            />
          </div>
        );
        marginTop += 16;
        propertySetter = (
          <div style={{marginBottom: '10px'}}>
            {!this.props.bare && (<InputLabel error={!!prop.errorMsg}>{name}</InputLabel>)}
            {(!this.props.bare && prop.description || prop.errorMsg) && (<FormHelperText style={{minWidth: Property.inputMinWidth, width: this.props.width}} error={!!prop.errorMsg}>{prop.errorMsg || prop.description}</FormHelperText>)}
            {enableObject}
            {subProps}
          </div>
        );
        break;
      case ConfigEditor.PropertyType.Link:
      case ConfigEditor.PropertyType.LinkMulti:
        const onValueChange = (labels, action) => {
          if(prop.type === ConfigEditor.PropertyType.LinkMulti) {
            prop.set(new Set<string>(labels.map(o => o.value)));
          } else {
            prop.set(labels.length === 0 ? undefined : labels[0].value);
          }
        };
        const onValueCreate = prop.allowCreate ? prop.create.bind(this) : undefined;
        const values:Label[] = [];
        const options:Label[] = [];
        const colorLookup:ColorLookup = {};
        prop.getOptions()
        .forEach(o => {
          options.push({label: o.name, value: o.id});
          if(o!.color) colorLookup[o!.id] = o!.color;
        });
        if(prop.value !== undefined) {
          (prop.type === ConfigEditor.PropertyType.Link
            ? [prop.getOptions().find(o => o.id === prop.value)]
              .filter(o => o !== undefined)
            : prop.getOptions().filter(o => (prop.value as Set<string>).has(o.id)))
            .forEach(o => {
              values.push({label: o!.name, value: o!.id});
            })
        }
        propertySetter = (
          <SelectionPicker
            label={prop.name}
            helperText={prop.description}
            placeholder={prop.placeholder}
            errorMsg={prop.errorMsg}
            value={values}
            colorLookup={colorLookup}
            options={options}
            isMulti={prop.type === ConfigEditor.PropertyType.LinkMulti}
            bare={this.props.bare}
            width={this.props.width}
            inputMinWidth={Property.inputMinWidth}
            onValueChange={onValueChange}
            onValueCreate={onValueCreate}
          />
        );
        break;
      default:
        throw Error(`Unknown property type ${prop['type']}`);
    }

    return propertySetter
      ? (
        <div style={{marginTop: this.props.bare ? undefined : marginTop + 'px'}}>
          {propertySetter}
        </div>
      ) : null;
  }
}

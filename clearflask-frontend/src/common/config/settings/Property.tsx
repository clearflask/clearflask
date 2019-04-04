import React, { Component } from 'react';
import * as ConfigEditor from '../configEditor';
import { Typography, TextField, RadioGroup, FormControlLabel, Radio, Checkbox, Switch, FormHelperText, FormControl, InputLabel, Select, MenuItem, Input, Collapse } from '@material-ui/core';
import TableProp from './TableProp';
import ColorPicker from 'material-ui-color-picker'

interface Props {
  prop:ConfigEditor.Property|ConfigEditor.PageGroup;
  bare?:boolean;
  width?:string
  pageClicked:(path:ConfigEditor.Path)=>void;
}

export default class Property extends Component<Props> {
  readonly inputMinWidth = '150px';
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
                    value={prop.value}
                    onChange={this.handlePropChange.bind(this)}
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
                        shrink: (prop.value !== undefined && prop.value !== '') ? true : undefined,
                        error: !!prop.errorMsg,
                      },
                      InputProps: {
                        inputProps: {
                          autocomplete: 'off',
                        },
                        style: {
                          color: prop.value,
                          minWidth: this.inputMinWidth,
                          width: this.props.width,
                        },
                        error: !!prop.errorMsg,
                      }
                    }}
                    error={!!prop.errorMsg}
                  />
                </div>
                {(!this.props.bare || prop.errorMsg) && (<FormHelperText style={{minWidth: this.inputMinWidth, width: this.props.width}} error={!!prop.errorMsg}>{prop.errorMsg || prop.description}</FormHelperText>)}
              </div>
            );
            break OUTER;
          default:
            // Fall through to below
        }
        var fieldType;
        var shrinkString:any = undefined;
        if(prop.type === ConfigEditor.PropertyType.String) {
          switch(prop.format) {
            case ConfigEditor.StringFormat.DateTime:
              fieldType = 'datetime-local';
              shrinkString = true;
              break;
            case ConfigEditor.StringFormat.Date:
            case ConfigEditor.StringFormat.Time:
              fieldType = prop.format;
              shrinkString = true;
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
            value={prop.value}
            onChange={this.handlePropChange.bind(this)}
            error={!!prop.errorMsg}
            placeholder={prop.placeholder}
            helperText={prop.errorMsg || (!this.props.bare && prop.description)}
            margin='none'
            type={fieldType}
            InputLabelProps={{
              shrink: shrinkString,
              error: !!prop.errorMsg,
            }}
            InputProps={{
              style: {
                minWidth: this.inputMinWidth,
                width: this.props.width,
              },
            }}
            FormHelperTextProps={{
              style: {
                minWidth: this.inputMinWidth,
                width: this.props.width,
              },
            }}
          />
        );
        break;
      case ConfigEditor.PropertyType.Boolean:
      case ConfigEditor.PropertyType.Enum:
        if(prop.required && prop.type === ConfigEditor.PropertyType.Boolean) {
          marginTop += 16;
          propertySetter = (
            <div>
              {!this.props.bare && (<InputLabel error={!!prop.errorMsg}>{name}</InputLabel>)}
              <div>
                <FormControlLabel
                  control={(
                    <Switch
                      checked={!!prop.value}
                      onChange={this.handlePropChange.bind(this)}
                      color="default"
                    />
                  )}
                  label={!this.props.bare && (<FormHelperText component='span' error={!!prop.errorMsg}>{!!prop.value ? 'Enabled' : 'Disabled'}</FormHelperText>)}
                  style={{ marginTop: '-10px', marginBottom: '-10px'}}
                />
              </div>
              {(!this.props.bare || prop.errorMsg) && (<FormHelperText style={{minWidth: this.inputMinWidth, width: this.props.width}} error={!!prop.errorMsg}>{prop.errorMsg || prop.description}</FormHelperText>)}
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
        const shrink = !!(prop.value !== undefined && currentItem && currentItem.name);
        propertySetter = (
          <FormControl
            style={{
              minWidth: this.inputMinWidth,
              width: this.props.width,
            }}
          >
            {!this.props.bare && (<InputLabel error={!!prop.errorMsg} shrink={shrink}>{name}</InputLabel>)}
            <Select
              value={prop.value}
              onChange={this.handlePropChange.bind(this)}
              error={!!prop.errorMsg}
            >
              {items.map(item => (
                <MenuItem value={item.value}>{item.value === undefined
                  ? (<em>{item.name}</em>)
                  : item.name
                }</MenuItem>
              ))}
            </Select>
            {(!this.props.bare || prop.errorMsg) && (<FormHelperText style={{minWidth: this.inputMinWidth, width: this.props.width}} error={!!prop.errorMsg}>{prop.errorMsg || prop.description}</FormHelperText>)}
          </FormControl>
        );
        break;
      case 'pagegroup':
      case ConfigEditor.PropertyType.Array:
        propertySetter = (
          <TableProp
            data={prop}
            errorMsg={prop.errorMsg}
            label={!this.props.bare && name}
            helperText={!this.props.bare && prop.description}
            pageClicked={this.props.pageClicked}
          />
        );
        break;
      case ConfigEditor.PropertyType.Object:
        const subProps = (
          <Collapse in={prop.value} style={{marginLeft: '30px'}}>
            {prop.childProperties && prop.childProperties
              .filter(childProp => childProp.subType !== ConfigEditor.PropSubType.Id)
              .map(childProp => (
                <Property {...this.props} bare={false} prop={childProp} />
              ))
            }
          </Collapse>
        );
        const enableObject = !prop.required && (
          <FormControlLabel
            control={(
              <Switch
                checked={!!prop.value}
                onChange={this.handlePropChange.bind(this)}
                color="default"
                
              />
            )}
            label={!this.props.bare && (<FormHelperText style={{minWidth: this.inputMinWidth, width: this.props.width}} error={!!prop.errorMsg}>{!!prop.value ? 'Enabled' : 'Disabled'}</FormHelperText>)}
            style={{ marginBottom: '-10px'}}
          />
        );
        marginTop += 16;
        propertySetter = (
          <div style={{marginBottom: '10px'}}>
            {!this.props.bare && (<InputLabel error={!!prop.errorMsg}>{name}</InputLabel>)}
            {(!this.props.bare || prop.errorMsg) && (<FormHelperText style={{minWidth: this.inputMinWidth, width: this.props.width}} error={!!prop.errorMsg}>{prop.errorMsg || prop.description}</FormHelperText>)}
            {enableObject}
            {subProps}
          </div>
        );
        break;
      default:
        throw Error(`Unknown property type ${prop.type}`);
    }

    return propertySetter
      ? (
        <div style={{marginTop: this.props.bare ? undefined : marginTop + 'px'}}>
          {propertySetter}
        </div>
      ) : null;
  }

  handlePropChange(event) {
    const prop = this.props.prop;

    var newValue;
    if((prop.required && prop.type === ConfigEditor.PropertyType.Boolean)
      || prop.type === ConfigEditor.PropertyType.Object) {
      newValue = event.target.checked;
    } else if(prop.type !== 'pagegroup' && prop.subType === ConfigEditor.PropSubType.Color) {
      newValue = event;
    } else {
      newValue = event.target.value;
    }

    prop.set(newValue as never);
  }
}

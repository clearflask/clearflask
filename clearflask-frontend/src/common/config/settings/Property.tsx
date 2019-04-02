import React, { Component } from 'react';
import * as ConfigEditor from '../configEditor';
import { Typography, TextField, RadioGroup, FormControlLabel, Radio, Checkbox, Switch, FormHelperText, FormControl, InputLabel, Select, MenuItem, Input, Collapse } from '@material-ui/core';
import TableProp from './TableProp';
import ColorPicker from 'material-ui-color-picker'

interface Props {
  prop:ConfigEditor.Property|ConfigEditor.PageGroup;
  bare?:boolean;
}

export default class Property extends Component<Props> {
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
      case ConfigEditor.PropertyType.String:
        switch(prop.subType) {
          case ConfigEditor.PropSubType.Id:
            // ID is an invisible field
            propertySetter = undefined;
            break OUTER;
          case ConfigEditor.PropSubType.Color:
            propertySetter = (
              <div>
                <ColorPicker
                  label={!this.props.bare && name}
                  name='color'
                  placeholder='#000'
                  defaultValue={prop.defaultValue}
                  value={prop.value}
                  onChange={this.handlePropChange.bind(this)}
                  TextFieldProps={{
                    InputLabelProps:{
                      shrink: (prop.value !== undefined && prop.value !== '') ? true : undefined,
                    },
                    InputProps: {
                      inputProps: {
                        autocomplete: 'off',
                      },
                      style: {
                        color: prop.value,
                      },
                    }
                  }}
                />
                {!this.props.bare && (<FormHelperText>{prop.description}</FormHelperText>)}
              </div>
            );
            break OUTER;
          default:
            // Fall through to below
        }
      case ConfigEditor.PropertyType.Number:
      case ConfigEditor.PropertyType.Integer:
        propertySetter = (
          <TextField
            id={prop.pathStr}
            label={!this.props.bare && name}
            value={prop.value}
            onChange={this.handlePropChange.bind(this)}
            error={!!prop.errorMsg}
            placeholder={prop.placeholder}
            helperText={!this.props.bare && prop.description}
            margin='none'
            type={prop.type === 'string' ? 'text' : 'number'}
          />
        );
        break;
      case ConfigEditor.PropertyType.Boolean:
      case ConfigEditor.PropertyType.Enum:
        if(prop.required && prop.type === ConfigEditor.PropertyType.Boolean) {
          marginTop += 16;
          propertySetter = (
            <div>
              {!this.props.bare && (<InputLabel>{name}</InputLabel>)}
              {!this.props.bare && (<FormHelperText>{prop.description}</FormHelperText>)}
              <FormControlLabel
                control={(
                  <Switch
                    checked={!!prop.value}
                    onChange={this.handlePropChange.bind(this)}
                    color="default"
                  />
                )}
                label={!!prop.value ? 'Enabled' : 'Disabled'}
                style={{ marginBottom: '-10px'}}
              />
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
          <FormControl>
            {!this.props.bare && (<InputLabel shrink={shrink}>{name}</InputLabel>)}
            <Select
              value={prop.value}
              onChange={this.handlePropChange.bind(this)}
            >
              {items.map(item => (
                <MenuItem value={item.value}>{item.value === undefined
                  ? (<em>{item.name}</em>)
                  : item.name
                }</MenuItem>
              ))}
            </Select>
            {!this.props.bare && (<FormHelperText>{prop.description}</FormHelperText>)}
          </FormControl>
        );
        break;
      case 'pagegroup':
      case ConfigEditor.PropertyType.Array:
        propertySetter = (
          <TableProp
            data={prop}
            label={!this.props.bare && name}
            helperText={!this.props.bare && prop.description}
          />
        );
        break;
      case ConfigEditor.PropertyType.Object:
        const subProps = (
          <Collapse in={prop.value} style={{marginLeft: '30px'}}>
            {prop.childProperties && prop.childProperties
              .filter(childProp => childProp.subType !== ConfigEditor.PropSubType.Id)
              .map(childProp => (
                <Property {...this.props} prop={childProp} />
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
            label={!!prop.value ? 'Enabled' : 'Disabled'}
            style={{ marginBottom: '-10px'}}
          />
        );
        marginTop += 16;
        propertySetter = (
          <div style={{marginBottom: '10px'}}>
            {!this.props.bare && (<InputLabel>{name}</InputLabel>)}
            {!this.props.bare && (<FormHelperText>{prop.description}</FormHelperText>)}
            {enableObject}
            {subProps}
          </div>
        );
        break;
      default:
        throw Error(`Unknown property type ${prop.type}`);
    }

    return propertySetter && (
      <div style={{marginTop: this.props.bare ? undefined : marginTop + 'px'}}>
        {propertySetter}
      </div>
    );
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

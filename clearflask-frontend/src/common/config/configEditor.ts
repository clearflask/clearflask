import * as schema from '../../api/schema/schema-1.0.0.json';
import { Config } from '../../api/admin/models/Config.js';

// TODO
// Use cases:
// - Settings page
// - In memory editing

interface Page {
  path:ConfigPath;
  name:string;
  title:string;
  description?:string;
  childPages?:Page[];
  properties?:Property[];
}

type Property = 
  StringProperty
  |NumberProperty
  |IntegerProperty
  |BooleanProperty
  |EnumProperty
  |ArrayProperty
  |ObjectProperty
  |LinkProperty
  |DateTimeProperty;

interface PropertyBase {
  type:string;
  value:any;
  path:ConfigPath;
  name:string;
  description?:string;
  required:boolean;
}

interface StringProperty extends PropertyBase {
  type:'StringProperty';
  value:string;
  valueType;
  validation?:RegExp;
}

interface NumberProperty extends PropertyBase {
  type:'NumberProperty';
  value:number;
}

interface IntegerProperty extends PropertyBase {
  type:'IntegerProperty';
}

interface BooleanProperty extends PropertyBase {
  type:'BooleanProperty';
  value:boolean;
}

interface EnumProperty extends PropertyBase {
  type:'EnumProperty';
  enum:string[];
}

interface ArrayProperty extends PropertyBase {
  type:'ArrayProperty';
  itemProperty:Property;
  // Since the Array type is unknown, use this method to
  // create a new property and then use method propertyArrayInsert
  // to actually insert it into the Array.
  create:()=>Property;
}

interface ObjectProperty extends PropertyBase {
  type:'ObjectProperty';
  value:void;
  properties:Property[];
}

interface LinkProperty extends PropertyBase {
  type:'LinkProperty';
}

interface DateTimeProperty extends PropertyBase {
  type:'DateTimeProperty';
}

type ConfigPath = string[];

interface ConfigEditor {

  clone():ConfigEditor;
  getConfig():Config;

  listPages(path?:ConfigPath):Page[];

  propertySet<P extends Property>(
    property:P|ConfigPath,
    value:P['value'])
    :void;
  propertyArrayInsert<P extends ArrayProperty>(
    property:P|ConfigPath,
    value:ReturnType<P['create']>,
    index?:number)
    :void;
  propertyArrayDelete(
    property:ArrayProperty|ConfigPath,
    index:number)
    :void;
}

export class ConfigEditorImpl implements ConfigEditor {
  readonly config:Config;

  constructor(config:Config) {
    this.config = config;
  }

  clone():ConfigEditor {
    return new ConfigEditorImpl(
      JSON.parse(
        JSON.stringify(
          this.config)));
  }
  getConfig():Config {
    return this.config;
  }

  listPages(path?:ConfigPath):Page[] {
    return []; // TODO
  }

  propertySet<P extends Property>(
    property:P|ConfigPath,
    value:P['value'])
    :void {
    // TODO
  }
  propertyArrayInsert<P extends ArrayProperty>(
    property:P|ConfigPath,
    value:ReturnType<P['create']>,
    index?:number)
    :void {
    // TODO
  }
  propertyArrayDelete(
    property:ArrayProperty|ConfigPath,
    index:number)
    :void {
    // TODO
  }
}

import * as Schema from '../../api/schema/schema-1.0.0.json';
import { Config } from '../../api/admin/models/Config.js';

/**
 * OpenApi vendor properties.
 */

export enum OpenApiTags {
  Page = 'x-clearflask-page', // Single page
  PageGroup = 'x-clearflask-page-group', // Dynamic group of pages
  Prop = 'x-clearflask-prop', // Property
}
export interface xCfPage {
  name?:string;
  order?:number;
  title?:string;
  description?:string;
}
export interface xCfPageGroup {
  name?:string;
  order?:number;
  title?:string;
  description?:string;
}
export interface xCfProp {
  name?:string;
  order?:number;
  title?:string;
  description?:string;
  placeholder?:string;
  /**
   * Default value to set for newly created property.
   * Must be set when non-array non-object property is set as required
   * For array and object properties, value must be an array and object
   * respecitvely with proper children property types. Default values
   * are overriden if an array or object does not set a required property.
   */
  defaultValue?:any;
}

/**
 * Settings objects
 */

export interface Page extends xCfPage {
  type:'Page';
  value?:any;
  path:Path;
  depth:ResolveDepth;
  getPages():Page[];
  getPageGroups():PageGroup[];
  getProperties():Property[];
}

export interface PageGroup extends xCfPageGroup {
  type:'PageGroup';
  path:Path;
  depth:ResolveDepth;
  minItems?:number;
  maxItems?:number;
  getPages():Page[];
  /** Use this method to create a new entry, then call groupPageInsert to commit. */
  create:()=>Property;
}

export type Property =
  StringProperty
  |NumberProperty
  |IntegerProperty
  |BooleanProperty
  |EnumProperty
  |ArrayProperty
  |ObjectProperty;

interface PropertyBase<T> extends xCfProp{
  type:string;
  path:Path;
  required:boolean;
  value?:T;
  set(val:T):void;
  setDefault():void;
}

export interface StringProperty extends PropertyBase<string> {
  type:'string';
  minLength?:number;
  maxLength?:number;
  validation?:RegExp;
  format?:StringFormat|string;
}

export interface NumberProperty extends PropertyBase<number> {
  type:'number';
  multipleOf?:number;
}

export interface IntegerProperty extends PropertyBase<number> {
  type:'integer';
  multipleOf?:number;
}

export interface BooleanProperty extends PropertyBase<boolean> {
  type:'boolean';
}

export interface EnumProperty extends PropertyBase<string> {
  type:'enum';
  enumValues:string[];
  enumNames:string[];
}

/**
 * Array 
 * If isRequired is false, value determines whether the object is undefined
 * or set. If set, default values are set
 * 
 * TODO add support for uniqueItems
 */
export interface ArrayProperty extends PropertyBase<true|undefined> {
  type:'array';
  minItems?:number;
  maxItems?:number;
  childProperties?:Property[];
  /** Creates a new entry. Index is location where to insert otherwise at the end. */
  insert(index?:number):void;
  /** Deletes entry at specified location */
  delete(index:number):void;
}

/**
 * Object has two functionalities:
 * - If isRequired is true, value is always true and this simply functions
 *   as a grouping of other properties.
 * - If isRequired is false, value determines whether the object is undefined
 *   or set. If set, all 'properties' become visible.
 */
export interface ObjectProperty extends PropertyBase<true|undefined> {
  type:'object';
  childProperties?:Property[];
}

/**
 * Other
 */

export enum ResolveDepth {
  None = 0, // Does not resolve pages nor properties
  Shallow = 1, // Resolves only one level of pages and properties
  Deep = 2, // Resolve all immediately
}

export enum StringFormat {
  'Link' = 'link',
  'Date' = 'date',
  'DateTime' = 'date-time',
  'Password' = 'password',
  'Byte' = 'byte',
  'Binary' = 'binary',
}

/**
 * Universal path used for both schema and config instance.
 * String parts correspond to object values; numbers correpsond to array indices.
 * 
 * Ex: ['ideaSettings', 'tags', 3, 'color']
 */
export type Path = (string|number)[];

interface ConfigEditor {

  clone():ConfigEditor;
  getConfig():Config;

  getPage(path:Path, depth?:ResolveDepth):Page;
  getPageGroup(path:Path, depth?:ResolveDepth):PageGroup;
  getProperty(path:Path):Property;

  setValue(path:Path, value:any):void;
  // propertySet<P extends Property>(prop:P, value:P['value']):void;
  // propertyArrayInsert<P extends ArrayProperty>(prop:P, valueProp:ReturnType<P['create']>, index?:number):void;
  // propertyArrayDelete(prop:ArrayProperty, index:number):void;
  // groupPageInsert(group:PageGroup, valuePage:Page, index?:number):void;
  // groupPageDelete(group:PageGroup, index:number):void;
}

export class ConfigEditorImpl implements ConfigEditor {
  config:Config;
  cache:{[path: string]: Page|PageGroup|Property} = {};

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

  getPage(path:Path, depth:ResolveDepth = ResolveDepth.None, subSchema?:any):Page {
    var result:Page|PageGroup|Property = this.getFromCache(path, () => this.parsePage(path, depth, subSchema), depth);
    if(result.type !== 'Page') {
      throw Error(`Expecting page type but found ${result.type} on path ${path}`);
    }
    return result;
  }

  getPageGroup(path:Path, depth:ResolveDepth = ResolveDepth.None, subSchema?:any):PageGroup {
    var result:Page|PageGroup|Property = this.getFromCache(path, () => this.parsePageGroup(path, depth, subSchema), depth);
    if(result.type !== 'PageGroup') {
      throw Error(`Expecting page group type but found ${result.type} on path ${path}`);
    }
    return result;
  }

  getProperty(path:Path, isRequired?:boolean, subSchema?:any):Property {
    var result:Page|PageGroup|Property = this.getFromCache(path, () => this.parseProperty(path, isRequired, subSchema));
    if(result.type === 'Page' || result.type === 'PageGroup') {
      throw Error(`Expecting property type but found ${result.type} on path ${path}`);
    }
    return result;
  }

  getFromCache(path:Path, loader:()=>Page|PageGroup|Property, minDepth:ResolveDepth = ResolveDepth.None):Page|PageGroup|Property {
    const key = this.getCacheKey(path);
    var result:Page|PageGroup|Property = this.cache[key];
    if(!result || ((result.type === 'Page' || result.type === 'PageGroup') && result.depth < depth)) {
      result = loader();
      this.cache[key] = result;
    }
    return result;
  }

  getValue(path:Path, subConfig?:any):any {
    return path.reduce(
      (subConfig, nextKey) => subConfig[nextKey]
          || (() => {throw Error(`Cannot find ${subConfig && 'sub'}config value for key ${nextKey} in path ${path}`)})(),
      subConfig || this.config);
  }

  setValue(path:Path, value:any):void {
    if(path.length === 0) {
      this.config = value;
      return;
    }
    this.getValue(path.slice(0, -1))[path[path.length - 1]] = value;
  }

  // propertySet<P extends Property>(prop:P, value:P['value']):void {
  //   if(prop.required && value === undefined) {
  //     throw Error(`Cannot assign undefined value to required property ${prop.path}`);
  //   }
  //   this.setValue(prop.path, value);
  //   prop.value = value;
  // }

  // propertyArrayInsert<P extends ArrayProperty>(prop:P, valueProp:ReturnType<P['create']>, index?:number):void {
  //   const arr = this.getValue(prop.path);
  //   if(index) {
  //     arr.splice(index, 0, valueProp.value);
  //     prop.value.splice(index, 0, valueProp);
  //   } else {
  //     arr.push(valueProp.value);
  //     prop.value.push(valueProp);
  //   }
  // }

  // propertyArrayDelete(prop:ArrayProperty, index:number):void {
  //   const arr = this.getValue(prop.path);
  //   arr.splice(index, 1);
  //   prop.value.splice(index, 1);
  // }

  // groupPageInsert(group:PageGroup, valuePage:Page, index?:number):void {
  //   const arr = this.getValue(group.path);
  //   if(index) {
  //     arr.splice(index, 0, valuePage.value);
  //     group.getPages().splice(index, 0, valuePage.value);
  //   } else {
  //     arr.push(valuePage.value);
  //     group.getPages().push(valuePage);
  //   }
  // }
  // groupPageDelete(group:PageGroup, index:number):void {
  //   const arr = this.getValue(group.path);
  //   arr.splice(index, 1);
  //   group.getPages().splice(index, 1);
  // }

  getCacheKey(path:Path):string {
    return path.map(k => typeof k === 'string' ? k : '[]').join(':');
  }

  getSubSchema(path:Path, schema:any = Schema):any {
    return path.reduce(
      (subSchema, nextKey) =>
        this.skipPaths(subSchema, ['allOf', 'properties'])
          [typeof nextKey === 'number' ? 'items' : nextKey]
            || (() => {throw Error(`Cannot find ${nextKey} in path ${path}`)})(),
      schema);
  }

  skipPaths(schema:any, pathsToSkip:string[]):any {
    pathsToSkip.forEach(pathToSkip => {
      if(schema[pathToSkip]) {
        schema = [pathToSkip]
      };
    });
    return schema;
  }

  parsePage(path:Path, depth:ResolveDepth, subSchema?:any):Page {
    const pageSchema = subSchema || this.getSubSchema(path);
    const xPage = pageSchema[OpenApiTags.Page] as xCfPage;
    if(!xPage) {
      throw Error(`No page found on path ${path}`);
    }

    var getPages:()=>Page[];
    var getPageGroups:()=>PageGroup[];
    var getProperties:()=>Property[];

    switch(depth) {
      case ResolveDepth.Deep:
      case ResolveDepth.Shallow:
        const pages:Page[] = [];
        const groups:PageGroup[] = [];
        const props:Property[] = [];
        const objSchema = this.skipPaths(pageSchema, ['allOf']);
        const propsSchema = objSchema.properties
          || (() => {throw Error(`Cannot find 'properties' under path ${path}`)})();
        const requiredProps = objSchema.required || {};
        Object.keys(propsSchema).forEach(propName => {
          const propPath = [...path, propName];
          const propSchema = this.getSubSchema([propName], propsSchema);
          if(propSchema[OpenApiTags.Page]) {
            pages.push(this.getPage(
              propPath,
              depth === ResolveDepth.Shallow ? ResolveDepth.None : depth,
              propSchema));
          } else if(propSchema[OpenApiTags.PageGroup]) {
            groups.push(this.getPageGroup(
              propPath,
              depth === ResolveDepth.Shallow ? ResolveDepth.None : depth,
              propSchema));
          } else {
            props.push(this.getProperty(
              propPath,
              !!requiredProps[propName],
              propsSchema));
          }
        });
        pages.sort((l,r) => ((l.order || l.name) + '').localeCompare(((l.order || l.name) + '')));
        groups.sort((l,r) => ((l.order || l.name) + '').localeCompare(((l.order || l.name) + '')));
        props.sort((l,r) => ((l.order || l.name) + '').localeCompare(((l.order || l.name) + '')));
        getPages = () => pages;
        getPageGroups = () => groups;
        getProperties = () => props;
        break;
      default:
      case ResolveDepth.None:
        getPages = () => this.getPage(path, ResolveDepth.Shallow, pageSchema).getPages();
        getPageGroups = () => this.getPage(path, ResolveDepth.Shallow, pageSchema).getPageGroups();
        getProperties = () => this.getPage(path, ResolveDepth.Shallow, pageSchema).getProperties();
      break;
    }

    const page:Page = {
      ...xPage,
      type: 'Page',
      path: path,
      depth: depth,
      getPages: getPages,
      getPageGroups: getPageGroups,
      getProperties: getProperties,
    };
    return page;
  }

  parsePageGroup(path:Path, depth:ResolveDepth, subSchema?:any):PageGroup {
    const pageGroupSchema = subSchema || this.getSubSchema(path);
    const xPageGroup = pageGroupSchema[OpenApiTags.PageGroup] as xCfPageGroup;
    if(!xPageGroup) {
      throw Error(`No page group found on path ${path}`);
    }

    var getPages:()=>Page[];

    switch(depth) {
      case ResolveDepth.Deep:
      case ResolveDepth.Shallow:
        const count = this.getValue(path).length;
        const pages:Page[] = [];
        for(let i = 0; i < count; i++) {
          pages.push(this.getPage([...path, i], depth, pageGroupSchema.items));
        }
        pages.sort((l,r) => ((l.order || l.name) + '').localeCompare(((l.order || l.name) + '')));
        getPages = () => pages;
        break;
      default:
      case ResolveDepth.None:
        getPages = () => this.getPageGroup(path, ResolveDepth.Shallow, pageGroupSchema).getPages();
      break;
    }

    const pageGroup:PageGroup = {
      ...xPageGroup,
      type: 'PageGroup',
      path: path,
      depth: depth,
      minItems: pageGroupSchema.minItems,
      maxItems: pageGroupSchema.maxItems,
      getPages: getPages,
    };
    return pageGroup;
  }

  parseProperty(path:Path, isRequired?:boolean, subSchema?:any, valueOverride:any = null):Property {
    if(path.length === 0) {
      throw Error(`Property cannot be on root on path ${path}`);
    }
    var propSchema;
    if(isRequired !== undefined && subSchema !== undefined) {
      propSchema = subSchema;
    } else {
      const parentSchema = this.getSubSchema(path.slice(0, path.length - 1));
      const propName = path[path.length - 1];
      propSchema = parentSchema.properties && parentSchema.properties[propName]
        || (() => {throw Error(`Cannot find property on path ${path}`)})();
      isRequired = !!(parentSchema.required && parentSchema.required[propName]);
    }
    if(propSchema[OpenApiTags.Page]) {
      throw Error(`Page found instead of property on path ${path}`);
    }
    var property:Property;
    const xProp = propSchema[OpenApiTags.Prop] as xCfProp;
    const setFun = (val:any):void => {
      this.setValue(path, val);
      property.value = val;
    };
    const setDefaultFun = ():void => {
      this.setValue(path, property.defaultValue);
      property.value = property.defaultValue;
    }
    const base:PropertyBase<any> = {
      ...xProp,
      type: 'unknown',
      path: path,
      required: isRequired,
      set: setFun,
      setDefault: setDefaultFun,
    };
    const value = valueOverride == null ? this.getValue(path) : valueOverride;
    switch(propSchema.type || 'object') {
      case 'string':
        property = {
          ...base,
          type: 'string',
          value: value,
          minLength: propSchema.minLength,
          maxLength: propSchema.maxLength,
          validation: propSchema.pattern && new RegExp(propSchema.pattern),
          format: propSchema.format,
        };
        break;
      case 'number':
      case 'integer':
        property = {
          ...base,
          type: propSchema.type,
          value: value,
          multipleOf: propSchema.multipleOf,
        };
        break;
      case 'boolean':
        property = {
          ...base,
          type: 'boolean',
          value: value,
        };
        break;
      case 'array':
        const readChildProperties = ():Property[]|undefined => {
          const arr = this.getValue(path);
          var childProperties:Property[]|undefined;
          if(arr) {
            childProperties = [];
            for(let i = 0; i < arr.length; i++) {
              // TODO should this really be set to required by default?
              childProperties.push(this.getProperty([...path, i], true, propSchema.items));
              // TODO
            }
          }
          return childProperties;
        }
        property = {
          ...base,
          type: 'array',
          value: value,
          minItems: propSchema.minItems,
          maxItems: propSchema.maxItems,
          childProperties: readChildProperties(),
          set: (val:true|undefined):void => {
            setFun(val);
            const arrayProperty = property as ArrayProperty;
            var newChildProperties;
            if(val) {
              newChildProperties = [];
              if(arrayProperty.minItems && arrayProperty.minItems > 0) {
                for(let i = 0; i < arrayProperty.minItems; i++) newChildProperties.push(undefined);
              }
            } else {
              newChildProperties = undefined;
            }
            this.setValue(path, undefined);
            arrayProperty.childProperties = readChildProperties();
            arrayProperty.childProperties && arrayProperty.childProperties.forEach(p => p.setDefault());
          },
          setDefault: ():void => {
            setDefaultFun();
            const newChildProperties = readChildProperties();
            (property as ArrayProperty).childProperties = newChildProperties;
            newChildProperties && newChildProperties.forEach(p => p.setDefault());
          },
          insert: (index?:number):Property => {
            if(!property.value) throw Error(`Cannot insert to array property when disabled for path ${path}`);
            const arr = this.getValue(path);
            if(index) {
              arr.splice(index, 0, undefined);
            } else {
              arr.push(undefined);
            }
            const newChildProperties = readChildProperties();
            (property as ArrayProperty).childProperties = newChildProperties;
            var newChildProperty = newChildProperties![index !== undefined ? index : (arrayProperty.childProperties.length - 1)]
            newChildProperty.setDefault();
            return newChildProperty;
          },
          delete: (index:number):void => {
            if(!property.value) throw Error(`Cannot delete in array property when disabled for path ${path}`);
            const arr = this.getValue(path);
            arr.splice(index, 1);
            (property as ArrayProperty).childProperties = readChildProperties();
          },
        };
        break;
      case 'object':
        const propsSchema = propSchema.properties
          || (() => {throw Error(`Cannot find 'properties' under path ${path}`)})();
        const requiredProps = propSchema.required || {};
        const props:Property[] = Object.keys(propSchema.properties).map(propName =>
          this.getProperty([...path, propName], !!requiredProps[propName], propsSchema));
        const create = () => props.map(prop => {})
          // TODO
        // TODO sort below
        // groups.sort((l,r) => ((l.order || l.name) + '').localeCompare(((l.order || l.name) + '')));
        property = {
          ...base,
          type: 'object',
          value: value,
          childProperties: props, // TODO
          set: (val:true|undefined):void => {
            // TODO
          },
          setDefault: ():void => {
            // TODO
          },
        };
        break;
      default:
        throw Error(`Unknown type ${propSchema.type} in path ${path}`);
    }
    return property;
  }
}

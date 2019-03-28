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
  defaultValue?:true|undefined;
}
export interface xCfPageGroup {
  name?:string;
  order?:number;
  title?:string;
  description?:string;
  defaultValue?:true|undefined;
}
export interface xCfProp {
  name?:string;
  order?:number;
  title?:string;
  description?:string;
  placeholder?:string;
  defaultValue?:any;
  enumNames?:string[] // EnumProperty only
}

/**
 * Settings objects
 */

export interface Setting<T> {
  type:string;
  path:Path;
  required:boolean;
  value?:T;
  set(val:T):void;
  setDefault():void;
}

export interface Page extends Setting<true|undefined>, xCfPage {
  type:'Page';
  depth:ResolveDepth;
  getChildren():PageChildren;
}
export interface PageChildren {
  pages: Page[];
  groups: PageGroup[];
  props: Property[];
}

export interface PageGroup extends Setting<true|undefined>, xCfPageGroup {
  type:'PageGroup';
  depth:ResolveDepth;
  minItems?:number;
  maxItems?:number;
  getChildPages():Page[];
  insertChildPage(index?:number):void;
  deleteChildPage (index:number):void;
}

interface PropertyBase<T> extends Setting<T>, xCfProp {}
export type Property =
  StringProperty
  |NumberProperty
  |IntegerProperty
  |BooleanProperty
  |EnumProperty
  |ArrayProperty
  |ObjectProperty;

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
  insert(index?:number):void;
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
    if(!result || ((result.type === 'Page' || result.type === 'PageGroup') && result.depth < minDepth)) {
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

  sortPagesProps(l:Page|PageGroup|Property, r:Page|PageGroup|Property) {
    return ((l.order || l.name) + '')
      .localeCompare(((r.order || r.name) + ''));
  }

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

  parsePage(path:Path, depth:ResolveDepth, isRequired?:boolean, subSchema?:any):Page {
    const xPage = pageSchema[OpenApiTags.Page] as xCfPage;
    if(!xPage) {
      throw Error(`No page found on path ${path}`);
    }

    var pageSchema;
    if(isRequired !== undefined && subSchema !== undefined) {
      pageSchema = subSchema;
    } else {
      pageSchema = this.getSubSchema(path);
      if(path.length === 0) {
        isRequired = true;
      } else {
        const parentSchema = this.getSubSchema(path.slice(0, path.length - 1));
        const propName = path[path.length - 1];
        isRequired = !!(parentSchema.required && parentSchema.required[propName]);
      }
    }

    const fetchChildren = ():PageChildren => {
      const children:PageChildren = {
        pages: [],
        groups: [],
        props: [],
      };
      const objSchema = this.skipPaths(pageSchema, ['allOf']);
      const propsSchema = objSchema.properties
        || (() => {throw Error(`Cannot find 'properties' under path ${path}`)})();
      const requiredProps = objSchema.required || {};
      Object.keys(propsSchema).forEach(propName => {
        const propPath = [...path, propName];
        const propSchema = this.getSubSchema([propName], propsSchema);
        if(propSchema[OpenApiTags.Page]) {
          children.pages.push(this.getPage(
            propPath,
            depth === ResolveDepth.Shallow ? ResolveDepth.None : depth,
            propSchema));
        } else if(propSchema[OpenApiTags.PageGroup]) {
          children.groups.push(this.getPageGroup(
            propPath,
            depth === ResolveDepth.Shallow ? ResolveDepth.None : depth,
            propSchema));
        } else {
          children.props.push(this.getProperty(
            propPath,
            !!requiredProps[propName],
            propsSchema));
        }
      });
      children.pages.sort(this.sortPagesProps);
      children.groups.sort(this.sortPagesProps);
      children.props.sort(this.sortPagesProps);
      return children;
    };
    var cachedChildren:PageChildren|undefined = depth === ResolveDepth.None ? undefined : fetchChildren();
    const getChildren = ():PageChildren => (cachedChildren === undefined && (cachedChildren = fetchChildren()), cachedChildren);

    const page:Page = {
      defaultValue: isRequired ? true : undefined,
      ...xPage,
      type: 'Page',
      value: this.getValue(path) === undefined ? undefined : true,
      path: path,
      required: isRequired,
      depth: depth,
      getChildren: getChildren,
      set: (val:true|undefined):void => {
        if(!val && isRequired) throw Error(`Cannot unset a required page for path ${path}`)
        this.setValue(path, val === true ? {} : undefined);
        cachedChildren = fetchChildren();
        cachedChildren.pages.forEach(childProp => childProp.setDefault());
        cachedChildren.groups.forEach(childProp => childProp.setDefault());
        cachedChildren.props.forEach(childProp => childProp.setDefault());
        page.value = val;
      },
      setDefault: ():void => {
        page.set(page.defaultValue);
      },
    };
    return page;
  }

  parsePageGroup(path:Path, depth:ResolveDepth, isRequired?:boolean, subSchema?:any):PageGroup {
    const xPageGroup = pageGroupSchema[OpenApiTags.PageGroup] as xCfPageGroup;
    if(!xPageGroup) {
      throw Error(`No page group found on path ${path}`);
    }

    var pageGroupSchema;
    if(isRequired !== undefined && subSchema !== undefined) {
      pageGroupSchema = subSchema;
    } else {
      pageGroupSchema = this.getSubSchema(path);
      if(path.length === 0) {
        isRequired = true;
      } else {
        const parentSchema = this.getSubSchema(path.slice(0, path.length - 1));
        const propName = path[path.length - 1];
        isRequired = !!(parentSchema.required && parentSchema.required[propName]);
      }
    }

    const fetchChildPages = ():Page[] => {
      const count = this.getValue(path).length;
      const pages:Page[] = [];
      for(let i = 0; i < count; i++) {
        pages.push(this.getPage(
          [...path, i],
          depth === ResolveDepth.Shallow ? ResolveDepth.None : depth,
          pageGroupSchema.items));
      }
      pages.sort(this.sortPagesProps);
      return pages;
    };
    var cachedPages: Page[]|undefined = depth === ResolveDepth.None ? undefined : fetchChildPages();
    const getPages = ():Page[] => (cachedPages === undefined && (cachedPages = fetchChildPages()), cachedPages);

    const pageGroup:PageGroup = {
      ...xPageGroup,
      type: 'PageGroup',
      value: this.getValue(path) === undefined ? undefined : true,
      path: path,
      required: isRequired,
      depth: depth,
      minItems: pageGroupSchema.minItems,
      maxItems: pageGroupSchema.maxItems,
      getChildPages: getPages,
      insertChildPage: (index?:number):void => {
        const arr = this.getValue(path);
        if(index) {
          arr.splice(index, 0, undefined);
        } else {
          arr.push(undefined);
        }
        cachedPages = fetchChildPages()
        cachedPages[
          index !== undefined
            ? index
            : cachedPages.length - 1]
              .setDefault();
      },
      deleteChildPage: (index:number):void => {
        const arr = this.getValue(path);
        arr.splice(index, 1);
        cachedPages = depth === ResolveDepth.None ? undefined : fetchChildPages()
      },
      set: (val:true|undefined):void => {
        if(!val && isRequired) throw Error(`Cannot unset a required page group for path ${path}`)
        this.setValue(path, val === true
          ? new Array(pageGroup.minItems ? pageGroup.minItems : 0)
          : undefined);
          cachedPages = fetchChildPages();
        cachedPages.forEach(childProp => childProp.setDefault());
        pageGroup.value = val;
      },
      setDefault: ():void => {
        pageGroup.set(pageGroup.defaultValue);
      },
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
      setFun(property.defaultValue);
    }
    const base:PropertyBase<any> = {
      ...xProp,
      type: 'unknown', // Will be overriden by subclass
      path: path,
      required: isRequired,
      set: setFun,
      setDefault: setDefaultFun,
    };
    const value = valueOverride === null ? this.getValue(path) : valueOverride;
    switch(propSchema.type || 'object') {
      case 'string':
        if(propSchema.enum){
          if(!propSchema.enum.length || propSchema.enum.length === 0) throw Error(`Expecting enum to contain more than one value on path ${path}`);
          if(xProp.enumNames && xProp.enumNames.length != propSchema.enum.length) throw Error(`Expecting 'enumNames' length to match enum values on path ${path}`);
          property = {
            defaultValue: isRequired ? propSchema.enum[0] : undefined,
            ...base,
            type: 'enum',
            value: value,
            enumValues: propSchema.enum,
            enumNames: xProp.enumNames || propSchema.enum,
          };
        } else {
          property = {
            defaultValue: isRequired ? '' : undefined,
            ...base,
            type: 'string',
            value: value,
            minLength: propSchema.minLength,
            maxLength: propSchema.maxLength,
            validation: propSchema.pattern && new RegExp(propSchema.pattern),
            format: propSchema.format,
          };
        }
        break;
      case 'number':
      case 'integer':
        property = {
          defaultValue: isRequired ? 0 : undefined,
          ...base,
          type: propSchema.type,
          value: value,
          multipleOf: propSchema.multipleOf,
        };
        break;
      case 'boolean':
        property = {
          defaultValue: isRequired ? false : undefined,
          ...base,
          type: 'boolean',
          value: value,
        };
        break;
      case 'array':
        const fetchChildPropertiesArray = ():Property[]|undefined => {
          const arr = this.getValue(path);
          var childProperties:Property[]|undefined;
          if(arr) {
            childProperties = [];
            for(let i = 0; i < arr.length; i++) {
              childProperties.push(this.getProperty([...path, i], true, propSchema.items));
            }
            childProperties.sort(this.sortPagesProps);
          }
          return childProperties;
        }
        property = {
          defaultValue: isRequired ? true : undefined,
          ...base,
          type: 'array',
          value: value === undefined ? undefined : true,
          minItems: propSchema.minItems,
          maxItems: propSchema.maxItems,
          childProperties: fetchChildPropertiesArray(),
          set: (val:true|undefined):void => {
            if(!val && isRequired) throw Error(`Cannot unset a required array prop for path ${path}`)
            const arrayProperty = property as ArrayProperty;
            this.setValue(path, val === true
              ? new Array(arrayProperty.minItems ? arrayProperty.minItems : 0)
              : undefined);
            arrayProperty.childProperties = fetchChildPropertiesArray();
            arrayProperty.childProperties && arrayProperty.childProperties.forEach(p => p.setDefault());
            arrayProperty.value = val;
          },
          insert: (index?:number):void => {
            if(!property.value) throw Error(`Cannot insert to array property when disabled for path ${path}`);
            const arr = this.getValue(path);
            if(index) {
              arr.splice(index, 0, undefined);
            } else {
              arr.push(undefined);
            }
            const newChildProperties = fetchChildPropertiesArray();
            const arrayProperty:ArrayProperty = (property as ArrayProperty);
            arrayProperty.childProperties = newChildProperties;
            newChildProperties![
              index !== undefined
                ? index
                : arrayProperty.childProperties!.length - 1]
                  .setDefault();
          },
          delete: (index:number):void => {
            if(!property.value) throw Error(`Cannot delete in array property when disabled for path ${path}`);
            const arr = this.getValue(path);
            arr.splice(index, 1);
            (property as ArrayProperty).childProperties = fetchChildPropertiesArray();
          },
        };
        break;
      case 'object':
        const fetchChildPropertiesObject = ():Property[]|undefined => {
          const obj = this.getValue(path);
          var childProperties:Property[]|undefined;
          if(obj) {
            childProperties = [];
            const childPropsSchema = propSchema.properties
              || (() => {throw Error(`Cannot find 'properties' under path ${path}`)})();
            const requiredProps = propSchema.required || {};
            Object.keys(childPropsSchema).forEach(propName => {
              const propSchema = 
              childProperties!.push(this.getProperty(
                [...path, propName],
                !!requiredProps[propName],
                this.getSubSchema([propName], childPropsSchema)));
            });
            childProperties.sort(this.sortPagesProps);
          }
          return childProperties;
        }
        property = {
          defaultValue: isRequired ? {} : undefined,
          ...base,
          type: 'object',
          value: value === undefined ? undefined : true,
          childProperties: fetchChildPropertiesObject(),
          set: (val:true|undefined):void => {
            if(!val && isRequired) throw Error(`Cannot unset a required object prop for path ${path}`)
            const objectProperty = property as ObjectProperty;
            this.setValue(path, val === true
              ? {}
              : undefined);
            objectProperty.childProperties = fetchChildPropertiesObject();
            objectProperty.childProperties && objectProperty.childProperties.forEach(childProp => childProp.setDefault());
            objectProperty.value = val;
          },
        };
        break;
      default:
        throw Error(`Unknown type ${propSchema.type} in path ${path}`);
    }
    return property;
  }
}

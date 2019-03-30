import Schema from '../../api/schema/schema-1.0.0.json';
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
  description?:string;
  defaultValue?:true|undefined;
  menuDefaultExpanded?:boolean;
}
export interface xCfPageGroup {
  name?:string;
  order?:number;
  description?:string;
  defaultValue?:true|undefined;
  menuDefaultExpanded?:boolean;
  /** Properties to show on main PageGroup page inside table */
  tablePropertyNames:string[] 
}
export interface xCfProp {
  name?:string;
  order?:number;
  description?:string;
  placeholder?:string;
  defaultValue?:any;
  /** EnumProperty only */
  enumNames?:string[]
}

/**
 * Settings objects
 */

export interface Setting<T> {
  type:PageType|PageGroupType|PropertyType;
  path:Path;
  required:boolean;
  value?:T;
  set(val:T):void;
  setDefault():void;
}

export type PageType = 'page';
export interface Page extends Setting<true|undefined>, xCfPage {
  type:PageType;
  name:string;
  depth:ResolveDepth;
  getChildren():PageChildren;
  cachedChildren?:PageChildren; // Internal use only
}
export interface PageChildren {
  pages: Page[];
  groups: PageGroup[];
  props: Property[];
}

export type PageGroupType = 'pagegroup';
export interface PageGroup extends Setting<true|undefined>, xCfPageGroup {
  type:PageGroupType;
  name:string;
  depth:ResolveDepth;
  minItems?:number;
  maxItems?:number;
  getChildPages():Page[];
  insert(index?:number):void;
  delete(index:number):void;
  cachedChildPages?:Page[]; // Internal use only
}

interface PropertyBase<T> extends Setting<T>, xCfProp {
  name:string;
}
export enum PropertyType {
  String = 'string',
  Number = 'number',
  Integer = 'integer',
  Boolean = 'boolean',
  Enum = 'enum',
  Array = 'array',
  Object = 'object'
}
export type Property =
  StringProperty
  |NumberProperty
  |IntegerProperty
  |BooleanProperty
  |EnumProperty
  |ArrayProperty
  |ObjectProperty;

export interface StringProperty extends PropertyBase<string> {
  type:PropertyType.String;
  minLength?:number;
  maxLength?:number;
  validation?:RegExp;
  format?:StringFormat|string;
}

export interface NumberProperty extends PropertyBase<number> {
  type:PropertyType.Number;
  multipleOf?:number;
}

export interface IntegerProperty extends PropertyBase<number> {
  type:PropertyType.Integer;
  multipleOf?:number;
}

export interface BooleanProperty extends PropertyBase<boolean> {
  type:PropertyType.Boolean;
}

export interface EnumProperty extends PropertyBase<string> {
  type:PropertyType.Enum;
  items:EnumItem[];
}
export interface EnumItem {
  name:string;
  value:string;
}

/**
 * Array 
 * If isRequired is false, value determines whether the object is undefined
 * or set. If set, default values are set
 * 
 * TODO add support for uniqueItems
 */
export interface ArrayProperty extends PropertyBase<true|undefined> {
  type:PropertyType.Array;
  minItems?:number;
  maxItems?:number;
  childType:PropertyType;
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
  type:PropertyType.Object;
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

export default interface Editor {

  clone():Editor;
  getConfig():Config;

  getPage(path:Path, depth?:ResolveDepth):Page;
  getPageGroup(path:Path, depth?:ResolveDepth):PageGroup;
  getPageOrPageGroup(path:Path, depth?:ResolveDepth):Page|PageGroup;
  getProperty(path:Path):Property;

  setValue(path:Path, value:any):void;

  subscribe(id:string, callback:()=>void);
  unsubscribe(id:string);
}

export class EditorImpl implements Editor {
  config:Config;
  cache:{[path: string]: Page|PageGroup|Property} = {};
  subscribers:{[id:string]: ()=>void} = {};

  constructor(config?:Config) {
    this.config = config as Config;
    // TODO initialize empty config
    if(!this.config) {
      this.getPage([]).setDefault();
    }
  }

  clone():Editor {
    return new EditorImpl(
      JSON.parse(
        JSON.stringify(
          this.config)));
  }

  getConfig():Config {
    return this.config;
  }

  subscribe(id: string, callback: () => void) {
    this.subscribers[id] = callback;
  }

  unsubscribe(id: string) {
    delete this.subscribers[id];
  }
  notify() {
    Object.values(this.subscribers).forEach(s => s());
  }

  getPage(path:Path, depth:ResolveDepth = ResolveDepth.None, subSchema?:any):Page {
    var result:Page|PageGroup|Property = this.getFromCache(path, () => this.parsePage(path, depth, subSchema), depth);
    if(result.type !== 'page') {
      throw Error(`Expecting page type but found ${result.type} on path ${path}`);
    }
    return result;
  }

  getPageGroup(path:Path, depth:ResolveDepth = ResolveDepth.None, subSchema?:any):PageGroup {
    var result:Page|PageGroup|Property = this.getFromCache(path, () => this.parsePageGroup(path, depth, subSchema), depth);
    if(result.type !== 'pagegroup') {
      throw Error(`Expecting page group type but found ${result.type} on path ${path}`);
    }
    return result;
  }

  getPageOrPageGroup(path:Path, depth:ResolveDepth = ResolveDepth.None, subSchema?:any):Page|PageGroup {
    var result:Page|PageGroup|Property = this.getFromCache(path, () => this.parsePageOrPageGroup(path, depth, subSchema), depth);
    if(result.type !== 'page' && result.type !== 'pagegroup' ) {
      throw Error(`Expecting page or page group type but found ${result.type} on path ${path}`);
    }
    return result;
  }

  getProperty(path:Path, isRequired?:boolean, subSchema?:any):Property {
    var result:Page|PageGroup|Property = this.getFromCache(path, () => this.parseProperty(path, isRequired, subSchema));
    if(result.type === 'page' || result.type === 'pagegroup') {
      throw Error(`Expecting property type but found ${result.type} on path ${path}`);
    }
    return result;
  }

  getFromCache(path:Path, loader:()=>Page|PageGroup|Property, minDepth:ResolveDepth = ResolveDepth.None):Page|PageGroup|Property {
    const key = this.getCacheKey(path);
    var result:Page|PageGroup|Property = this.cache[key];
    if(!result || ((result.type === 'page' || result.type === 'pagegroup') && result.depth < minDepth)) {
      result = loader();
      this.cache[key] = result;
    }
    return result;
  }

  getValue(path:Path, subConfig?:any):any {
    return path.reduce(
      (subConfig, nextKey) => subConfig && subConfig[nextKey],
      subConfig || this.config);
  }

  setValue(path:Path, value:any):void {
    if(path.length === 0) {
      this.config = value;
    } else {
      const parent = this.getValue(path.slice(0, -1));
      if(value === undefined) {
        if(typeof path[path.length - 1] === 'number') {
          parent.splice(path[path.length - 1], 1);
        } else {
          delete parent[path[path.length - 1]];
        }
      } else {
        parent[path[path.length - 1]] = value;
      }
    }
  }

  sortPagesProps(l:Page|PageGroup|Property, r:Page|PageGroup|Property) {
    return ((l.order || l.name) + '')
      .localeCompare(((r.order || r.name) + ''));
  }

  getCacheKey(path:Path):string {
    return path.join(':');
  }

  getSubSchema(path:Path, schema:any = Schema):any {
    return this.mergeAllOf(path.reduce(
      (subSchema, nextKey) =>
        this.skipPaths(this.mergeAllOf(subSchema), ['properties'])
          [typeof nextKey === 'number' ? 'items' : nextKey]
            || (() => {throw Error(`Cannot find ${nextKey} in path ${path}`)})(),
      schema));
  }

  mergeAllOf(schema:any):any {
    return schema['allOf'] !== undefined
      ? {
        ...schema['allOf'].reduce((result, next) => Object.assign(result, next), {}),
        properties: schema['allOf'].reduce((result, next) => Object.assign(result, next['properties']), {}),
        required: schema['allOf'].reduce((result, next) => result.concat(next['required'] || []), []),
      }
      : schema;
  }

  skipPaths(schema:any, pathsToSkip:string[]):any {
    pathsToSkip.forEach(pathToSkip => {
      if(schema[pathToSkip]) {
        schema = schema[pathToSkip]
      };
    });
    return schema;
  }

  parsePageOrPageGroup(path:Path, depth:ResolveDepth, isRequired?:boolean, subSchema?:any):Page|PageGroup {
    var schema;
    if(isRequired !== undefined && subSchema !== undefined) {
      schema = subSchema;
    } else {
      schema = this.getSubSchema(path);
      if(path.length === 0) {
        isRequired = true;
      } else {
        const parentSchema = this.getSubSchema(path.slice(0, path.length - 1));
        const propName = path[path.length - 1];
        isRequired = !!(parentSchema.required && parentSchema.required.includes(propName));
      }
    }

    if(schema[OpenApiTags.Page]) {
      return this.parsePage(path, depth, isRequired, schema);
    } else if(schema[OpenApiTags.PageGroup]) {
      return this.parsePageGroup(path, depth, isRequired, schema);
    } else {
      throw Error(`Found neither age nor page group on path ${path}`);
    }
  }

  parsePage(path:Path, depth:ResolveDepth, isRequired?:boolean, subSchema?:any):Page {
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
        isRequired = !!(parentSchema.type === 'array' || parentSchema.required && parentSchema.required.includes(propName));
      }
    }

    const xPage = pageSchema[OpenApiTags.Page] as xCfPage;
    if(!xPage) {
      throw Error(`No page found on path ${path}`);
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
      const requiredProps = objSchema.required || [];
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
            requiredProps.includes(propName),
            propSchema));
        }
      });
      children.pages.sort(this.sortPagesProps);
      children.groups.sort(this.sortPagesProps);
      children.props.sort(this.sortPagesProps);
      return children;
    };
    const getChildren = ():PageChildren => (page.cachedChildren === undefined && (page.cachedChildren = fetchChildren()), page.cachedChildren);

    const page:Page = {
      defaultValue: isRequired ? true : undefined,
      name: path.join('.'),
      ...xPage,
      type: 'page',
      value: this.getValue(path) === undefined ? undefined : true,
      path: path,
      required: isRequired,
      depth: depth,
      getChildren: getChildren,
      set: (val:true|undefined):void => {
        if(!val && isRequired) throw Error(`Cannot unset a required page for path ${path}`)
        this.setValue(path, val === true ? {} : undefined);
        if(val) {
          page.cachedChildren = fetchChildren();
          page.cachedChildren.pages.forEach(childPage => childPage.setDefault());
          page.cachedChildren.groups.forEach(childPageGroup => childPageGroup.setDefault());
          page.cachedChildren.props.forEach(childProp => childProp.setDefault());
        } else {
          page.cachedChildren = {
            pages: [],
            groups: [],
            props: [],
          };
        }
        page.value = val;
        this.notify();
      },
      setDefault: ():void => {
        page.set(page.defaultValue);
      },
      cachedChildren: depth === ResolveDepth.None ? undefined : fetchChildren(),
    };
    return page;
  }

  parsePageGroup(path:Path, depth:ResolveDepth, isRequired?:boolean, subSchema?:any):PageGroup {
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
        isRequired = !!(parentSchema.type === 'array' || parentSchema.required && parentSchema.required.includes(propName));
      }
    }

    const xPageGroup = pageGroupSchema[OpenApiTags.PageGroup] as xCfPageGroup;
    if(!xPageGroup) {
      throw Error(`No page group found on path ${path}`);
    }

    const fetchChildPages = ():Page[] => {
      const value = this.getValue(path);
      const count = value && value.length;
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
    const getPages = ():Page[] => (pageGroup.cachedChildPages === undefined && (pageGroup.cachedChildPages = fetchChildPages()), pageGroup.cachedChildPages);

    const pageGroup:PageGroup = {
      defaultValue: isRequired ? true : undefined,
      name: path.join('.'),
      ...xPageGroup,
      type: 'pagegroup',
      value: this.getValue(path) === undefined ? undefined : true,
      path: path,
      required: isRequired,
      depth: depth,
      minItems: pageGroupSchema.minItems,
      maxItems: pageGroupSchema.maxItems,
      getChildPages: getPages,
      insert: (index?:number):void => {
        const arr = this.getValue(path);
        if(index) {
          arr.splice(index, 0, undefined);
        } else {
          arr.push({});
        }
        pageGroup.cachedChildPages = fetchChildPages()
        pageGroup.cachedChildPages[
          index !== undefined
            ? index
            : pageGroup.cachedChildPages.length - 1]
              .setDefault();
        this.notify();
      },
      delete: (index:number):void => {
        const arr = this.getValue(path);
        arr.splice(index, 1);
        pageGroup.cachedChildPages = depth === ResolveDepth.None ? undefined : fetchChildPages()
        this.notify();
      },
      set: (val:true|undefined):void => {
        if(!val && isRequired) throw Error(`Cannot unset a required page group for path ${path}`)
        this.setValue(path, val === true
          ? new Array(pageGroup.minItems ? pageGroup.minItems : 0)
          : undefined);
        if(val) {
          pageGroup.cachedChildPages = fetchChildPages();
          pageGroup.cachedChildPages.forEach(childPage => childPage.setDefault());
        } else {
          pageGroup.cachedChildPages = [];
        }
        pageGroup.value = val;
        this.notify();
      },
      setDefault: ():void => {
        pageGroup.set(pageGroup.defaultValue);
      },
      cachedChildPages: depth === ResolveDepth.None ? undefined : fetchChildPages(),
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
      isRequired = !!(parentSchema.type === 'array' || parentSchema.required && parentSchema.required.includes(propName));
    }
    if(propSchema[OpenApiTags.Page] || propSchema[OpenApiTags.PageGroup]) {
      throw Error(`Page or pagegroup found instead of property on path ${path}`);
    }

    var property:Property;
    const xProp = propSchema[OpenApiTags.Prop] as xCfProp;

    const setFun = (val:any):void => {
      this.setValue(path, val);
      property.value = val;
      this.notify();
    };
    const setDefaultFun = ():void => {
      setFun(property.defaultValue);
    }
    const base = {
      name: path.join('.'),
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
          if(xProp && xProp.enumNames && xProp.enumNames.length != propSchema.enum.length) throw Error(`Expecting 'enumNames' length to match enum values on path ${path}`);
          const items:EnumItem[] = new Array(propSchema.enum.length);
          for (let i = 0; i < propSchema.enum.length; i++) {
            items[i] = {
              name: xProp && xProp.enumNames || propSchema.enum,
              value: propSchema.enum,
            };
          }
          property = {
            defaultValue: isRequired ? propSchema.enum[0] : undefined,
            ...base,
            type: PropertyType.Enum,
            value: value,
            items: items,
          };
        } else {
          property = {
            defaultValue: isRequired ? '' : undefined,
            ...base,
            type: PropertyType.String,
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
          type: PropertyType.Boolean,
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
          type: PropertyType.Array,
          value: value === undefined ? undefined : true,
          minItems: propSchema.minItems,
          maxItems: propSchema.maxItems,
          childType: propSchema.items.type || 'object',
          childProperties: fetchChildPropertiesArray(),
          set: (val:true|undefined):void => {
            if(!val && isRequired) throw Error(`Cannot unset a required array prop for path ${path}`)
            const arrayProperty = property as ArrayProperty;
            if(val) {
              this.setValue(path, new Array(arrayProperty.minItems ? arrayProperty.minItems : 0));
              arrayProperty.childProperties = fetchChildPropertiesArray();
              arrayProperty.childProperties && arrayProperty.childProperties.forEach(p => p.setDefault());
            } else {
              this.setValue(path, undefined);
              arrayProperty.childProperties = undefined;
            }
            arrayProperty.value = val;
            this.notify();
          },
          setDefault: ():void => {
            const arrayProperty = property as ArrayProperty;
            arrayProperty.set(arrayProperty.defaultValue);
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
            this.notify();
          },
          delete: (index:number):void => {
            if(!property.value) throw Error(`Cannot delete in array property when disabled for path ${path}`);
            const arr = this.getValue(path);
            arr.splice(index, 1);
            (property as ArrayProperty).childProperties = fetchChildPropertiesArray();
            this.notify();
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
            const requiredProps = propSchema.required || [];
            Object.keys(childPropsSchema).forEach(propName => {
              childProperties!.push(this.getProperty(
                [...path, propName],
                requiredProps.includes(propName),
                this.getSubSchema([propName], childPropsSchema)));
            });
            childProperties.sort(this.sortPagesProps);
          }
          return childProperties;
        }
        property = {
          defaultValue: isRequired ? {} : undefined,
          ...base,
          type: PropertyType.Object,
          value: value === undefined ? undefined : true,
          childProperties: fetchChildPropertiesObject(),
          set: (val:true|undefined):void => {
            if(!val && isRequired) throw Error(`Cannot unset a required object prop for path ${path}`)
            const objectProperty = property as ObjectProperty;
            if(val) {
              this.setValue(path, {});
              objectProperty.childProperties = fetchChildPropertiesObject();
              objectProperty.childProperties && objectProperty.childProperties.forEach(childProp => childProp.setDefault());
            } else {
              this.setValue(path, undefined);
              objectProperty.childProperties = undefined;
            }
            this.setValue(path, val === true
              ? {}
              : undefined);
            objectProperty.value = val;
            this.notify();
          },
          setDefault: ():void => {
            const objectProperty = property as ObjectProperty;
            objectProperty.set(objectProperty.defaultValue);
          },
        };
        break;
      default:
        throw Error(`Unknown type ${propSchema.type} in path ${path}`);
    }
    return property;
  }
}

import Schema from '../../api/schema/schema-1.0.0.json';
import { Config } from '../../api/admin/models/Config.js';
import randomUuid from '../util/uuid';

/**
 * OpenApi vendor properties.
 */

export enum OpenApiTags {
  /**
   * Single page
   * Must either be root, or parent must be another Page or PageGroup.
   */
  Page = 'x-clearflask-page',
  /**
   * Dynamic group of pages
   * Must either be root, or parent must be another Page or PageGroup.
   */
  PageGroup = 'x-clearflask-page-group',
  /** Property */
  Prop = 'x-clearflask-prop',
  /**
   * Property Link
   * Links value of a string to an id of another array item.
   * Can be on a string property or array of string property.
   */
  PropLink = 'x-clearflask-prop-link',
}
export interface xCfPage {
  name?:string;
  nameFromProp?:string;
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
  subType?:PropSubType
  /** EnumProperty only */
  enumNames?:string[]
}
export enum PropSubType {
  /**
   * A string property hidden from user and auto filled with unique value.
   * Used inside an array of objects with a property link.
   */
  Id = 'id',
  Color = 'color',
}
export interface xCfPropLink {
  /**
   * Path to array.
   * '<>' will be replaced by current path entry,
   * useful when crossing another array.
   */
  linkPath:string[];
  /** If set, links to this prop name. Otherwise links to the array index */
  idPropName:string;
  /** List of child properties to display */
  showPropNames?:string[];
}

/**
 * Settings objects
 */

export type Unsubscribe = () => void;
export interface Setting<T> {
  type:PageType|PageGroupType|PropertyType;
  path:Path;
  pathStr:string;
  required:boolean;
  value?:T;
  set(val:T):void;
  setDefault():void;
  errorMsg?:string;
  validateValue(val:T):string|undefined;
  /** Subscribe to updates on this path only */
  subscribe(callback:()=>void):Unsubscribe;
}

export type PageType = 'page';
export const PageType:PageType = 'page';
export interface Page extends Setting<true|undefined>, xCfPage {
  type:PageType;
  name:string;
  /** Name potentially derived from a property */
  getDynamicName:()=>string;
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
export const PageGroupType:PageGroupType = 'pagegroup';
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
  Link = 'link',
  Number = 'number',
  Integer = 'integer',
  Boolean = 'boolean',
  Enum = 'enum',
  Array = 'array',
  Object = 'object'
}
export type Property =
  StringProperty
  |LinkProperty
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

export interface LinkProperty extends PropertyBase<string>, xCfPropLink {
  type:PropertyType.Link;
  /** Shows current options and list of properties to show for readonly */
  getOptions():LinkPropertyOption[];
}
export interface LinkPropertyOption {
  id:string;
  readonlyProps: Property[];
}

export interface NumberProperty extends PropertyBase<number> {
  type:PropertyType.Number;
  minimum?:number;
  maximum?:number;
}

export interface IntegerProperty extends PropertyBase<number> {
  type:PropertyType.Integer;
  minimum?:number;
  maximum?:number;
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
  Date = 'date',
  DateTime = 'date-time',
  Time = 'time',
}

/**
 * Universal path used for both schema and config instance.
 * String parts correspond to object values; numbers correpsond to array indices.
 * 
 * Ex: ['ideaSettings', 'tags', 3, 'color']
 */
export type Path = (string|number)[];
export const parsePath = (pathStr:string|undefined, delimiter:string|RegExp = /[.\/]/):Path => {
  if(!pathStr) {
    return [];
  }
  return pathStr
    .split(delimiter)
    .map(pStr => {
      const pNum = +pStr;
      return isNaN(pNum) ? pStr : pNum;
    });
}

export interface Editor {

  clone():Editor;
  getConfig():Config;

  get(path:Path, depth?:ResolveDepth):Page|PageGroup|Property;
  getPage(path:Path, depth?:ResolveDepth):Page;
  getPageGroup(path:Path, depth?:ResolveDepth):PageGroup;
  getProperty(path:Path):Property;

  setValue(path:Path, value:any):void;

  /** Subscribe to all updates in config */
  subscribe(callback:()=>void):Unsubscribe;
}

export class EditorImpl implements Editor {
  config:Config;
  cache:any = {};
  globalSubscribers:{[subscriberId:string]:()=>void} = {};

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

  subscribe(callback: () => void):Unsubscribe {
    const subscriberId = randomUuid();
    this.globalSubscribers[subscriberId] = callback;
    return () => delete this.globalSubscribers[subscriberId];
  }

  _subscribe(callback: () => void, subscribers:{[subscriberId:string]:()=>void}):Unsubscribe {
    const subscriberId = randomUuid();
    subscribers[subscriberId] = callback;
    return () => delete subscribers[subscriberId];
  }

  notify(localSubscribers:{[subscriberId:string]:()=>void}):void {
    Object.values(localSubscribers).forEach(notify => notify());
    Object.values(this.globalSubscribers).forEach(notify => notify());
  }

  getConfig():Config {
    return this.config;
  }

  get(path:Path, depth:ResolveDepth = ResolveDepth.None, subSchema?:any):Page|PageGroup|Property {
    return this.cacheGet(path, () => this.parse(path, depth, subSchema), depth);
  }

  getPage(path:Path, depth:ResolveDepth = ResolveDepth.None, isRequired?:boolean, subSchema?:any):Page {
    var result:Page|PageGroup|Property = this.cacheGet(path, () => this.parsePage(path, depth, isRequired, subSchema), depth);
    if(result.type !== 'page') {
      throw Error(`Expecting page type but found ${result.type} on path ${path}`);
    }
    return result;
  }

  getPageGroup(path:Path, depth:ResolveDepth = ResolveDepth.None, isRequired?:boolean, subSchema?:any):PageGroup {
    var result:Page|PageGroup|Property = this.cacheGet(path, () => this.parsePageGroup(path, depth, isRequired, subSchema), depth);
    if(result.type !== 'pagegroup') {
      throw Error(`Expecting page group type but found ${result.type} on path ${path}`);
    }
    return result;
  }

  getProperty(path:Path, isRequired?:boolean, subSchema?:any):Property {
    var result:Page|PageGroup|Property = this.cacheGet(path, () => this.parseProperty(path, isRequired, subSchema));
    if(result.type === 'page' || result.type === 'pagegroup') {
      throw Error(`Expecting property type but found ${result.type} on path ${path}`);
    }
    return result;
  }

  cacheGet(path:Path, loader:()=>Page|PageGroup|Property, minDepth:ResolveDepth = ResolveDepth.None):Page|PageGroup|Property {
    var pointer = this.cache;
    for (let i = 0; i < path.length; i++) {
      var nextPointer = pointer[path[i]];
      if(nextPointer === undefined) {
        nextPointer = {};
        pointer[path[i]] = nextPointer;
      }
      pointer = nextPointer;
    }
    var value = pointer._;
    if(value === undefined || (value['depth'] || 0) < minDepth) {
      value = loader();
      pointer._ = value;
    }
    return value;
  }

  cacheInvalidate(path:Path):void {
    if(path.length === 0) {
      this.cache = {};
      return;
    }
    var pointer = this.cache;
    for (let i = 0; i < path.length - 1; i++) {
      pointer = pointer[path[i]];
      if(pointer === undefined) {
        return;
      }
    }
    delete pointer[path[path.length - 1]];
  }

  getOrDefaultValue(path:Path, defaultValue:any, subConfig?:any):any {
    if(path.length === 0) {
      if(this.config === undefined) {
        this.config = defaultValue;
      }
      return this.config;
    } else {
      const parent = this.getValue(path.slice(0, -1));
      if(parent[path[path.length - 1]] === undefined) {
        parent[path[path.length - 1]] = defaultValue;
      }
      return parent[path[path.length - 1]];
    }
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

  sortPagesProps(l:Page|PageGroup|Property, r:Page|PageGroup|Property):number {
    return (l.order || l.name) > (r.order || r.name) ? 1 : -1;
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

  parse(path:Path, depth:ResolveDepth, isRequired?:boolean, subSchema?:any):Page|PageGroup|Property {
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
      return this.parseProperty(path, isRequired, schema);
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
        || (() => {throw Error(`Cannot find 'properties' under path ${path} ${Object.keys(objSchema)}`)})();
      const requiredProps = objSchema.required || [];
      Object.keys(propsSchema).forEach(propName => {
        const propPath = [...path, propName];
        const propSchema = this.getSubSchema([propName], propsSchema);
        if(propSchema[OpenApiTags.Page]) {
          children.pages.push(this.getPage(
            propPath,
            depth === ResolveDepth.Shallow ? ResolveDepth.None : depth,
            requiredProps.includes(propName),
            propSchema));
        } else if(propSchema[OpenApiTags.PageGroup]) {
          children.groups.push(this.getPageGroup(
            propPath,
            depth === ResolveDepth.Shallow ? ResolveDepth.None : depth,
            requiredProps.includes(propName),
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
    const getChildren = ():PageChildren => {
      if(!page.cachedChildren || page.cachedChildren === undefined) {
        page.cachedChildren = fetchChildren();
      }
      return page.cachedChildren;
    };
    const pathStr = path.join('.');
    const localSubscribers:{[subscriberId:string]:()=>void} = {};
    var dynamicNameUnsubscribe:(()=>void)|undefined = undefined;

    const page:Page = {
      defaultValue: isRequired ? true : undefined,
      name: pathStr,
      ...xPage,
      type: 'page',
      value: this.getValue(path) === undefined ? undefined : true,
      path: path,
      pathStr: pathStr,
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
        this.notify(localSubscribers);
      },
      setDefault: ():void => {
        page.set(page.defaultValue);
      },
      getDynamicName: ():string => {
        if(!xPage.nameFromProp) {
          return page.name;
        }
        const nameProp = page.getChildren().props.find(p => p.path[p.path.length - 1] === xPage.nameFromProp);
        if(dynamicNameUnsubscribe === undefined && nameProp) {
          dynamicNameUnsubscribe = nameProp.subscribe(() => this.notify(localSubscribers));
        }
        return (nameProp && nameProp.value)
          ? nameProp.value + '' : page.name;
      },
      validateValue: (val:true|undefined):string|undefined => {
        if(val === undefined && isRequired) return 'Required value';
        return undefined;
      },
      subscribe: (callback: () => void):Unsubscribe => {
        return this._subscribe(callback, localSubscribers);
      },
      cachedChildren: depth === ResolveDepth.None ? undefined : fetchChildren(),
    };
    page.errorMsg = page.validateValue(page.value);
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
          true,
          pageGroupSchema.items));
      }
      return pages;
    };
    const getPages = ():Page[] => {
      if(pageGroup.cachedChildPages === undefined) {
        pageGroup.cachedChildPages = fetchChildPages();
      }
      return pageGroup.cachedChildPages;
    };
    const pathStr = path.join('.');
    const localSubscribers:{[subscriberId:string]:()=>void} = {};

    const pageGroup:PageGroup = {
      defaultValue: isRequired ? true : undefined,
      name: pathStr,
      ...xPageGroup,
      type: 'pagegroup',
      value: this.getValue(path) === undefined ? undefined : true,
      path: path,
      pathStr: pathStr,
      required: isRequired,
      depth: depth,
      minItems: pageGroupSchema.minItems,
      maxItems: pageGroupSchema.maxItems,
      getChildPages: getPages,
      insert: (index?:number):void => {
        const arr = this.getOrDefaultValue(path, []);
        if(index !== undefined) {
          arr.splice(index, 0, undefined);
          this.cacheInvalidate(path);
        } else {
          arr.push({});
        }
        pageGroup.cachedChildPages = fetchChildPages()
        pageGroup.cachedChildPages[
          index !== undefined
            ? index
            : pageGroup.cachedChildPages.length - 1]
              .setDefault();
        pageGroup.value = true;
        this.notify(localSubscribers);
      },
      delete: (index:number):void => {
        const arr = this.getValue(path);
        arr.splice(index, 1);
        this.cacheInvalidate(path);
        pageGroup.cachedChildPages = depth === ResolveDepth.None ? undefined : fetchChildPages()
        this.notify(localSubscribers);
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
        this.notify(localSubscribers);
      },
      setDefault: ():void => {
        pageGroup.set(pageGroup.defaultValue);
      },
      validateValue: (val:true|undefined):string|undefined => {
        if(val === undefined && isRequired) return 'Required value';
        if(val === true) {
          const rawValue = this.getValue(path);
          const count = rawValue === undefined ? 0 : rawValue.length;
          if(pageGroup.minItems !== undefined && count < pageGroup.minItems) return `Must have at least ${pageGroup.minItems} entries`;
          if(pageGroup.maxItems !== undefined && count > pageGroup.maxItems) return `Must have at most ${pageGroup.maxItems} entries`;
        }
        return undefined;
      },
      subscribe: (callback: () => void):Unsubscribe => {
        return this._subscribe(callback, localSubscribers);
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

    const localSubscribers:{[subscriberId:string]:()=>void} = {};
    const setFun = (val:any):void => {
      this.setValue(path, val);
      property.value = val;
      property.errorMsg = property.validateValue(val as never);
      this.notify(localSubscribers);
    };
    const setDefaultFun = ():void => {
      setFun(property.defaultValue);
    };
    const validateRequiredFun = (val:any):string|undefined => {
      if(val === undefined && isRequired) return 'Required value';
      return undefined;
    };
    const pathStr = path.join('.');
    const base = {
      name: pathStr,
      ...xProp,
      type: 'unknown', // Will be overriden by subclass
      path: path,
      pathStr: pathStr,
      required: isRequired,
      set: setFun,
      setDefault: setDefaultFun,
      subscribe: (callback: () => void):Unsubscribe => {
        return this._subscribe(callback, localSubscribers);
      },
      validateValue: validateRequiredFun,
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
              name: xProp && xProp.enumNames && xProp.enumNames[i] || propSchema.enum[i],
              value: propSchema.enum[i],
            };
          }
          property = {
            defaultValue: isRequired ? propSchema.enum[0] : undefined,
            ...base,
            type: PropertyType.Enum,
            value: value,
            items: items,
            validateValue: (val:string|undefined):string|undefined => {
              if(val === undefined) return validateRequiredFun(val);
              if(!propSchema.enum.includes(val)) return `Can only be one of: ${JSON.stringify(propSchema.enum)}`;
              return undefined;
            },
          };
        } else if(propSchema[OpenApiTags.PropLink]) {
          const xPropLink = propSchema[OpenApiTags.PropLink] as xCfPropLink;
          var cachedOptions:LinkPropertyOption[]|undefined = undefined;
          const getOptions = ():LinkPropertyOption[] => {
            const targetPath = xPropLink.linkPath.map((pathStep, index) => pathStep === '<>' ? path[index] : pathStep);
            const target:Page|PageGroup|Property = this.get(targetPath);
            if(target.type !== PropertyType.Array && target.type !== PageGroupType) {
              throw Error(`Link property ${path} pointing to non-array non-page-group on path ${targetPath}`);
            }
            if(target.type === PropertyType.Array && target.childType !== PropertyType.Object) {
              throw Error(`Link property ${path} pointing to array of non-objects on path ${targetPath}`);
            }
            const unsubscribe = target.subscribe(() => {
              cachedOptions = undefined;
              unsubscribe();
              this.notify(localSubscribers);
            });
            const options:(Page|ObjectProperty)[] = (target.type === PageGroupType
              ? target.getChildPages()
              : (target.childProperties as ObjectProperty[]) || []);
            return options.map((option:Page|ObjectProperty) => {
              var id:any = undefined;
              const readonlyProps:Property[] = [];
              const props:Property[] = (option.type === PageType
                ? option.getChildren().props
                : option.childProperties || []);
              props.forEach((childProp:Property) => {
                if(childProp.name === xPropLink.idPropName) {
                  id = childProp.value;
                }
                if(!xPropLink.showPropNames || xPropLink.showPropNames.includes(childProp.name)) {
                  readonlyProps.push(childProp);
                }
              });
              if(id === undefined) {
                throw Error(`Link property ${path} idPropName points to non-existent property on path ${targetPath}`);
              }
              if(xPropLink.showPropNames && xPropLink.showPropNames.length !== readonlyProps.length) {
                throw Error(`Link property ${path} showPropNames includes properties that do not exist on path ${targetPath}`);
              }
              return {
                id: id,
                readonlyProps: readonlyProps,
              };
            });
          };

          property = {
            defaultValue: isRequired ? [xPropLink.linkPath] : undefined,
            ...xPropLink,
            ...base,
            type: PropertyType.String,
            value: value,
            getOptions: ():LinkPropertyOption[] => {
              if(cachedOptions === undefined) cachedOptions = getOptions();
              return cachedOptions;
            },
            validateValue: (val:string|undefined):string|undefined => {
              if(val === undefined) return validateRequiredFun(val);
              if(cachedOptions === undefined) cachedOptions = getOptions();
              return cachedOptions.find(o => o.id === val) === undefined
                ? "Invalid reference"
                : undefined;
            },
          };
          break;
        } else {
          var defaultValue;
          if(xProp && xProp.subType === PropSubType.Id) {
            defaultValue = randomUuid();
          } else {
            defaultValue = isRequired ? '' : undefined;
          }
          property = {
            defaultValue: defaultValue,
            ...base,
            type: PropertyType.String,
            value: value,
            minLength: propSchema.minLength,
            maxLength: propSchema.maxLength,
            validation: propSchema.pattern && new RegExp(propSchema.pattern),
            format: propSchema.format,
            validateValue: (val:string|undefined):string|undefined => {
              if(val === undefined) return validateRequiredFun(val);
              const stringProperty = property as StringProperty;
              if(stringProperty.validation !== undefined && !stringProperty.validation.test(val)) return `Invalid value (Requires ${stringProperty.validation})`;
              if(stringProperty.minLength !== undefined && val.length < stringProperty.minLength) return `Must be at least ${stringProperty.minLength} characters`;
              if(stringProperty.maxLength !== undefined && val.length > stringProperty.maxLength) return `Must be at most ${stringProperty.maxLength} characters`;
              return undefined;
            },
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
          validateValue: (val:number|undefined):string|undefined => {
            const numericProperty = property as IntegerProperty|NumberProperty;
            if(val === undefined) return validateRequiredFun(val);
            if(property.type === PropertyType.Integer && val % 1 > 0) return `Must be a whole number`;
            if(numericProperty.minimum !== undefined && val < numericProperty.minimum) return `Must be a minimum of ${numericProperty.minimum}`;
            if(numericProperty.maximum !== undefined && val > numericProperty.maximum) return `Must be a maximum of ${numericProperty.maximum}`;
            return undefined;
          },
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
            arrayProperty.errorMsg = arrayProperty.validateValue(val);
            this.notify(localSubscribers);
          },
          setDefault: ():void => {
            const arrayProperty = property as ArrayProperty;
            arrayProperty.set(arrayProperty.defaultValue);
          },
          insert: (index?:number):void => {
            const arr = this.getOrDefaultValue(path, []);
            if(index !== undefined) {
              arr.splice(index, 0, undefined);
              this.cacheInvalidate(path);
            } else {
              arr.push(undefined);
            }
            const newChildProperties = fetchChildPropertiesArray();
            const arrayProperty:ArrayProperty = (property as ArrayProperty);
            arrayProperty.childProperties = newChildProperties;
            arrayProperty.childProperties![
              index !== undefined
                ? index
                : arrayProperty.childProperties!.length - 1]
                  .setDefault();
            property.value = true;
            arrayProperty.errorMsg = arrayProperty.validateValue(arrayProperty.value);
            this.notify(localSubscribers);
          },
          delete: (index:number):void => {
            if(!property.value) return;
            const arrayProperty = property as ArrayProperty;
            const arr = this.getValue(path);
            arr.splice(index, 1);
            this.cacheInvalidate(path);
            arrayProperty.childProperties = fetchChildPropertiesArray();
            arrayProperty.errorMsg = arrayProperty.validateValue(arrayProperty.value);
            this.notify(localSubscribers);
          },
          validateValue: (val:true|undefined):string|undefined => {
            if(val === undefined) return validateRequiredFun(val);
            const arrayProperty = property as ArrayProperty;
            const count = arrayProperty.childProperties ? arrayProperty.childProperties.length : 0;
            if(arrayProperty.minItems !== undefined && count < arrayProperty.minItems) return `Must have at least ${arrayProperty.minItems} entries`;
            if(arrayProperty.maxItems !== undefined && count > arrayProperty.maxItems) return `Must have at most ${arrayProperty.maxItems} entries`;
            return undefined;
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
          defaultValue: isRequired ? true : undefined,
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
            objectProperty.value = val;
            objectProperty.errorMsg = objectProperty.validateValue(val);
            this.notify(localSubscribers);
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
    property.errorMsg = property.validateValue(property.value as never);
    return property;
  }
}

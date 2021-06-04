import { ConfigAdmin } from '../../api/admin/models/ConfigAdmin';
import Schema from '../../api/schema/schema.json';
import stringToSlug from '../util/slugger';
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
  /** Hide */
  Hide = 'x-clearflask-hide',
  /**
   * Adds an additional property located somewhere else into this object/page
   * as if it was part of it in the first place. Useful When you want to
   * inject a property deeply nested in an object. If the property doesn't
   * exist, it's silently ignored.
   */
  AdditionalProps = 'x-clearflask-additional-props',
}
export interface xCfPage {
  name?: string;
  nameFromProp?: string;
  colorFromProp?: string;
  order?: number;
  description?: string;
  defaultValue?: true | undefined;
}
export interface xCfPageGroup {
  name?: string;
  order?: number;
  description?: string;
  defaultValue?: true | undefined;
  /** Properties to show on main PageGroup page inside table */
  tablePropertyNames: string[];
  /** Prevent re-ordering of items by user. */
  disableReordering?: boolean;
}
export interface xCfProp {
  name?: string;
  order?: number;
  description?: string;
  placeholder?: string | number;
  /**
   * Default value to set on new properties.
   */
  defaultValue?: any;
  subType?: PropSubType;
  /** EnumProperty only */
  enumNames?: string[];
  /**
   * Will autocomplete slug properties with current value.
   * Example: if you set this property to 'Feature Requests',
   * the supplied path will become something like 'feature-requests'.
   * If skipFirst is set, if the path value of this is 0, then auto complete
   * will be disabled. Useful for Page slug should be empty for home page.
   */
  slugAutoComplete?: {
    path: Path;
    skipFirst?: number;
  };
  /** BooleanProperty only.
   * Treat false value as undefined.
   * Useful if you only need two states but don't want to waste space
   * in config with a false value.
   */
  falseAsUndefined?: boolean;
  /** Applicable to arrays only. Prevent re-ordering of items by user. */
  disableReordering?: boolean;
  /** Label to show when value is true */
  trueLabel?: string;
  /** Label to show when value is false */
  falseLabel?: string;
}
export enum PropSubType {
  /**
   * A string property hidden from user and auto filled with unique value.
   * Used inside an array of objects with a property link.
   */
  Id = 'id',
  Color = 'color',
  Emoji = 'emoji',
  KeyGen = 'keygen',
  Multiline = 'multiline',
  Rich = 'rich',
  Icon = 'icon',
}
export interface xCfPropLink {
  /** Path to array */
  linkPath: string[];
  /** If set, links to this prop name. Otherwise links to the array index */
  idPropName: string;
  /** If set, displays the prop value as the name */
  displayPropName: string;
  /** If set, use this color from the prop value */
  colorPropName?: string;
  /** If set, cannot create a new item in place, also implicitly assumed if filter is used below */
  disallowCreate?: boolean;
  /** If set, the special variable <$> will be replaced with a filter
   * In more detail: a special variable <$> will check the path given by the property,
   * retrieve the value of that property (string or string array), and iterate all
   * paths replacing the variable <$> with the values.
   * Example: A filter for statuses needs to only display the statuses for categories that
   * have been filtered.
   */
  filterPath?: string[];
  /** Part of filterPath, shows which property should be considered as id */
  filterIdPropName?: string;
  /** Used with filterPath: if the destination property has no values, use all values */
  filterShowAllIfNone?: boolean;
}
export interface xCfAdditionalProps {
  /** Path to the property */
  props: Array<{
    propPath: string[];
    /**
     * If set, the special variable <&> will be replaced with value of this id prop
     * path and auto-created.
     * In more detail: This is useful when you are under an array path and don't want
     * to have all the items in the array point to the exact same additional prop.
     */
    dynamicIdPropName?: string;
  }>;
}

/**
 * Settings objects
 */

export type Unsubscribe = () => void;
export interface Setting<T extends PageType | PageGroupType | PropertyType, R> {
  /** Unique object key; used in React to determine whether prop changed */
  key: string;
  type: T;
  path: Path;
  pathStr: string;
  required: boolean;
  value?: R | undefined;
  set(val: R | undefined): void;
  setDefault(): void;
  errorMsg?: string;
  /** Validates value and sets the errorMsg accordingly */
  validateValue(val: R | undefined);
  /** Subscribe to updates on this path only */
  subscribe(callback: () => void): Unsubscribe;
}

export type PageType = 'page';
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const PageType: PageType = 'page';
export interface Page extends Setting<PageType, true | undefined>, xCfPage {
  name: string;
  /** Name potentially derived from a property */
  getDynamicName: () => string;
  getColor: () => string | undefined;
  depth: ResolveDepth;
  getChildren(): PageChildren;
  setRaw(val: object | undefined): void;
  cachedChildren?: PageChildren; // Internal use only
}
export interface PageChildren {
  all: (Page | PageGroup | Property)[]
  pages: Page[];
  groups: PageGroup[];
  props: Property[];
}

export type PageGroupType = 'pagegroup';
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const PageGroupType: PageGroupType = 'pagegroup';
export interface PageGroup extends Setting<PageGroupType, true | undefined>, xCfPageGroup {
  name: string;
  depth: ResolveDepth;
  minItems?: number;
  maxItems?: number;
  getChildPages(): Page[];
  insert(index?: number): Page;
  duplicate(sourceIndex: number): Page;
  moveUp(index: number): void;
  moveDown(index: number): void;
  delete(index: number): void;
  setRaw(val: Array<any> | undefined): void;
  cachedChildPages?: Page[]; // Internal use only
}

interface PropertyBase<T extends PageType | PageGroupType | PropertyType, R> extends Setting<T, R>, xCfProp {
  name: string;
  hide: boolean;
}
export enum PropertyType {
  String = 'string',
  Link = 'link',
  LinkMulti = 'linkmulti',
  Number = 'number',
  Integer = 'integer',
  Boolean = 'boolean',
  Enum = 'enum',
  Array = 'array',
  Object = 'object',
  Dict = 'dict',
}
export type Property =
  StringProperty
  | LinkProperty
  | LinkMultiProperty
  | NumberProperty
  | IntegerProperty
  | BooleanProperty
  | EnumProperty
  | ArrayProperty
  | ObjectProperty
  | DictProperty;

export interface StringProperty extends PropertyBase<PropertyType.String, string> {
  minLength?: number;
  maxLength?: number;
  validation?: RegExp;
  format?: StringFormat | string;
}

export interface LinkProperty extends PropertyBase<PropertyType.Link, string>, xCfPropLink {
  allowCreate: boolean;
  create(name: string): void;
  getOptions(): LinkPropertyOption[];
  cachedOptions?: LinkPropertyOption[] // Internal use only
}
export interface LinkPropertyOption {
  id: string;
  name: string;
  color?: string;
}

export interface NumberProperty extends PropertyBase<PropertyType.Number, number> {
  minimum?: number;
  maximum?: number;
}

export interface IntegerProperty extends PropertyBase<PropertyType.Integer, number> {
  minimum?: number;
  maximum?: number;
}

export interface BooleanProperty extends PropertyBase<PropertyType.Boolean, boolean> {
  trueLabel?: string;
  falseLabel?: string;
}

export interface EnumProperty extends PropertyBase<PropertyType.Enum, string> {
  items: EnumItem[];
}
export interface EnumItem {
  name: string;
  value: string;
}

/**
 * Array 
 * If isRequired is false, value determines whether the object is undefined
 * or set. If set, default values are set
 * 
 * TODO add support for uniqueItems
 */
export interface ArrayProperty extends PropertyBase<PropertyType.Array, true> {
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  childType: PropertyType;
  childEnumItems?: EnumItem[]; // Only set if childType === Enum
  childProperties?: Property[];
  insert(index?: number): Property;
  duplicate(sourceIndex: number): Property;
  moveUp(index: number): void;
  moveDown(index: number): void;
  delete(index: number): void;
  setRaw(val: Array<any> | undefined): void;
}

export interface LinkMultiProperty extends PropertyBase<PropertyType.LinkMulti, Set<string>>, xCfPropLink {
  minItems?: number;
  maxItems?: number;
  allowCreate: boolean;
  create(name: string): void;
  insert(linkId: string): void;
  delete(linkId: string): void;
  getOptions(): LinkPropertyOption[];
  cachedOptions?: LinkPropertyOption[] // Internal use only
}

/**
 * Object has two functionalities:
 * - If isRequired is true, value is always true and this simply functions
 *   as a grouping of other properties.
 * - If isRequired is false, value determines whether the object is undefined
 *   or set. If set, all 'properties' become visible.
 */
export interface ObjectProperty extends PropertyBase<PropertyType.Object, true> {
  childProperties?: Property[];
  setRaw(val: object | undefined): void;
}

export interface DictProperty extends PropertyBase<PropertyType.Dict, true> {
  childProperties?: { [key: string]: Property };
  put(key: string): Property;
  delete(key: string): void;
  setRaw(val: object | undefined): void;
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
 * Ex: ['tags', 3, 'color']
 */
export type Path = (string | number)[];
export const parsePath = (pathStr: string | undefined, delimiter: string | RegExp = /[./]/): Path => {
  if (!pathStr) {
    return [];
  }
  return pathStr
    .split(delimiter)
    .map(pStr => {
      const pNum = +pStr;
      return isNaN(pNum) ? pStr : pNum;
    });
}
export const pathToString = (path: Path) => {
  return path.join('.');
}
export const pathEquals = (l: Path, r: Path) => {
  return l.length === r.length && l.every((val, index) => val === r[index]);
}

export interface Editor {

  clone(): Editor;
  getConfig(): ConfigAdmin;
  setConfig(config: ConfigAdmin);
  clearConfig();
  notify();

  get(path: Path, depth?: ResolveDepth): Page | PageGroup | Property;
  getPage(path: Path, depth?: ResolveDepth): Page;
  getPageGroup(path: Path, depth?: ResolveDepth): PageGroup;
  getProperty(path: Path): Property;

  getValue(path: Path): any;
  getOrDefaultValue(path: Path, defaultValue: any): any;
  setValue(path: Path, value: any): void;

  /** Subscribe to all updates in config */
  subscribe(callback: () => void): Unsubscribe;
}

export class EditorImpl implements Editor {
  config: ConfigAdmin;
  cache: any = {};
  globalSubscribers: { [subscriberId: string]: () => void } = {};

  constructor(config?: ConfigAdmin) {
    if (config !== undefined) {
      this.config = config;
    } else {
      this.config = {} as ConfigAdmin;
      this.getPage([]).setDefault();
    }
  }

  clone(): Editor {
    return new EditorImpl(
      JSON.parse(
        JSON.stringify(
          this.config)));
  }

  subscribe(callback: () => void): Unsubscribe {
    const subscriberId = randomUuid();
    this.globalSubscribers[subscriberId] = callback;
    return () => delete this.globalSubscribers[subscriberId];
  }

  _subscribe(callback: () => void, subscribers: { [subscriberId: string]: () => void }): Unsubscribe {
    const subscriberId = randomUuid();
    subscribers[subscriberId] = callback;
    return () => delete subscribers[subscriberId];
  }

  notify(localSubscribers?: { [subscriberId: string]: () => void }): void {
    localSubscribers && Object.values(localSubscribers).forEach(notify => notify());
    Object.values(this.globalSubscribers).forEach(notify => notify());
  }

  getConfig(): ConfigAdmin {
    return this.config;
  }

  setConfig(config: ConfigAdmin) {
    this.config = config;
    this.cacheInvalidate([]);
    this.notify();
  }

  clearConfig(): ConfigAdmin {
    this.config = {} as ConfigAdmin;
    this.getPage([]).setDefault();
    this.cacheInvalidate([]);
    this.notify();
    return this.config;
  }

  get(path: Path, depth: ResolveDepth = ResolveDepth.None, subSchema?: any): Page | PageGroup | Property {
    return this.cacheGet(path, () => this.parse(path, depth, subSchema), depth);
  }

  getPage(path: Path, depth: ResolveDepth = ResolveDepth.None, isRequired?: boolean, subSchema?: any): Page {
    var result: Page | PageGroup | Property = this.cacheGet(path, () => this.parsePage(path, depth, isRequired, subSchema), depth);
    if (result.type !== 'page') {
      throw Error(`Expecting page type but found ${result.type} on path ${path}`);
    }
    return result;
  }

  getPageGroup(path: Path, depth: ResolveDepth = ResolveDepth.None, isRequired?: boolean, subSchema?: any): PageGroup {
    var result: Page | PageGroup | Property = this.cacheGet(path, () => this.parsePageGroup(path, depth, isRequired, subSchema), depth);
    if (result.type !== 'pagegroup') {
      throw Error(`Expecting page group type but found ${result.type} on path ${path}`);
    }
    return result;
  }

  getProperty<T extends Property>(path: Path, isRequired?: boolean, subSchema?: any): T {
    var result: Page | PageGroup | Property = this.cacheGet(path, () => this.parseProperty(path, isRequired, subSchema));
    if (result.type === 'page' || result.type === 'pagegroup') {
      throw Error(`Expecting property type but found ${result.type} on path ${path}`);
    }
    return result as T;
  }

  cacheGet(path: Path, loader: () => Page | PageGroup | Property, minDepth: ResolveDepth = ResolveDepth.None): Page | PageGroup | Property {
    var pointer = this.cache;
    for (let i = 0; i < path.length; i++) {
      var nextPointer = pointer[path[i]];
      if (nextPointer === undefined) {
        nextPointer = {};
        pointer[path[i]] = nextPointer;
      }
      pointer = nextPointer;
    }
    var value = pointer._;
    if (value === undefined || (value['depth'] || 0) < minDepth) {
      value = loader();
      pointer._ = value;
    }
    return value;
  }

  cacheInvalidate(path: Path): void {
    if (path.length === 0) {
      this.cache = {};
      return;
    }
    var pointer = this.cache;
    for (let i = 0; i < path.length - 1; i++) {
      pointer = pointer[path[i]];
      if (pointer === undefined) {
        return;
      }
    }
    delete pointer[path[path.length - 1]];
  }

  cacheInvalidateChildren(path: Path): void {
    var pointer = this.cache;
    for (let i = 0; i < path.length - 1; i++) {
      pointer = pointer[path[i]];
      if (pointer === undefined) {
        return;
      }
    }
    const cacheNode = pointer[path[path.length - 1]];
    if (cacheNode._) {
      pointer[path[path.length - 1]] = { _: cacheNode._ };
    } else {
      delete pointer[path[path.length - 1]];
    }
  }

  getOrDefaultValue(path: Path, defaultValue: any, subConfig?: any): any {
    if (path.length === 0) {
      if (this.config === undefined) {
        this.config = defaultValue;
      }
      return this.config;
    } else {
      const parent = this.getValue(path.slice(0, -1));
      if (parent[path[path.length - 1]] === undefined) {
        parent[path[path.length - 1]] = defaultValue;
      }
      return parent[path[path.length - 1]];
    }
  }

  getValue(path: Path, subConfig?: any): any {
    return path.reduce(
      (subConfig, nextKey) => subConfig && subConfig[nextKey],
      subConfig || this.config);
  }

  setValue(path: Path, value: any): void {
    if (path.length === 0) {
      this.config = value;
    } else {
      const parent = this.getValue(path.slice(0, -1));
      if (value === undefined) {
        if (typeof path[path.length - 1] === 'number') {
          parent.splice(path[path.length - 1], 1);
        } else {
          delete parent[path[path.length - 1]];
        }
      } else {
        parent[path[path.length - 1]] = value;
      }
    }
  }

  sortPagesProps(l: Page | PageGroup | Property, r: Page | PageGroup | Property): number {
    // id subtype needs to initialize first in case a subsequent link points to itself
    return (l['subType'] === 'id' ? -1 : (l.order !== undefined ? l.order : l.name))
      > (r['subType'] === 'id' ? -1 : (r.order !== undefined ? r.order : r.name))
      ? 1
      : -1;
  }

  getCacheKey(path: Path): string {
    return pathToString(path);
  }

  getSubSchema(path: Path, schema: any = Schema): any {
    return this.mergeAllOf(path.reduce(
      (subSchema, nextKey) => {
        var nextSchema = this.mergeAllOf(subSchema);
        if (nextSchema.additionalProperties) {
          // Since schema is same for all dict types, just return the child schema
          // No need to use nextKey here.
          nextSchema = nextSchema.additionalProperties;
        } else {
          nextSchema = this.skipPaths(nextSchema, ['properties']);
          nextSchema = nextSchema[typeof nextKey === 'number' ? 'items' : nextKey];
        }
        if (!nextSchema) {
          throw Error(`Cannot find ${nextKey} in path ${path}`);
        }
        return nextSchema;
      }, schema));
  }

  mergeAllOf(schema: any): any {
    return schema['allOf'] !== undefined
      ? {
        ...schema['allOf'].reduce((result, next) => Object.assign(result, next), {}),
        properties: schema['allOf'].reduce((result, next) => Object.assign(result, next['properties']), {}),
        required: schema['allOf'].reduce((result, next) => result.concat(next['required'] || []), []),
      }
      : schema;
  }

  skipPaths(schema: any, pathsToSkip: string[]): any {
    pathsToSkip.forEach(pathToSkip => {
      if (schema[pathToSkip]) {
        schema = schema[pathToSkip]
      };
    });
    return schema;
  }

  /**
   * Expands relative paths to absolute paths using signs: . ..
   */
  expandRelativePath(path: Path, currPath: Path): Path {
    var absPath: Path = path;
    if (!path || path.length <= 0) {
      absPath = path;
    } else if (path[0] === '.') {
      absPath = [
        ...(currPath.slice(0, currPath.length - 1)),
        ...(path.slice(1)),
      ];
    } else if (path[0] === '..') {
      var dirUps = 1;
      for (var i = 1; i <= path.length; i++) {
        if (path[i] === '..') dirUps++;
      }
      absPath = [
        ...(currPath.slice(0, currPath.length - 1 - dirUps)),
        ...(path.slice(dirUps)),
      ];
    } else {
      absPath = path;
    }
    return absPath;
  }

  parse(path: Path, depth: ResolveDepth, isRequired?: boolean, subSchema?: any): Page | PageGroup | Property {
    var schema;
    if (isRequired !== undefined && subSchema !== undefined) {
      schema = subSchema;
    } else {
      schema = this.getSubSchema(path);
      if (path.length === 0) {
        isRequired = true;
      } else {
        const parentSchema = this.getSubSchema(path.slice(0, path.length - 1));
        const propName = path[path.length - 1];
        isRequired = !!(parentSchema.required && parentSchema.required.includes(propName));
      }
    }

    if (schema[OpenApiTags.Page]) {
      return this.parsePage(path, depth, isRequired, schema);
    } else if (schema[OpenApiTags.PageGroup]) {
      return this.parsePageGroup(path, depth, isRequired, schema);
    } else {
      return this.parseProperty(path, isRequired, schema);
    }
  }

  getEnumItems(propSchema: any): EnumItem[] {
    const xProp = propSchema[OpenApiTags.Prop] as xCfProp;
    if (!propSchema.enum.length || propSchema.enum.length === 0) throw Error(`Expecting enum to contain more than one value`);
    if (xProp && xProp.enumNames && xProp.enumNames.length !== propSchema.enum.length) throw Error(`Expecting 'enumNames' length to match enum values`);
    const items: EnumItem[] = new Array(propSchema.enum.length);
    for (let i = 0; i < propSchema.enum.length; i++) {
      items[i] = {
        name: xProp && xProp.enumNames && xProp.enumNames[i] || propSchema.enum[i],
        value: propSchema.enum[i],
      };
    }
    return items;
  }

  filterPath(path: Path, filterPath: Path, filterIdPropName: string, currPath: Path, subscribe: (p: PageGroupType | Property) => void, filterShowAllIfNone: boolean = false): Path[] {
    const variableIndex = path.indexOf('<$>');
    if (variableIndex === -1) return [path];

    filterPath = this.expandRelativePath(filterPath, currPath);
    const filterTarget = this.get(filterPath);
    var filterIds: Set<string> = new Set();
    if (filterTarget.type === PropertyType.LinkMulti) {
      subscribe(filterTarget);
      if (filterTarget.value !== undefined && filterTarget.value.size > 0) {
        filterIds = new Set([...filterTarget.value]);
      }
    } else if (filterTarget.type === PropertyType.Array && filterTarget.childType === PropertyType.String) {
      subscribe(filterTarget);
      if (filterTarget.childProperties !== undefined && filterTarget.childProperties?.length > 0) {
        filterIds = new Set(filterTarget.childProperties
          .map(childProp => childProp.value as string));
      }
    } else if (filterTarget.type === PropertyType.Link || filterTarget.type === PropertyType.String) {
      if (filterTarget.value !== undefined) {
        filterIds = new Set([filterTarget.value]);
      }
    } else {
      throw Error(`Filtered path ${path} filter ${filterPath} is pointing to an unsupported variable type ${filterTarget.type} ${filterTarget.type === PropertyType.Array ? filterTarget.childType : ''}`)
    }
    if (filterIds.size <= 0 && !filterShowAllIfNone) return [];

    const valuesPath = path.slice(0, variableIndex);
    const valuesTarget = this.get(valuesPath);
    var valuesOptions: (Page | Property)[];
    if (valuesTarget.type === PropertyType.Array) {
      valuesOptions = valuesTarget.childProperties || [];
    } else if (valuesTarget.type === PageGroupType) {
      valuesOptions = valuesTarget.getChildPages() || [];
    } else {
      throw Error(`Filtered path ${path} filter ${filterPath} variable destination pointing to non-array non-page-group on path ${valuesPath}`);
    }
    if (valuesOptions.length <= 0) return [];
    return valuesOptions.reduce<number[]>((result, valueOption, index) => {
      var childProps: Property[];
      if (valueOption.type === PageType) {
        childProps = valueOption.getChildren().props;
      } else if (valueOption.type === PropertyType.Object) {
        childProps = valueOption.childProperties || [];
      } else {
        throw Error(`Filtered path ${path} filter ${filterPath} variable destination pointing to non-array non-page-group on path ${valuesPath}`);
      }
      const id = childProps!.find(prop => {
        const propName = prop.path[prop.path.length - 1];
        return prop.subType === PropSubType.Id && propName === filterIdPropName
      })!.value! as string;
      return ((filterIds.size <= 0 && filterShowAllIfNone)
        || filterIds.has(id))
        ? [...result, index]
        : result;
    }, [])
      .map(index => {
        const newPath = [...path];
        newPath[variableIndex] = index;
        return newPath;
      });
  }

  getLinkOptions(linkProp: LinkProperty | LinkMultiProperty, localSubscribers: { [subscriberId: string]: () => void }, currPath: Path): LinkPropertyOption[] {
    if (linkProp.cachedOptions !== undefined) return linkProp.cachedOptions;
    const targetPath = this.expandRelativePath(linkProp.linkPath, linkProp.path);
    const targets: (PageGroup | ArrayProperty)[] = [];
    const addTarget = (target: Page | PageGroup | Property) => {
      if (target.type !== PropertyType.Array && target.type !== PageGroupType) {
        throw Error(`Link property ${linkProp.path} pointing to non-array non-page-group on path ${target.path}`);
      }
      if (target.type === PropertyType.Array && target.childType !== PropertyType.Object) {
        throw Error(`Link property ${linkProp.path} pointing to array of non-objects on path ${target.path}`);
      }
      targets.push(target);
    };
    const unsubscribes: (() => void)[] = [];
    const subscribe = p => unsubscribes.push(p.subscribe(() => {
      linkProp.cachedOptions = undefined;
      linkProp.validateValue(linkProp.value as any)
      unsubscribes.forEach(u => u());
      this.notify(localSubscribers);
    }));
    if (linkProp.linkPath.includes('<$>')) {
      if (linkProp.filterPath === undefined || linkProp.filterIdPropName === undefined) {
        throw Error(`Link on path ${currPath} has a filter variable <$> but is missing filterPath or filterIdPropName property`)
      }
      const filteredPaths = this.filterPath(linkProp.linkPath, linkProp.filterPath, linkProp.filterIdPropName, currPath, subscribe, linkProp.filterShowAllIfNone);
      filteredPaths.forEach(filteredPath => {
        addTarget(this.get(filteredPath));
      });
    } else {
      addTarget(this.get(targetPath));
    }
    targets.forEach(target => subscribe(target));
    const options: (Page | ObjectProperty)[] = targets.flatMap<Page | ObjectProperty>(target => target.type === PageGroupType
      ? target.getChildPages()
      : (target.childProperties as ObjectProperty[]) || []);
    const linkPropertyOptions = options.map((option: Page | ObjectProperty) => {
      var id: string | undefined = undefined;
      var name: string | undefined = undefined;
      var color: string | undefined = undefined;
      const props: Property[] = (option.type === PageType
        ? option.getChildren().props
        : option.childProperties || []);
      props.forEach((childProp: Property) => {
        if (childProp.type !== PropertyType.String) {
          return;
        }
        const childPropName = childProp.path[childProp.path.length - 1];
        if (childPropName === linkProp.displayPropName) {
          name = childProp.value;
          subscribe(childProp);
        }
        if (childProp.subType === PropSubType.Id
          && childPropName === linkProp.idPropName) {
          id = childProp.value;
          subscribe(childProp);
        }
        if (linkProp.colorPropName !== undefined
          && childProp.subType === PropSubType.Color
          && childPropName === linkProp.colorPropName) {
          color = childProp.value;
          subscribe(childProp);
        }
      });
      if (id === undefined) {
        throw Error(`Link property ${linkProp.path} idPropName '${linkProp.idPropName}' points to non-existent property on path ${targetPath}`);
      }
      const linkPropertyOption: LinkPropertyOption = {
        id: id,
        name: name || id,
        color: color,
      };
      return linkPropertyOption;
    });
    linkProp.cachedOptions = linkPropertyOptions;
    return linkPropertyOptions;
  };

  parseAdditionalProps(objSchema: any, currPath: Path): Property[] {
    const additionalProps: Property[] = [];
    const xAdditionalProps = objSchema[OpenApiTags.AdditionalProps] as xCfAdditionalProps;
    if (!xAdditionalProps) {
      return additionalProps;
    }
    xAdditionalProps.props.forEach(adtlProp => {
      var path = [...adtlProp.propPath];
      if (adtlProp.dynamicIdPropName) {
        var dynamicValue = 'unknown';
        const dynamicIdProp = this.getProperty([...currPath, adtlProp.dynamicIdPropName]);
        if (dynamicIdProp
          && dynamicIdProp.type === PropertyType.String
          && dynamicIdProp.subType === PropSubType.Id) {
          if (!dynamicIdProp.value) {
            dynamicIdProp.setDefault();
          }
          dynamicValue = dynamicIdProp.value!;
        }
        const dynamicIdIndex = adtlProp.propPath.indexOf('<&>');
        // Make sure the dict property is created
        if (dynamicIdIndex >= 0) {
          path[dynamicIdIndex] = dynamicValue;
          const dynamicIdParentProp = this.get(path.slice(0, dynamicIdIndex));
          if (dynamicIdParentProp.type !== PropertyType.Dict) {
            throw Error(`Dynamic ID parent path must be a dict under ${dynamicIdParentProp.pathStr}, found ${dynamicIdParentProp.type}`);
          }
          if (!dynamicIdParentProp.value) {
            dynamicIdParentProp.set(true);
          }
          if (dynamicIdParentProp.childProperties?.[dynamicValue] === undefined) {
            dynamicIdParentProp.put(dynamicValue);
          }
        }
      }
      const parentSchema = this.getSubSchema(path.slice(0, path.length - 1));
      if (!parentSchema) return;
      const propName = path[path.length - 1];
      const propSchema = this.getSubSchema(path);
      if (!propSchema) return;
      const isRequired = !!(parentSchema.type === 'array' || parentSchema.required && parentSchema.required.includes(propName));
      const prop = this.parseProperty(path, isRequired, propSchema);
      prop.hide = false;
      additionalProps.push(prop);
    });
    return additionalProps;
  }

  parsePage(path: Path, depth: ResolveDepth, isRequired?: boolean, subSchema?: any): Page {
    var pageSchema;
    if (isRequired !== undefined && subSchema !== undefined) {
      pageSchema = this.mergeAllOf(subSchema);
    } else {
      pageSchema = this.getSubSchema(path);
      if (path.length === 0) {
        isRequired = true;
      } else {
        const parentSchema = this.getSubSchema(path.slice(0, path.length - 1));
        const propName = path[path.length - 1];
        isRequired = !!(parentSchema.type === 'array' || parentSchema.required && parentSchema.required.includes(propName));
      }
    }

    const xPage = pageSchema[OpenApiTags.Page] as xCfPage;
    if (!xPage) {
      throw Error(`No page found on path ${path}`);
    }

    const fetchChildren = (): PageChildren => {
      const objSchema = this.skipPaths(pageSchema, ['allOf']);
      const children: PageChildren = {
        all: [],
        pages: [],
        groups: [],
        props: [],
      };
      const propsSchema = objSchema.properties
        || (() => { throw Error(`Cannot find 'properties' under path ${path} ${Object.keys(objSchema)}`) })();
      const requiredProps = objSchema.required || [];
      Object.keys(propsSchema).forEach(propName => {
        const propPath = [...path, propName];
        const propSchema = this.getSubSchema([propName], propsSchema);
        if (propSchema[OpenApiTags.Page]) {
          const childPage = this.getPage(
            propPath,
            depth === ResolveDepth.Shallow ? ResolveDepth.None : depth,
            requiredProps.includes(propName),
            propSchema);
          children.all.push(childPage);
          children.pages.push(childPage);
        } else if (propSchema[OpenApiTags.PageGroup]) {
          const childGroup = this.getPageGroup(
            propPath,
            depth === ResolveDepth.Shallow ? ResolveDepth.None : depth,
            requiredProps.includes(propName),
            propSchema);
          children.all.push(childGroup);
          children.groups.push(childGroup);
        } else {
          const childProp = this.getProperty(
            propPath,
            requiredProps.includes(propName),
            propSchema);
          children.all.push(childProp);
          children.props.push(childProp);
        }
      });
      const additionalProps = this.parseAdditionalProps(objSchema, path);
      children.all.push(...additionalProps);
      children.props.push(...additionalProps);
      children.all.sort(this.sortPagesProps);
      children.pages.sort(this.sortPagesProps);
      children.groups.sort(this.sortPagesProps);
      children.props.sort(this.sortPagesProps);
      return children;
    };
    const getChildren = (): PageChildren => {
      if (!page.cachedChildren || page.cachedChildren === undefined) {
        page.cachedChildren = fetchChildren();
      }
      return page.cachedChildren;
    };
    const pathStr = pathToString(path);
    const localSubscribers: { [subscriberId: string]: () => void } = {};
    var dynamicNameUnsubscribe: (() => void) | undefined = undefined;
    var colorUnsubscribe: (() => void) | undefined = undefined;

    const page: Page = {
      key: randomUuid(),
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
      set: (val: true | undefined): void => {
        if (!val && isRequired) throw Error(`Cannot unset a required page for path ${path}`)
        this.setValue(path, val === true ? {} : undefined);
        if (val) {
          page.cachedChildren = fetchChildren();
          page.cachedChildren.pages.forEach(childPage => childPage.setDefault());
          page.cachedChildren.groups.forEach(childPageGroup => childPageGroup.setDefault());
          page.cachedChildren.props.forEach(childProp => childProp.setDefault());
        } else {
          page.cachedChildren = {
            all: [],
            pages: [],
            groups: [],
            props: [],
          };
        }
        page.value = val;
        page.validateValue(page.value);
        this.notify(localSubscribers);
      },
      setDefault: (): void => {
        page.set(page.defaultValue);
      },
      setRaw: (val: object | undefined): void => {
        this.setValue(path, val);
        this.cacheInvalidateChildren(path);
        if (val !== undefined) {
          page.value = true;
          page.cachedChildren = fetchChildren();
        } else {
          page.value = undefined;
          page.cachedChildren = {
            all: [],
            pages: [],
            groups: [],
            props: [],
          };
        }
        page.validateValue(page.value);
        this.notify(localSubscribers);
      },
      getDynamicName: (): string => {
        if (!xPage.nameFromProp) {
          return page.name;
        }
        const nameProp = page.getChildren().props.find(p => p.path[p.path.length - 1] === xPage.nameFromProp);
        if (dynamicNameUnsubscribe === undefined && nameProp) {
          dynamicNameUnsubscribe = nameProp.subscribe(() => this.notify(localSubscribers));
        }
        return (nameProp && nameProp.value)
          ? nameProp.value + '' : page.name;
      },
      getColor: (): string | undefined => {
        if (!xPage.colorFromProp) {
          return;
        }
        const colorProp = page.getChildren().props.find(p => p.path[p.path.length - 1] === xPage.colorFromProp);
        if (colorUnsubscribe === undefined && colorProp) {
          colorUnsubscribe = colorProp.subscribe(() => this.notify(localSubscribers));
        }
        return (colorProp && colorProp.value)
          ? colorProp.value + '' : undefined;
      },
      validateValue: (val: true | undefined): void => {
        if (val === undefined && isRequired) {
          page.errorMsg = 'Required value';
        } else {
          page.errorMsg = undefined;
        }
      },
      subscribe: (callback: () => void): Unsubscribe => {
        return this._subscribe(callback, localSubscribers);
      },
      cachedChildren: depth === ResolveDepth.None ? undefined : fetchChildren(),
    };
    page.validateValue(page.value);
    return page;
  }

  parsePageGroup(path: Path, depth: ResolveDepth, isRequired?: boolean, subSchema?: any): PageGroup {
    var pageGroupSchema;
    if (isRequired !== undefined && subSchema !== undefined) {
      pageGroupSchema = this.mergeAllOf(subSchema);
    } else {
      pageGroupSchema = this.getSubSchema(path);
      if (path.length === 0) {
        isRequired = true;
      } else {
        const parentSchema = this.getSubSchema(path.slice(0, path.length - 1));
        const propName = path[path.length - 1];
        isRequired = !!(parentSchema.type === 'array' || parentSchema.required && parentSchema.required.includes(propName));
      }
    }

    const xPageGroup = pageGroupSchema[OpenApiTags.PageGroup] as xCfPageGroup;
    if (!xPageGroup) {
      throw Error(`No page group found on path ${path}`);
    }

    const fetchChildPages = (): Page[] => {
      const value = this.getValue(path);
      const count = value && value.length;
      const pages: Page[] = [];
      for (let i = 0; i < count; i++) {
        pages.push(this.getPage(
          [...path, i],
          depth === ResolveDepth.Shallow ? ResolveDepth.None : depth,
          true,
          pageGroupSchema.items));
      }
      return pages;
    };
    const getPages = (): Page[] => {
      if (pageGroup.cachedChildPages === undefined) {
        pageGroup.cachedChildPages = fetchChildPages();
      }
      return pageGroup.cachedChildPages;
    };
    const pathStr = pathToString(path);
    const localSubscribers: { [subscriberId: string]: () => void } = {};

    const pageGroup: PageGroup = {
      key: randomUuid(),
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
      insert: (index?: number): Page => {
        const arr = this.getOrDefaultValue(path, []);
        if (index !== undefined) {
          arr.splice(index, 0, undefined);
          this.cacheInvalidateChildren(path);
        } else {
          arr.push({});
        }
        pageGroup.cachedChildPages = fetchChildPages();
        const newPage = pageGroup.cachedChildPages[
          index !== undefined
            ? index
            : pageGroup.cachedChildPages.length - 1];
        newPage.setDefault();
        pageGroup.value = true;
        pageGroup.validateValue(pageGroup.value);
        this.notify(localSubscribers);
        return newPage;
      },
      duplicate: (sourceIndex: number): Page => {
        const arr = this.getOrDefaultValue(path, []);
        const duplicateData = JSON.parse(JSON.stringify(arr[sourceIndex]));
        const newPage = pageGroup.insert();
        newPage.setRaw(duplicateData);
        if (newPage.nameFromProp) {
          const nameProp = newPage.getChildren().props.find(p => p.path[p.path.length - 1] === newPage.nameFromProp) as StringProperty;
          nameProp.set(nameProp.value + ' (Copy)');
        }
        return newPage;
      },
      moveUp: (index: number): void => {
        const arr = this.getOrDefaultValue(path, []);
        if (index <= 0 || arr.length - 1 < index) return;
        const temp = arr[index - 1];
        arr[index - 1] = arr[index];
        arr[index] = temp;
        this.cacheInvalidateChildren(path);
        pageGroup.cachedChildPages = fetchChildPages();
        this.notify(localSubscribers);
      },
      moveDown: (index: number): void => {
        const arr = this.getOrDefaultValue(path, []);
        if (index < 0 || arr.length - 2 < index) return;
        const temp = arr[index + 1];
        arr[index + 1] = arr[index];
        arr[index] = temp;
        this.cacheInvalidateChildren(path);
        pageGroup.cachedChildPages = fetchChildPages();
        this.notify(localSubscribers);
      },
      delete: (index: number): void => {
        const arr = this.getValue(path);
        arr.splice(index, 1);
        this.cacheInvalidateChildren(path);
        pageGroup.cachedChildPages = depth === ResolveDepth.None ? undefined : fetchChildPages()
        pageGroup.validateValue(pageGroup.value);
        this.notify(localSubscribers);
      },
      set: (val: true | undefined): void => {
        if (!val && isRequired) throw Error(`Cannot unset a required page group for path ${path}`)
        this.setValue(path, val === true
          ? new Array(pageGroup.minItems ? pageGroup.minItems : 0)
          : undefined);
        if (val) {
          pageGroup.cachedChildPages = fetchChildPages();
          pageGroup.cachedChildPages.forEach(childPage => childPage.setDefault());
        } else {
          pageGroup.cachedChildPages = [];
        }
        pageGroup.value = val;
        pageGroup.validateValue(pageGroup.value);
        this.notify(localSubscribers);
      },
      setDefault: (): void => {
        pageGroup.set(pageGroup.defaultValue);
      },
      setRaw: (val: Array<any> | undefined): void => {
        this.setValue(path, val);
        this.cacheInvalidateChildren(path);
        if (val !== undefined) {
          pageGroup.value = true;
          pageGroup.cachedChildPages = fetchChildPages();
        } else {
          pageGroup.value = undefined;
          pageGroup.cachedChildPages = undefined;
        }
        pageGroup.validateValue(pageGroup.value);
        this.notify(localSubscribers);
      },
      validateValue: (val: true | undefined): void => {
        if (val === undefined && isRequired) {
          pageGroup.errorMsg = 'Required value';
        } else if (val === true) {
          const rawValue = this.getValue(path);
          const count = rawValue === undefined ? 0 : rawValue.length;
          if (pageGroup.minItems !== undefined && count < pageGroup.minItems) {
            pageGroup.errorMsg = `Must have at least ${pageGroup.minItems} ${pageGroup.minItems <= 1 ? 'entry' : 'entries'}`;
          } else if (pageGroup.maxItems !== undefined && count > pageGroup.maxItems) {
            pageGroup.errorMsg = `Must have at most ${pageGroup.maxItems} ${pageGroup.maxItems <= 1 ? 'entry' : 'entries'}`;
          }
          pageGroup.errorMsg = undefined;
        } else {
          pageGroup.errorMsg = undefined;
        }
      },
      subscribe: (callback: () => void): Unsubscribe => {
        return this._subscribe(callback, localSubscribers);
      },
      cachedChildPages: depth === ResolveDepth.None ? undefined : fetchChildPages(),
    };
    pageGroup.validateValue(pageGroup.value);
    return pageGroup;
  }

  parseProperty(path: Path, isRequired?: boolean, subSchema?: any, valueOverride: any = null): Property {
    if (path.length === 0) {
      throw Error(`Property cannot be on root on path ${path}`);
    }
    var propSchema;
    if (isRequired !== undefined && subSchema !== undefined) {
      propSchema = this.mergeAllOf(subSchema);
    } else {
      const parentSchema = this.getSubSchema(path.slice(0, path.length - 1));
      const propName = path[path.length - 1];
      propSchema = parentSchema.properties && parentSchema.properties[propName]
        || (() => { throw Error(`Cannot find property on path ${path}`) })();
      isRequired = !!(parentSchema.type === 'array' || parentSchema.required && parentSchema.required.includes(propName));
    }
    if (propSchema[OpenApiTags.Page] || propSchema[OpenApiTags.PageGroup]) {
      throw Error(`Page or pagegroup found instead of property on path ${path}`);
    }

    var property: Property;
    const xProp = propSchema[OpenApiTags.Prop] as xCfProp;

    const localSubscribers: { [subscriberId: string]: () => void } = {};
    const setFun = (val: any): void => {
      this.setValue(path, val);
      property.value = val;
      property.validateValue(val as never);
      this.notify(localSubscribers);
    };
    const setDefaultFun = (): void => {
      property.set(property.defaultValue);
    };
    const validateRequiredFun = (val: any): void => {
      if (val === undefined && isRequired) {
        property.errorMsg = 'Required value';
      } else {
        property.errorMsg = undefined;
      }
    };
    const pathStr = pathToString(path);
    const base = {
      key: randomUuid(),
      name: pathStr,
      hide: !!propSchema[OpenApiTags.Hide],
      ...xProp,
      type: 'unknown', // Will be overriden by subclass
      path: path,
      pathStr: pathStr,
      required: isRequired,
      set: setFun,
      setDefault: setDefaultFun,
      subscribe: (callback: () => void): Unsubscribe => {
        return this._subscribe(callback, localSubscribers);
      },
      validateValue: validateRequiredFun,
    };
    const value = valueOverride === null ? this.getValue(path) : valueOverride;
    switch (propSchema.type || 'object') {
      case 'string':
        if (propSchema.enum) {
          const items: EnumItem[] = this.getEnumItems(propSchema);
          property = {
            defaultValue: xProp?.defaultValue !== undefined ? xProp.defaultValue : (isRequired ? propSchema.enum[0] : undefined),
            ...base,
            type: PropertyType.Enum,
            value: value,
            items: items,
            validateValue: (val: string | undefined): void => {
              if (val === undefined) {
                validateRequiredFun(val);
              } else if (!propSchema.enum.includes(val)) {
                property.errorMsg = `Can only be one of: ${JSON.stringify(propSchema.enum)}`;
              } else {
                property.errorMsg = undefined;
              }
            },
          };
        } else if (propSchema[OpenApiTags.PropLink]) {
          const xPropLink = propSchema[OpenApiTags.PropLink] as xCfPropLink;
          property = {
            defaultValue: xProp?.defaultValue !== undefined ? xProp.defaultValue : (isRequired ? [...xPropLink.linkPath, 0] : undefined),
            ...xPropLink,
            ...base,
            type: PropertyType.Link,
            value: value,
            allowCreate: !xPropLink.disallowCreate && !xPropLink.linkPath.includes('<$>'),
            set: (val: string | undefined): void => {
              (property as LinkProperty).cachedOptions = undefined;
              setFun(val);
            },
            create: (name: string): void => {
              if (xPropLink.linkPath.includes('<$>')) {
                throw Error(`Link property ${path} link path ${xPropLink.linkPath} contains variable, not supported currently for creation`);
              }
              const targetPath = this.expandRelativePath(xPropLink.linkPath, path);
              const target = this.get(targetPath);
              if (target.type !== PropertyType.Array && target.type !== PageGroupType) throw Error(`Link on path ${path} is pointing to a non-array non-page-group on path ${targetPath}`);
              const newItem: Page | Property = target.insert();
              var newItemProps;
              if (newItem.type === PageType) {
                newItemProps = newItem.getChildren().props;
              } else if (newItem.type === PropertyType.Object) {
                newItemProps = newItem.childProperties || []
              } else {
                throw Error(`Link property ${path} pointing to array of non-objects on path ${targetPath}`);
              }
              const displayProp = newItemProps.find(p => p.path[p.path.length - 1] === xPropLink.displayPropName);
              if (displayProp === undefined) throw Error(`Link property ${path} target does not have display property name ${xPropLink.displayPropName} on path ${targetPath}`);
              if (displayProp.type !== PropertyType.String) throw Error(`Link property ${path} target display property name ${xPropLink.displayPropName} is not a string type on path ${displayProp.path}`);
              displayProp.set(name);

              const idProp = newItemProps.find(p => p.path[p.path.length - 1] === xPropLink.idPropName);
              if (idProp === undefined) throw Error(`Link property ${path} target does not have id property name ${xPropLink.idPropName} on path ${targetPath}`);
              if (idProp.type !== PropertyType.String) throw Error(`Link property ${path} target id property name ${xPropLink.idPropName} is not a string type on path ${idProp.path}`);
              if (idProp.value === undefined) throw Error(`Link property ${path} target id property name ${xPropLink.idPropName} is undefined after just inserted it on path ${idProp.path}`);

              property.set(idProp.value as never);
            },
            getOptions: (): LinkPropertyOption[] => this.getLinkOptions(property as LinkProperty, localSubscribers, path),
            validateValue: (val: string | undefined): void => {
              if (val === undefined) {
                validateRequiredFun(val);
              } else {
                // Since link validation requires another property,
                // potentially itself, do this later after property
                // is fully initialized to prevent a stack overflow
                setTimeout(() => {
                  const linkProperty = property as LinkProperty;
                  const newErrorMsg = linkProperty.getOptions().find(o => o.id === val) === undefined
                    ? "Invalid reference"
                    : undefined;
                  if (newErrorMsg !== property.errorMsg) {
                    property.errorMsg = newErrorMsg;
                    this.notify(localSubscribers);
                  }
                }, 1);
              }
            },
          };
          break;
        } else {
          var defaultValue;
          if (xProp && xProp.subType === PropSubType.Id) {
            defaultValue = base.defaultValue !== undefined ? base.defaultValue : randomUuid();
          } else {
            defaultValue = xProp?.defaultValue !== undefined ? xProp.defaultValue : (isRequired ? '' : undefined);
          }
          var setDefaultStringFun = setDefaultFun;
          var setStringFun = setFun;
          if (base.defaultValue && base.defaultValue.includes('<>')) {
            setDefaultStringFun = (): void => {
              setStringFun(base.defaultValue
                .replace(/<>/g, path[path.length - 2]));
            }
          }
          if (xProp && xProp.slugAutoComplete !== undefined) {
            setStringFun = (val: string | undefined): void => {
              const prevVal = (property as StringProperty).value;
              setFun(val);
              setTimeout(() => {
                const slugProp = this.getProperty(this.expandRelativePath(xProp.slugAutoComplete!.path, path));
                if (xProp.slugAutoComplete!.skipFirst !== undefined
                  && path[xProp.slugAutoComplete!.skipFirst] === 0) {
                  return;
                }
                const prevSlugName = stringToSlug(prevVal);
                // Only update slug if it hasn't been changed already manually
                if (slugProp.value === prevSlugName) {
                  const slugName = stringToSlug(val);
                  slugProp.set(slugName as never);
                }
              }, 1);
            };
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
            set: setStringFun,
            setDefault: setDefaultStringFun,
            validateValue: (val: string | undefined): void => {
              const stringProperty = property as StringProperty;
              if (val === undefined) {
                validateRequiredFun(val);
              } else if (stringProperty.validation !== undefined && !stringProperty.validation.test(val)) {
                property.errorMsg = `Invalid value (Requires ${stringProperty.validation})`;
              } else if (stringProperty.minLength !== undefined && val.length < stringProperty.minLength) {
                property.errorMsg = `Must be at least ${stringProperty.minLength} characters`;
              } else if (stringProperty.maxLength !== undefined && val.length > stringProperty.maxLength) {
                property.errorMsg = `Must be at most ${stringProperty.maxLength} characters`;
              } else {
                property.errorMsg = undefined;
              }
            },
          };
        }
        break;
      case 'number':
      case 'integer':
        property = {
          defaultValue: xProp?.defaultValue !== undefined ? xProp.defaultValue : (isRequired ? 0 : undefined),
          ...base,
          type: propSchema.type,
          value: value,
          validateValue: (val: number | undefined): void => {
            const numericProperty = property as IntegerProperty | NumberProperty;
            if (val === undefined) {
              validateRequiredFun(val);
            } else if (property.type === PropertyType.Integer && val % 1 > 0) {
              property.errorMsg = `Must be a whole number`;
            } else if (numericProperty.minimum !== undefined && val < numericProperty.minimum) {
              property.errorMsg = `Must be a minimum of ${numericProperty.minimum}`;
            } else if (numericProperty.maximum !== undefined && val > numericProperty.maximum) {
              property.errorMsg = `Must be a maximum of ${numericProperty.maximum}`;
            } else {
              property.errorMsg = undefined;
            }
          },
        };
        break;
      case 'boolean':
        property = {
          defaultValue: xProp?.defaultValue !== undefined ? xProp.defaultValue : (isRequired ? false : undefined),
          ...base,
          type: PropertyType.Boolean,
          value: value,
          ...(xProp && xProp.falseAsUndefined && !isRequired ? {
            required: true,
            set: (val: boolean | undefined): void => {
              this.setValue(path, val === true ? true : undefined);
              property.value = val;
              property.validateValue(val as never);
              this.notify(localSubscribers);
            },
          } : {}),
          trueLabel: xProp?.trueLabel,
          falseLabel: xProp?.falseLabel,
        };
        break;
      case 'array':
        if (propSchema[OpenApiTags.PropLink]) {
          if (!propSchema.items || propSchema.items.type !== 'string') {
            throw Error(`Multi Link must be an array of strings on path ${path}`);
          }
          const xPropLink = propSchema[OpenApiTags.PropLink];
          property = {
            defaultValue: base.defaultValue !== undefined ? new Set<string>(base.defaultValue) : (isRequired ? new Set<string>() : undefined),
            ...xPropLink,
            ...base,
            type: PropertyType.LinkMulti,
            value: value === undefined ? undefined : new Set<string>(value),
            allowCreate: !xPropLink.disallowCreate && !xPropLink.linkPath.includes('<$>'),
            minItems: propSchema.minItems,
            maxItems: propSchema.maxItems,
            set: (val: Set<string>) => {
              const linkMultiProperty = property as LinkMultiProperty;
              linkMultiProperty.value = new Set<string>(val);
              this.setValue(path, [...linkMultiProperty.value]);
              (property as LinkMultiProperty).cachedOptions = undefined;
              linkMultiProperty.validateValue(linkMultiProperty.value);
              this.notify(localSubscribers);
            },
            create: (name: string): void => {
              if (xPropLink.linkPath.includes('<$>')) {
                throw Error(`Link property ${path} link path ${xPropLink.linkPath} contains variable, not supported currently for creation`);
              }
              const targetPath = this.expandRelativePath(xPropLink.linkPath, path);
              const target = this.get(targetPath);
              if (target.type !== PropertyType.Array && target.type !== PageGroupType) throw Error(`Link on path ${path} is pointing to a non-array non-page-group on path ${targetPath}`);
              const newItem: Page | Property = target.insert();
              var newItemProps;
              if (newItem.type === PageType) {
                newItemProps = newItem.getChildren().props;
              } else if (newItem.type === PropertyType.Object) {
                newItemProps = newItem.childProperties || []
              } else {
                throw Error(`Link property ${path} pointing to array of non-objects on path ${targetPath}`);
              }
              const displayProp = newItemProps.find(p => p.path[p.path.length - 1] === xPropLink.displayPropName);
              if (displayProp === undefined) throw Error(`Link property ${path} target does not have display property name ${xPropLink.displayPropName} on path ${targetPath}`);
              if (displayProp.type !== PropertyType.String) throw Error(`Link property ${path} target display property name ${xPropLink.displayPropName} is not a string type on path ${displayProp.path}`);
              displayProp.set(name);

              const idProp = newItemProps.find(p => p.path[p.path.length - 1] === xPropLink.idPropName);
              if (idProp === undefined) throw Error(`Link property ${path} target does not have id property name ${xPropLink.idPropName} on path ${targetPath}`);
              if (idProp.type !== PropertyType.String) throw Error(`Link property ${path} target id property name ${xPropLink.idPropName} is not a string type on path ${idProp.path}`);
              if (idProp.value === undefined) throw Error(`Link property ${path} target id property name ${xPropLink.idPropName} is undefined after just inserted it on path ${idProp.path}`);

              (property as LinkMultiProperty).insert(idProp.value);
            },
            insert: (linkId: string): void => {
              const linkMultiProperty = property as LinkMultiProperty;
              if (linkMultiProperty.value === undefined) linkMultiProperty.value = new Set<string>();
              linkMultiProperty.value.add(linkId);
              this.setValue(path, [...linkMultiProperty.value]);
              (property as LinkMultiProperty).cachedOptions = undefined;
              linkMultiProperty.validateValue(linkMultiProperty.value);
              this.notify(localSubscribers);
            },
            delete: (linkId: string): void => {
              const linkMultiProperty = property as LinkMultiProperty;
              if (linkMultiProperty.value === undefined) return;
              linkMultiProperty.value.delete(linkId);
              this.setValue(path, [...linkMultiProperty.value]);
              (property as LinkMultiProperty).cachedOptions = undefined;
              linkMultiProperty.validateValue(linkMultiProperty.value);
              this.notify(localSubscribers);
            },
            validateValue: (val: Set<string> | undefined): void => {
              if (val === undefined) {
                validateRequiredFun(val);
              } else {
                const linkMultiProperty = property as LinkMultiProperty;
                const count = val ? val.size : 0;
                if (linkMultiProperty.minItems !== undefined && count < linkMultiProperty.minItems) {
                  property.errorMsg = `Must have at least ${linkMultiProperty.minItems} ${linkMultiProperty.minItems <= 1 ? 'entry' : 'entries'}`;
                } else if (linkMultiProperty.maxItems !== undefined && count > linkMultiProperty.maxItems) {
                  property.errorMsg = `Must have at most ${linkMultiProperty.maxItems} ${linkMultiProperty.maxItems <= 1 ? 'entry' : 'entries'}`;
                } else {
                  property.errorMsg = undefined;
                  // Since link validation requires another property,
                  // potentially itself, do this later after property
                  // is fully initialized to prevent a stack overflow
                  setTimeout(() => {
                    const options = linkMultiProperty.getOptions();
                    var newErrorMsg: string | undefined = undefined;
                    for (let valItem in val) {
                      if (options.find(o => o.id === valItem) === undefined) {
                        newErrorMsg = "Option no longer exists";
                        break;
                      }
                    }
                    if (newErrorMsg !== property.errorMsg) {
                      property.errorMsg = newErrorMsg;
                      this.notify(localSubscribers);
                    }
                  }, 1);
                }
              }
            },
            getOptions: (): LinkPropertyOption[] => this.getLinkOptions(property as LinkProperty, localSubscribers, path),
          }
          break;
        }
        const fetchChildPropertiesArray = (): Property[] | undefined => {
          const arr = this.getValue(path);
          var childProperties: Property[] | undefined;
          if (arr) {
            childProperties = [];
            for (let i = 0; i < arr.length; i++) {
              childProperties.push(this.getProperty([...path, i], true, propSchema.items));
            }
            childProperties.push(...this.parseAdditionalProps(propSchema, path));
            childProperties.sort(this.sortPagesProps);
          }
          return childProperties;
        }
        property = {
          defaultValue: xProp?.defaultValue !== undefined ? xProp.defaultValue : (isRequired ? true : undefined),
          ...base,
          type: PropertyType.Array,
          value: value === undefined ? undefined : true,
          minItems: propSchema.minItems,
          maxItems: propSchema.maxItems,
          uniqueItems: propSchema.uniqueItems,
          childType: propSchema.items.enum ? 'enum' : (propSchema.items.type || 'object'),
          childEnumItems: propSchema.items.enum ? this.getEnumItems(propSchema.items) : undefined,
          childProperties: fetchChildPropertiesArray(),
          set: (val: true | undefined): void => {
            if (!val && isRequired) throw Error(`Cannot unset a required array prop for path ${path}`)
            const arrayProperty = property as ArrayProperty;
            if (val !== undefined) {
              this.setValue(path, new Array(arrayProperty.minItems ? arrayProperty.minItems : 0));
              arrayProperty.childProperties = fetchChildPropertiesArray();
              arrayProperty.childProperties && arrayProperty.childProperties.forEach(p => p.setDefault());
            } else {
              this.setValue(path, undefined);
              arrayProperty.childProperties = undefined;
            }
            arrayProperty.value = val;
            arrayProperty.validateValue(val);
            this.notify(localSubscribers);
          },
          setRaw: (val: Array<any> | undefined): void => {
            this.setValue(path, val);
            this.cacheInvalidateChildren(path);
            const arrayProperty = property as ArrayProperty;
            if (val !== undefined) {
              arrayProperty.value = true;
              arrayProperty.childProperties = fetchChildPropertiesArray();
            } else {
              arrayProperty.value = undefined;
              arrayProperty.childProperties = undefined;
            }
            arrayProperty.validateValue(arrayProperty.value);
            this.notify(localSubscribers);
          },
          setDefault: (): void => {
            const arrayProperty = property as ArrayProperty;
            arrayProperty.set(arrayProperty.defaultValue);
          },
          insert: (index?: number): Property => {
            const arr = this.getOrDefaultValue(path, []);
            if (index !== undefined) {
              arr.splice(index, 0, undefined);
            } else {
              arr.push(undefined);
            }
            this.cacheInvalidateChildren(path);
            const arrayProperty: ArrayProperty = (property as ArrayProperty);
            arrayProperty.childProperties = fetchChildPropertiesArray();
            const newProperty = arrayProperty.childProperties![
              index !== undefined
                ? index
                : arrayProperty.childProperties!.length - 1];
            newProperty.setDefault();
            property.value = true;
            arrayProperty.validateValue(arrayProperty.value);
            this.notify(localSubscribers);
            return newProperty;
          },
          duplicate: (sourceIndex: number): Property => {
            const arr = this.getValue(path);
            const duplicateData = JSON.parse(JSON.stringify(arr[sourceIndex]));
            const arrayProperty = property as ArrayProperty;
            const newProp = arrayProperty.insert();
            if (newProp.type === PropertyType.Object || newProp.type === PropertyType.Array) {
              newProp.setRaw(duplicateData);
            } else {
              newProp.set(duplicateData);
            }
            return newProp;
          },
          moveUp: (index: number): void => {
            const arr = this.getOrDefaultValue(path, []);
            if (index <= 0 || arr.length - 1 < index) return;
            const temp = arr[index - 1];
            arr[index - 1] = arr[index];
            arr[index] = temp;
            this.cacheInvalidateChildren(path);
            (property as ArrayProperty).childProperties = fetchChildPropertiesArray();
            this.notify(localSubscribers);
          },
          moveDown: (index: number): void => {
            const arr = this.getOrDefaultValue(path, []);
            if (index < 0 || arr.length - 2 < index) return;
            const temp = arr[index + 1];
            arr[index + 1] = arr[index];
            arr[index] = temp;
            this.cacheInvalidateChildren(path);
            (property as ArrayProperty).childProperties = fetchChildPropertiesArray();
            this.notify(localSubscribers);
          },
          delete: (index: number): void => {
            if (!property.value) return;
            const arrayProperty = property as ArrayProperty;
            const arr = this.getValue(path);
            arr.splice(index, 1);
            this.cacheInvalidateChildren(path);
            arrayProperty.childProperties = fetchChildPropertiesArray();
            arrayProperty.validateValue(arrayProperty.value);
            this.notify(localSubscribers);
          },
          validateValue: (val: true | undefined): void => {
            if (val === undefined) {
              validateRequiredFun(val);
            } else {
              const arrayProperty = property as ArrayProperty;
              const count = arrayProperty.childProperties ? arrayProperty.childProperties.length : 0;
              if (arrayProperty.minItems !== undefined && count < arrayProperty.minItems) {
                property.errorMsg = `Must have at least ${arrayProperty.minItems} ${arrayProperty.minItems <= 1 ? 'entry' : 'entries'}`;
              } else if (arrayProperty.maxItems !== undefined && count > arrayProperty.maxItems) {
                property.errorMsg = `Must have at most ${arrayProperty.maxItems} ${arrayProperty.maxItems <= 1 ? 'entry' : 'entries'}`;
              } else if (arrayProperty.uniqueItems !== undefined && (new Set(this.getValue(path))).size !== (arrayProperty.childProperties || []).length) {
                property.errorMsg = `Must have unique entries`;
              } else {
                property.errorMsg = undefined;
              }
            }
          },
        };
        break;
      case 'object':
        if (propSchema.additionalProperties && propSchema.properties) {
          throw Error(`Object with both dict and object items unsupported yet for path ${path}`);
        }
        if (propSchema.additionalProperties) {
          const fetchChildPropertiesDict = (): { [key: string]: Property } | undefined => {
            const obj = this.getValue(path);
            var childProperties: { [key: string]: Property } | undefined;
            if (obj) {
              childProperties = {};
              const childPropSchema = propSchema.additionalProperties;
              const requiredProps = propSchema.required || [];
              Object.keys(obj).forEach(propName => {
                childProperties![propName] = this.getProperty(
                  [...path, propName],
                  requiredProps.includes(propName),
                  childPropSchema);
              });
            }
            return childProperties;
          }
          property = {
            defaultValue: xProp?.defaultValue !== undefined ? xProp.defaultValue : (isRequired ? true : undefined),
            ...base,
            type: PropertyType.Dict,
            value: value === undefined ? undefined : true,
            childProperties: fetchChildPropertiesDict(),
            set: (val: true | undefined): void => {
              if (!val && isRequired) throw Error(`Cannot unset a required dict prop for path ${path}`)
              const dictProperty = property as DictProperty;
              if (val) {
                this.setValue(path, {});
                dictProperty.childProperties = {};
              } else {
                this.setValue(path, undefined);
                dictProperty.childProperties = undefined;
              }
              dictProperty.value = val;
              dictProperty.validateValue(val);
              this.notify(localSubscribers);
            },
            setRaw: (val: object | undefined): void => {
              this.setValue(path, val);
              this.cacheInvalidateChildren(path);
              const dictProperty = property as DictProperty;
              if (val !== undefined) {
                dictProperty.value = true;
                dictProperty.childProperties = fetchChildPropertiesDict();
              } else {
                dictProperty.value = undefined;
                dictProperty.childProperties = undefined;
              }
              dictProperty.validateValue(dictProperty.value);
              this.notify(localSubscribers);
            },
            setDefault: (): void => {
              const dictProperty = property as DictProperty;
              dictProperty.set(dictProperty.defaultValue);
            },
            put: (key: string): Property => {
              const dictProperty = property as DictProperty;
              const dict = this.getOrDefaultValue(path, {});
              dict[key] = undefined;
              property.value = true;
              dictProperty.childProperties = fetchChildPropertiesDict();
              const newProperty = dictProperty.childProperties![key]!;
              newProperty.setDefault();
              dictProperty.validateValue(dictProperty.value);
              this.notify(localSubscribers);
              return newProperty;
            },
            delete: (key: string): void => {
              if (!property.value) return;
              const dictProperty = property as DictProperty;
              const dict = this.getValue(path);
              delete dict[key];
              this.cacheInvalidateChildren(path);
              dictProperty.childProperties = fetchChildPropertiesDict();
              dictProperty.validateValue(dictProperty.value);
              this.notify(localSubscribers);
            },
          };
          break;
        }
        const fetchChildPropertiesObject = (): Property[] | undefined => {
          const obj = this.getValue(path);
          var childProperties: Property[] | undefined;
          if (obj) {
            childProperties = [];
            const childPropsSchema = propSchema.properties
              || (() => { throw Error(`Cannot find 'properties' under path ${path}`) })();
            const requiredProps = propSchema.required || [];
            Object.keys(childPropsSchema).forEach(propName => {
              const objectPropSchema = this.getSubSchema([propName], childPropsSchema);
              childProperties!.push(this.getProperty(
                [...path, propName],
                requiredProps.includes(propName),
                objectPropSchema));
            });
            childProperties.push(...this.parseAdditionalProps(propSchema, path));
            childProperties.sort(this.sortPagesProps);
          }
          return childProperties;
        }
        property = {
          defaultValue: xProp?.defaultValue !== undefined ? xProp.defaultValue : (isRequired ? true : undefined),
          ...base,
          type: PropertyType.Object,
          value: value === undefined ? undefined : true,
          childProperties: fetchChildPropertiesObject(),
          set: (val: true | undefined): void => {
            if (!val && isRequired) throw Error(`Cannot unset a required object prop for path ${path}`)
            const objectProperty = property as ObjectProperty;
            if (val) {
              this.setValue(path, {});
              objectProperty.childProperties = fetchChildPropertiesObject();
              objectProperty.childProperties && objectProperty.childProperties.forEach(childProp => childProp.setDefault());
            } else {
              this.setValue(path, undefined);
              objectProperty.childProperties = undefined;
            }
            objectProperty.value = val;
            objectProperty.validateValue(val);
            this.notify(localSubscribers);
          },
          setRaw: (val: object | undefined): void => {
            this.setValue(path, val);
            this.cacheInvalidateChildren(path);
            const objectProperty = property as ObjectProperty;
            if (val !== undefined) {
              objectProperty.value = true;
              objectProperty.childProperties = fetchChildPropertiesObject();
            } else {
              objectProperty.value = undefined;
              objectProperty.childProperties = undefined;
            }
            objectProperty.validateValue(objectProperty.value);
            this.notify(localSubscribers);
          },
          setDefault: (): void => {
            const objectProperty = property as ObjectProperty;
            objectProperty.set(objectProperty.defaultValue);
          },
        };
        break;
      default:
        throw Error(`Unknown type ${propSchema.type} in path ${path}`);
    }
    property.validateValue(property.value as never);
    return property;
  }
}

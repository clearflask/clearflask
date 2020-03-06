
class LocalStorage {
  static cache = {};
  static instance: LocalStorage;

  static getInstance(): LocalStorage {
    return this.instance || (this.instance = new this());
  }

  clearAll(): void {
    localStorage.clear();
    LocalStorage.cache = {};
  }

  get(name: string): any {
    var item = LocalStorage.cache[name];
    if (item) {
      return item;
    }
    item = localStorage.getItem(name);
    if (item) item = JSON.parse(item);
    LocalStorage.cache[name] = item;
    return item;
  }

  set(name: string, val: any): any {
    if (val === undefined) return this.unset(name);
    var prevVal = this.get(name);
    localStorage.setItem(name, JSON.stringify(val));
    LocalStorage.cache[name] = val;
    return prevVal;
  }

  unset(name: string): any {
    var prevVal = this.get(name);
    localStorage.removeItem(name);
    LocalStorage.cache[name] = undefined;
    return prevVal;
  }

  objectSet(objectName: string, key: string, val: any): any {
    var obj: object = this.get(objectName);
    var prevVal;
    if (obj) {
      prevVal = obj[key];
    } else {
      obj = {};
    }
    obj[key] = val;
    this.set(objectName, obj);
    return prevVal;
  }

  object(objectName: string): object {
    var obj: object = this.get(objectName);
    return obj || {};
  }

  objectGet(objectName: string, key: string): any {
    var obj: object = this.get(objectName);
    return obj && obj[key];
  }

  arrayPush(arrayName: string, item: any): void {
    var arr: any[] = this.get(arrayName);
    if (!arr) {
      arr = [];
    }
    arr.push(item)
    this.set(arrayName, arr);
  }

  arrayUnshift(arrayName: string, item: any): void {
    var arr: any[] = this.get(arrayName);
    if (!arr) {
      arr = [];
    }
    arr.unshift(item)
    this.set(arrayName, arr);
  }

  array(arrayName: string): any[] {
    var arr: any[] = this.get(arrayName);
    return arr || [];
  }

  arrayGet(arrayName: string, index: number): any {
    var arr: any[] = this.get(arrayName);
    return arr && arr[index];
  }

  arrayPop(arrayName: string): any {
    var arr: any[] = this.get(arrayName);
    if (!arr) {
      arr = [];
    }
    var val = arr.pop();
    this.set(arrayName, arr);
    return val;
  }

  arrayShift(arrayName: string): any {
    var arr: any[] = this.get(arrayName);
    if (!arr) {
      arr = [];
    }
    var val = arr.shift();
    this.set(arrayName, arr);
    return val;
  }
}

export default LocalStorage;

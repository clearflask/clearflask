
export default function stringToSlug(val?:string):string {
  return val
    ? val.toLowerCase().replace(/[^0-9a-z]+/g,'-')
    : '';
}

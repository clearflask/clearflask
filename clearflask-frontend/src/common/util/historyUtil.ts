import { Location } from 'history';

export function preserveEmbed(path: string, location: Location): string {
  if (!location.pathname.match(/^\/?embed/)) {
    return path;
  }
  return path.replace(/^(\/?embed)?/, '/embed');
}
import { Breakpoint } from "@material-ui/core/styles/createBreakpoints";
import windowIso from "../windowIso";

/**
 * Avoid vertical height on mobile since the top and bottom bar on
 * mobile appear/disappear causing the height value to change which
 * causes weird behavior.
 * https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
 */
const vhConstant = (windowIso.isSsr ? 768 : windowIso.innerHeight) / 100;
export function vh(heightPerc: number): number {
  return vhConstant * heightPerc;
}

export const initialWidth: Breakpoint = 'md';
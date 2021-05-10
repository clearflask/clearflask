import { Breakpoint } from "@material-ui/core/styles/createBreakpoints";
import windowIso from "../windowIso";

/**
 * Avoid vertical height on mobile since the top and bottom bar on
 * mobile appear/disappear causing the height value to change which
 * causes weird behavior.
 * https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
 * Always return the maximum height we've seen ever.
 */
var maxVhSeen = (windowIso.isSsr ? 768 : windowIso.innerHeight) / 100;
export function vh(heightPerc: number): number {
  listenForScreenResize();
  return maxVhSeen * heightPerc;
}

var listening = false;
function listenForScreenResize() {
  if (!windowIso.isSsr && !listening) {
    listening = true;
    windowIso.addEventListener('resize', () => {
      if (windowIso.isSsr) return;
      const newVhConstant = windowIso.innerHeight / 100;
      if (maxVhSeen < newVhConstant) {
        maxVhSeen = newVhConstant;
      }
    });
  }
}

export const initialWidth: Breakpoint = 'md';
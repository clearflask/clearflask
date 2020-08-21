
/**
 * Avoid vertical height on mobile since the top and bottom bar on
 * mobile appear/disappear causing the height value to change which
 * causes weird behavior.
 * https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
 */
const vhConstant = window.innerHeight / 100;
export function vh(heightPerc: number): number {
  return vhConstant * heightPerc;
}

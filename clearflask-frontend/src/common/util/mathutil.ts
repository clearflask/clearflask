
function minmax(min: number, input: number, max: number) {
  if (input < min) return min;
  if (input > max) return max;
  return input;
}

export default minmax;
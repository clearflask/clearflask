
import { spring, OpaqueConfig } from 'react-motion';

export default function muiSpring(val:number):OpaqueConfig {
  return spring(val, {
    stiffness: 300,
    damping: 30,
  });
}

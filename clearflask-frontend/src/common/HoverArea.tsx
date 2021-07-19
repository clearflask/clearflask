import { useMediaQuery } from '@material-ui/core';
import { useTheme } from '@material-ui/core/styles';
import { Breakpoint } from '@material-ui/core/styles/createBreakpoints';
import React, { useState } from 'react';

export const useHoverArea = (disableHoverBelow?: Breakpoint): [
  hoverAreaProps: {
    onMouseOver: () => void;
    onMouseOut: () => void;
  },
  isHovering: boolean,
  isHoverDisabled: boolean,
  forceSetIsHovering: (isHovering: boolean) => void,
] => {
  const theme = useTheme();
  const matchesHoverDown = useMediaQuery(theme.breakpoints.down(disableHoverBelow || 'sm'));
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const isHoverDisabled = !!disableHoverBelow && matchesHoverDown;

  const hoverAreaProps = {
    onMouseOver: () => setIsHovering(true),
    onMouseOut: () => setIsHovering(false),
  };

  return [hoverAreaProps, isHovering, isHoverDisabled, setIsHovering];
};


const HoverArea = (props: {
  disableHoverBelow?: Breakpoint;
  children: (hoverAreaProps, isHovering: boolean, isHoverDisabled: boolean) => React.ReactNode;
}) => {
  const [hoverAreaProps, isHovering, isHoverDisabled] = useHoverArea();

  return props.children(hoverAreaProps, isHovering, isHoverDisabled) as any;
};

export default HoverArea;

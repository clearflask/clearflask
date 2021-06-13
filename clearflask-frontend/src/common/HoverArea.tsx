import { useMediaQuery } from '@material-ui/core';
import { useTheme } from '@material-ui/core/styles';
import { Breakpoint } from '@material-ui/core/styles/createBreakpoints';
import React, { useState } from 'react';

const HoverArea = (props: {
  hoverDown?: Breakpoint;
  children: (hoverAreaProps, isHovering: boolean, isHoverDown: boolean) => React.ReactNode;
}) => {
  const theme = useTheme();
  const matchesHoverDown = useMediaQuery(theme.breakpoints.down(props.hoverDown || 'sm'));
  const [isHover, setIsHover] = useState<boolean>(false);
  const isBelow = !props.hoverDown || matchesHoverDown;

  const hoverAreaProps = {
    onMouseOver: () => setIsHover(true),
    onMouseOut: () => setIsHover(false),
  };

  return props.children(hoverAreaProps, isHover, isBelow) as any;
};

export default HoverArea;

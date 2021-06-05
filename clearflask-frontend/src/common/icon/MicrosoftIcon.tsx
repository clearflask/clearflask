import SvgIcon from "@material-ui/core/SvgIcon";
import React from 'react';

export default function MicrosoftIcon(props) {
  return (
    <SvgIcon {...props}>
      <svg width="24" height="24" viewBox="0 0 24 24">
        <path fill="currentColor" d="M2,3H11V12H2V3M11,22H2V13H11V22M21,3V12H12V3H21M21,22H12V13H21V22Z" />
      </svg>
    </SvgIcon>
  );
}


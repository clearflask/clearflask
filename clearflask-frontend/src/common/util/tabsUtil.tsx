import React from 'react';

// Mui Tabs requires Tab to be a direct child
// Instead, you can use this fragment to trick Mui
// Tabs passes props to children and these are passed along here
// https://github.com/mui-org/material-ui/blob/master/packages/material-ui/src/Tabs/Tabs.js#L410
export const TabFragment = (props: { value: any, children: (tabProps: any) => React.ReactNode }) => {
  const { value, children, ...tabProps } = props;
  return (
    <>
      {props.children(tabProps)}
    </>
  );
};
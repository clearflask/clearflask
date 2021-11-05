// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Tab, Tabs } from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import classNames from 'classnames';
import React from 'react';

// Mui Tabs requires Tab to be a direct child
// Instead, you can use this fragment to trick Mui
// Tabs passes props to children and these are passed along here
// https://github.com/mui-org/material-ui/blob/master/packages/material-ui/src/Tabs/Tabs.js#L410
export const TabFragment = (props: {
  value: any,
  children: React.ReactNode | ((tabProps: {
    indicator?: React.ReactNode,
    selectionFollowsFocus?: boolean,
  } & Pick<React.ComponentProps<typeof Tab>, 'fullWidth' | 'selected' | 'onChange' | 'textColor' | 'value'>) => React.ReactNode),
},
) => {
  const { value, children, ...tabProps } = props;

  const content = typeof children === 'function' ? children(tabProps) : children;
  return (
    <>
      {content}
    </>
  );
};


const styles = (theme: Theme) => createStyles({
  tabsIndicator: {
    // Flips to the left
    right: 'unset', left: 0,
    // Shorten indicator size
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    '& > span': {
      maxHeight: 80,
      height: '100%',
      backgroundColor: theme.palette.primary.main,
    },
  },
  tabsScroller: {
    whiteSpace: 'unset',
    overflow: 'unset',
  },
  expandHeight: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    overflow: 'unset!important',
  },
});
const useStyles = makeStyles(styles);

export const TabsVertical = (props: {
  selected?: string,
  onClick?: (selected: string) => void;
  children?: any,
  TabsProps?: Partial<React.ComponentProps<typeof Tabs>>,
}) => {
  const classes = useStyles();
  return (
    <Tabs
      scrollButtons='off'
      variant='fullWidth'
      orientation='vertical'
      classes={{
        root: classes.expandHeight,
        indicator: classes.tabsIndicator,
        scroller: classNames(classes.tabsScroller, classes.expandHeight),
        flexContainer: classes.expandHeight,

      }}
      value={props.selected}
      onChange={props.onClick ? (e, postId) => props.onClick?.(postId) : undefined}
      // Used for shortening indicator size
      TabIndicatorProps={{ children: <span /> }}
      {...props.TabsProps}
    >
      {props.children}
    </Tabs>
  );
};



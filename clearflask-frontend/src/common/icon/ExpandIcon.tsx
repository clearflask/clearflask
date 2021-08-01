// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { IconButton, SvgIcon } from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import Icon from '@material-ui/icons/ExpandLess';
import classNames from 'classnames';
import React from 'react';

const styles = (theme: Theme) => createStyles({
  expandIcon: {
    transform: 'rotate(90deg)',
    transition: theme.transitions.create('transform'),
  },
  expandIconExpanded: {
    transform: 'rotate(180deg)',
  },
});
const useStyles = makeStyles(styles);

const ExpandIcon = (props: {
  expanded?: boolean,
  onExpandChanged?: (expanded: boolean) => void,
  IconButtonProps?: React.ComponentProps<typeof IconButton>,
  IconProps?: React.ComponentProps<typeof SvgIcon>,
}) => {
  const classes = useStyles();
  const { expanded, ...SvgIconProps } = props;
  return (
    <IconButton
      onClick={e => props.onExpandChanged?.(!props.expanded)}
      {...props.IconButtonProps}
    >
      <Icon
        {...SvgIconProps}
        className={classNames(
          classes.expandIcon,
          !!expanded && classes.expandIconExpanded,
          props.IconProps?.className,
        )}
      />
    </IconButton>
  );
}
export default ExpandIcon;

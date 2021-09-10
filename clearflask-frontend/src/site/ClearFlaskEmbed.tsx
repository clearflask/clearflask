// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Fab } from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import React, { useRef, useState } from 'react';
import ClosablePopper from '../common/ClosablePopper';
import CollapseV5 from '../common/CollapseV5';
import windowIso from '../common/windowIso';

const useStyles = makeStyles((theme: Theme) => createStyles({
  popper: {
    height: 400,
    maxHeight: theme.vh(90),
    width: 400,
    maxWidth: '90vw',
  },
  fabContainer: {
    position: 'fixed',
    right: theme.spacing(4),
    bottom: theme.spacing(4),
    [theme.breakpoints.down('sm')]: {
      right: theme.spacing(1),
      bottom: theme.spacing(1),
    },
    zIndex: theme.zIndex.appBar + 1,
  },
  fab: {
    textTransform: 'none',
  },
  noWrap: {
    whiteSpace: 'nowrap',
  },
}));

export const ClearFlaskEmbedHoverFeedback = (props: {
  path?: string;
  Icon: any;
  preload?: boolean;
}) => {
  const { path, Icon, preload } = props;
  const [demoOpen, setDemoOpen] = useState<boolean>();
  const [isHovering, setIsHovering] = useState<boolean>();
  const anchorRef = useRef<any>(null);
  const classes = useStyles();
  return (
    <>
      <div
        ref={anchorRef}
        className={classes.fabContainer}
        onMouseOver={() => setIsHovering(true)}
        onMouseOut={() => setIsHovering(false)}
      >
        <Fab
          className={classes.fab}
          onClick={() => setDemoOpen(!demoOpen)}
          color='primary'
          variant='extended'
        >
          <Icon />
          <CollapseV5 in={isHovering || demoOpen} orientation='horizontal'>
            <span className={classes.noWrap}>&nbsp;What do you think?</span>
          </CollapseV5>
        </Fab>
      </div>
      <ClosablePopper
        anchorType='ref'
        anchor={anchorRef}
        closeButtonPosition='top-left'
        open={!!demoOpen}
        onClose={() => setDemoOpen(false)}
        placement='top'
        arrow
        clickAway
        paperClassName={classes.popper}
        keepMounted
      >
        <iframe
          title='Demo: ClearFlask Feedback'
          src={(demoOpen !== undefined // After it's open, keep it open
            || isHovering !== undefined // After hovered once, keep it preloaded
            || preload) ? `${windowIso.location.protocol}//feedback.${windowIso.location.host}/${path || ''}` : 'about:blank'}
          width='100%'
          height='100%'
          frameBorder={0}
        />
      </ClosablePopper>
    </>
  );
};

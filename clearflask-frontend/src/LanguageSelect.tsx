// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { IconButton, Table, TableBody, TableRow } from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import TranslateIcon from '@material-ui/icons/Translate';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ClosablePopper from './common/ClosablePopper';
import { contentScrollApplyStyles, Orientation } from './common/ContentScroll';
import ImgIso from './common/ImgIso';
import windowIso from './common/windowIso';
import { supportedLanguages } from './i18n';

const styles = (theme: Theme) => createStyles({
  labelOptionContainer: {
    display: 'flex',
    alignItems: 'center',
    margin: theme.spacing(1, 2),
    cursor: 'pointer',
  },
  flagFade: {
    '&:not(:hover)': {
      opacity: 0.5,
    },
  },
  flag: {
    opacity: 1,
    cursor: 'pointer',
    transition: theme.transitions.create(['opacity', 'filter']),
    '&:not(:hover)': {
      filter: 'grayscale(50%)',
    },
  },
  table: {
    whiteSpace: 'nowrap',
    ...contentScrollApplyStyles({
      theme,
      orientation: Orientation.Horizontal,
      backgroundColor: theme.palette.background.paper,
    }),
  },
});
const useStyles = makeStyles(styles);
export const LanguageSelect = (props: {
  noFade?: boolean;
}) => {
  const { i18n } = useTranslation();
  const classes = useStyles();
  const [anchor, setAnchor] = useState<HTMLButtonElement>();

  return (
    <IconButton
      aria-label='Language'
      onClick={e => setAnchor(e.currentTarget)}
    >
      <TranslateIcon fontSize='inherit' />
      <ClosablePopper
        anchorType='element'
        anchor={anchor}
        open={!!anchor}
        onClose={() => setAnchor(undefined)}
        placement='bottom-end'
        arrow
        clickAway
        closeButtonPosition='disable'
      >
        <div className={classes.table}>
          <Table size='medium'>
            <TableBody>
              {supportedLanguages.map(lang => (
                <TableRow
                  key={lang.code}
                  hover
                  selected={lang.code === i18n.language}
                  onClick={() => i18n.changeLanguage(lang.code)}
                >
                  <div className={classes.labelOptionContainer}>
                    <ImgIso img={lang.img} minWidth={30} minHeight={30} />
                    &nbsp;&nbsp;&nbsp;
                    {lang.label}
                  </div>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ClosablePopper>
    </IconButton>
  );
};

export const CrowdInInlineEditing = () => {
  const [loaded, setLoaded] = useState<boolean>();
  const { i18n } = useTranslation();
  useEffect(() => {
    i18n.on('languageChanged', lng => {
      if (loaded) return;
      if (!!windowIso.isSsr) return;
      if (!supportedLanguages.find(l => l.code === lng)?.isContribute) return;

      setLoaded(true);
      windowIso['_jipt'] = [['project', 'clearflask']];
      const d = windowIso.document;
      var s = d.createElement('script');
      s.type = 'text/javascript';
      s.src = '//cdn.crowdin.com/jipt/jipt.js';
      const x = d.getElementsByTagName('script')[0];
      x.parentNode?.insertBefore(s, x);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

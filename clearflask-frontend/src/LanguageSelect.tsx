// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Table, TableBody, TableRow } from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import TranslateIcon from '@material-ui/icons/Translate';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ClosablePopper from './common/ClosablePopper';
import { contentScrollApplyStyles, Orientation } from './common/ContentScroll';
import ImgIso from './common/ImgIso';
import windowIso from './common/windowIso';
import { defaultLanguage, supportedLanguages } from './i18n';

const styles = (theme: Theme) => createStyles({
  labelOptionContainer: {
    display: 'flex',
    alignItems: 'center',
    margin: theme.spacing(1, 2),
    cursor: 'pointer',
  },
  flexGrow: {
    flexGrow: 1,
  },
  langLabel: {
    marginLeft: theme.spacing(2),
    fontWeight: 'bold',
  },
  langPerc: {
    marginLeft: theme.spacing(2),
    fontSize: '0.8em',
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
      orientation: Orientation.Vertical,
      backgroundColor: theme.palette.background.paper,
    }),
    maxHeight: 'min(300px, 100vh)',
    height: 'fit-content',
  },
});
const useStyles = makeStyles(styles);
export const LanguageSelect = (props: {
  noFade?: boolean;
  whitelist?: string[];
}) => {
  const { i18n } = useTranslation();
  const classes = useStyles();
  const [anchor, setAnchor] = useState<HTMLButtonElement>();

  const whitelistSet = props.whitelist ? new Set(props.whitelist) : undefined;

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
              {supportedLanguages.filter(lang => !whitelistSet || lang.code === i18n.language || whitelistSet.has(lang.code)).map(lang => (
                <TableRow
                  key={lang.code}
                  hover
                  selected={lang.code === i18n.language}
                  onClick={() => i18n.changeLanguage(lang.code)}
                >
                  <div className={classes.labelOptionContainer}>
                    <ImgIso img={lang.img} minWidth={30} minHeight={30} />
                    <div className={classes.langLabel}>{lang.label}</div>
                    {/* Percentage DISABLED {lang.perc !== undefined && (
                      <>
                        <div className={classes.flexGrow} />
                        <div className={classes.langPerc}>{Math.round(lang.perc * (lang.code === 'en' ? 1 : percOfSiteTextI18n) * 100)}&#37;</div>
                      </>
                    )} */}
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
  const [crowdInLoaded, setCrowdInLoaded] = useState<boolean>();
  const [contributeSelected, setContributeSelected] = useState<boolean>();
  const { i18n } = useTranslation();
  useEffect(() => {
    i18n.on('languageChanged', lng => {
      setContributeSelected(!!supportedLanguages.find(l => l.code === lng)?.isContribute);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!!contributeSelected && !crowdInLoaded) {
    const onClose = () => i18n.changeLanguage(defaultLanguage);
    return (
      <Dialog
        open
        onClose={onClose}
      >
        <DialogTitle>Open language editor</DialogTitle>
        <DialogContent>
          <DialogContentText>We use CrowdIn to help you translate text directly on our site.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            color='primary'
            onClick={() => {
              if (!!crowdInLoaded || !!windowIso.isSsr) return;
              setCrowdInLoaded(true);
              windowIso['_jipt'] = [['project', 'clearflask']];
              const d = windowIso.document;
              var s = d.createElement('script');
              s.type = 'text/javascript';
              s.src = '//cdn.crowdin.com/jipt/jipt.js';
              const x = d.getElementsByTagName('script')[0];
              x.parentNode?.insertBefore(s, x);
            }}>Continue</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return null;
};

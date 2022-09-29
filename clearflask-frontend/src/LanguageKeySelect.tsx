// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { IconButton, Table, TableBody, TableRow } from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import TranslateIcon from '@material-ui/icons/Translate';
import Fuse from 'fuse.js';
import React, { useEffect, useState } from 'react';
import { Namespace, useTranslation } from 'react-i18next';
import ClosablePopper from './common/ClosablePopper';
import { contentScrollApplyStyles, Orientation } from './common/ContentScroll';

type SearchEntry = {
  k: string;
  v: string;
};

const styles = (theme: Theme) => createStyles({
  labelMessage: {
    margin: theme.spacing(1, 2),
  },
  labelOptionContainer: {
    display: 'flex',
    alignItems: 'center',
    margin: theme.spacing(1, 2),
    cursor: 'pointer',
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
const LanguageKeySelect = (props: {
  ns: Namespace;
  value: string;
  setValue: (value: string) => void;
}) => {
  const { i18n } = useTranslation(props.ns);
  const classes = useStyles();

  const [anchor, setAnchor] = useState<HTMLButtonElement>();

  const [fuse, setFuse] = useState<Fuse<SearchEntry>>();
  useEffect(() => {
    if (!anchor) return;
    const bundle = i18n.getResourceBundle(i18n.language, props.ns as string) as { [k: string]: string };
    const bundleArr: SearchEntry[] = Object.entries(bundle)
      .filter(([k, v]) => !k.includes('{{'))
      .map(([k, v]) => ({ k, v }));
    setFuse(new Fuse(bundleArr, {
      keys: ['k', 'v'],
    }));
  }, [anchor, props.ns, i18n.language]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = fuse?.search(props.value || '', {
    limit: 5,
  });

  return (
    <IconButton
      aria-label='Select translated text'
      onClick={e => setAnchor(e.currentTarget)}
      color={i18n.exists(props.value) ? 'primary' : undefined}
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
        {!results?.length && (
          <div className={classes.labelMessage}>
            No translation found
          </div>
        )}
        <div className={classes.table}>
          <Table size='medium'>
            <TableBody>
              {results?.map(result => (
                <TableRow
                  key={result.item.k}
                  hover
                  selected={result.item.k === props.value}
                  onClick={() => {
                    props.setValue(result.item.k);
                    setAnchor(undefined);
                  }}
                >
                  <div className={classes.labelOptionContainer}>
                    {result.item.v}
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
export default LanguageKeySelect;

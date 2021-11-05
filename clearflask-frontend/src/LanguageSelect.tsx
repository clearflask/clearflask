// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import SelectionPicker, { Label } from './app/comps/SelectionPicker';
import ImgIso from './common/ImgIso';
import { defaultLanguage, supportedLanguages } from './i18n';

type LangLabel = Label & { labelOption: React.ReactNode };

const styles = (theme: Theme) => createStyles({
  labelOptionContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  selectionPicker: {
    margin: theme.spacing(1),
  },
  inputRoot: {
    flexWrap: 'nowrap',
    '&:before': {
      content: 'none',
    },
    '&:after': {
      content: 'none',
    },
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
});
const useStyles = makeStyles(styles);
export const LanguageSelect = (props: {
  className?: string;
  noFade?: boolean;
}) => {
  const { i18n } = useTranslation();
  const classes = useStyles();
  const initialLanguage = useRef(i18n.language);

  // Hide language selection for default language for now
  // until we have a better selection of languages
  if (initialLanguage.current === defaultLanguage) {
    return null;
  }

  const options: Label[] = [];
  const selected: Label[] = [];

  supportedLanguages.forEach(lang => {
    const label: LangLabel = {
      labelOption: (
        <div className={classNames(classes.labelOptionContainer, props.className)}>
          <ImgIso img={lang.img} minWidth={30} minHeight={30} />
          &nbsp;&nbsp;&nbsp;
          {lang.label}
        </div>
      ),
      label: (
        <ImgIso className={classNames(classes.flag, !props.noFade && classes.flagFade)} img={lang.img} minWidth={20} minHeight={20} />
      ),
      value: lang.code,
    };
    if (lang.code === i18n.language) selected.push(label);
    options.push(label);
  });

  return (
    <SelectionPicker
      classes={{
        autocomplete: classes.selectionPicker,
        inputRoot: classes.inputRoot,
      }}
      PopperProps={{
        disablePortal: false,
      }}
      value={selected}
      options={options}
      showTags
      bareTags
      disableFilter
      disableInput
      disableClearable
      inputMinWidth={0}
      forceDropdownIcon={false}
      renderOption={(label, selected) => (label as LangLabel).labelOption}
      onValueChange={(labels) => {
        var selectedLabel: Label | undefined = labels[0];
        i18n.changeLanguage(selectedLabel.value);
      }}
    />
  );
};

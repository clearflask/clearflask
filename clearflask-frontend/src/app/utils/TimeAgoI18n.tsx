// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import React from 'react';
import { useTranslation } from 'react-i18next';
import TimeAgo from 'react-timeago';

const delay = 3000;

export default function TimeAgoI18n(props: Omit<React.ComponentProps<typeof TimeAgo>, 'formatter'>) {
  const {...timeAgoProps} = props;
  const { t } = useTranslation('app');
  return (
    <TimeAgo
      {...timeAgoProps}
      formatter={ (value, unit, suffix) => {
        const unitTranslated = t(`unit-${value === 1 ? 'single' : 'multiple'}-${unit}` as any);
        return t(`one-second-${suffix === 'ago' ? 'ago' : 'from-now'}` as any, { value, unit: unitTranslated });
      }}
    />
  );
}

// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React from 'react';
import Delimited from '../app/utils/Delimited';
import windowIso from './windowIso';

export interface Term {
  shortName?: string;
  link?: string;
}

const legalDefault: Array<Term> = [
  { shortName: 'Privacy', link: `https://${windowIso.parentDomain}/privacy` },
  { shortName: 'Terms', link: `https://${windowIso.parentDomain}/terms` },
];

const styles = (theme: Theme) => createStyles({
  legal: {
    marginTop: theme.spacing(1),
    display: 'flex',
    justifyContent: 'center',
    whiteSpace: 'pre-wrap',
    fontSize: '0.7em',
    color: theme.palette.text.secondary,
  },
  legalLink: {
    color: 'unset',
    borderBottom: '1px dashed',
    textDecoration: 'none',
    '&:hover': {
      borderBottomStyle: 'solid',
    },
  },
});

interface Props {
  overrideText?: string;
  overrideTerms?: Array<Term>;
}

class AcceptTerms extends React.Component<Props & WithStyles<typeof styles, true>> {
  render() {
    var legalDocs: Array<Term> = this.props.overrideTerms || legalDefault;

    return (legalDocs && legalDocs.length > 0) ? (
      <div className={this.props.classes.legal}>
        {this.props.overrideText || 'You agree to our '}
        <Delimited delimiter={', '} delimiterLast={' and '}>
          {legalDocs.map(doc => ( // eslint-disable-next-line react/jsx-no-target-blank
            <a key={doc.shortName} href={doc.link} target="_blank" rel="noopener nofollow" className={this.props.classes.legalLink}>{doc.shortName}</a>
          ))}
        </Delimited>
      </div>
    ) : null;
  }
}

export default withStyles(styles, { withTheme: true })(AcceptTerms);

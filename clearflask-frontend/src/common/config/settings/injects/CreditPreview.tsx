// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { createStyles, Table, TableBody, TableCell, TableRow, Theme, withStyles, WithStyles } from '@material-ui/core';
import React, { Component } from 'react';
import * as Client from '../../../../api/client';
import DividerCorner from '../../../../app/utils/DividerCorner';
import * as ConfigEditor from '../../configEditor';
import CreditView from '../../CreditView';

const styles = (theme: Theme) => createStyles({
  headerCell: {
    color: 'rgba(0, 0, 0, 0.54)',
    borderRight: '1px solid rgba(224, 224, 224, 1)',
  },
  dataCell: {
    whiteSpace: 'nowrap',
  },
});

interface Props extends WithStyles<typeof styles, true> {
  editor: ConfigEditor.Editor;
}

class CreditPreview extends Component<Props> {
  unsubscribe?: () => void;

  componentDidMount() {
    this.unsubscribe = this.props.editor.subscribe(this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    const credits = this.props.editor.getConfig().users.credits;
    if (!credits) return null;

    const headerRow: React.ReactNode[] = [];
    const dataRow: React.ReactNode[] = [];
    headerRow.push((
      <TableCell key='credit' align='right' className={this.props.classes.headerCell}>
        Value
      </TableCell>
    ));
    dataRow.push((
      <TableCell key='preview' align='right' className={this.props.classes.headerCell}>
        Preview
      </TableCell>
    ));
    this.getEdgeCases(credits).forEach(preview => {
      headerRow.push((
        <TableCell key={preview} align='center' className={this.props.classes.dataCell}>
          {preview}
        </TableCell>
      ));
      dataRow.push((
        <TableCell key={Math.random()} align='center' className={this.props.classes.dataCell}>
          <CreditView val={preview} credits={credits} />
        </TableCell>
      ));
    });

    return (
      <DividerCorner title='See how credits will be displayed' height='100%'>
        <div style={{
          width: 'min-content',
        }}>
          <Table>
            <TableBody>
              <TableRow key='header'>
                {headerRow}
              </TableRow>
              <TableRow key='data'>
                {dataRow}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </DividerCorner>
    );
  }

  getEdgeCases(credits: Client.Credits): Array<number> {
    if (!credits || !credits.formats || credits.formats.length === 0) {
      return [0, 100];
    }

    const previews = new Set<number>();
    previews.add(0);
    previews.add(100);
    credits.formats.forEach(format => {
      if (format.greaterOrEqual) {
        previews.add(format.greaterOrEqual);
        const belowEdge = format.greaterOrEqual - 1;
        if (belowEdge >= 0) previews.add(belowEdge);
      }
      if (format.lessOrEqual) {
        previews.add(format.lessOrEqual);
        previews.add(format.lessOrEqual + 1);
      }
      const rangeStart = format.greaterOrEqual || 0;
      const rangeEnd = format.lessOrEqual || rangeStart * 2;
      const rangeMid = (rangeEnd - rangeStart) / 2 + rangeStart;
      previews.add(rangeMid);
    });

    return [...previews].sort((a, b) => a - b);
  }
}

export default withStyles(styles, { withTheme: true })(CreditPreview);

import { Table, TableBody, TableCell, TableRow, createStyles, withStyles, WithStyles, Theme } from '@material-ui/core';
import React, { Component } from 'react';
import * as ConfigEditor from '../../configEditor';
import CreditView from '../../CreditView';

const styles = (theme:Theme) => createStyles({
  headerCell: {
    color: 'rgba(0, 0, 0, 0.54)',
    borderRight: '1px solid rgba(224, 224, 224, 1)',
  },
  dataCell: {
    whiteSpace: 'nowrap',
  },
});

interface Props extends WithStyles<typeof styles> {
  editor:ConfigEditor.Editor;
}

class CreditPreview extends Component<Props> {
  unsubscribe?:()=>void;

  componentDidMount() {
    this.unsubscribe = this.props.editor.subscribe(this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    const headerRow:React.ReactNode[] = [];
    const dataRow:React.ReactNode[] = [];
    headerRow.push((
      <TableCell key='credit' align='right' className={this.props.classes.headerCell}>
        Credit
      </TableCell>
    ));
    dataRow.push((
      <TableCell key='preview' align='right' className={this.props.classes.headerCell}>
        Preview
      </TableCell>
    ));
    const credits = this.props.editor.getConfig().credits;
    this.getEdgeCases().forEach(preview => {
      headerRow.push((
        <TableCell key={preview} align='center' className={this.props.classes.dataCell}>
          {preview}
        </TableCell>
      ));
      dataRow.push((
        <TableCell key={preview} align='center' className={this.props.classes.dataCell}>
          <CreditView val={preview} credits={credits} />
        </TableCell>
      ));
    });

    return (
      <div style={{
        display: 'inline-block',
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
    );
  }

  getEdgeCases():Array<number> {
    const credits = this.props.editor.getConfig().credits;
    if(!credits.formats || credits.formats.length === 0) {
      return [0, 100];
    }

    const previews = new Set<number>();
    previews.add(0);
    previews.add(100);
    credits.formats.forEach(format => {
      if(format.greaterOrEqual) {
        previews.add(format.greaterOrEqual);
        const belowEdge = format.greaterOrEqual - (credits.increment || 1);
        if(belowEdge >= 0) previews.add(belowEdge);
      }
      if(format.lessOrEqual) {
        previews.add(format.lessOrEqual);
        previews.add(format.lessOrEqual + (credits.increment || 1));
      }
      const rangeStart = format.greaterOrEqual || 0;
      const rangeEnd = format.lessOrEqual || rangeStart * 2;
      const rangeMid = (rangeEnd - rangeStart) / 2 + rangeStart;
      previews.add(credits.increment
        ? rangeMid - (rangeMid % credits.increment)
        : rangeMid);
    });

    return [...previews].sort((a,b) => a - b);
  }
}

export default withStyles(styles, { withTheme: true })(CreditPreview);

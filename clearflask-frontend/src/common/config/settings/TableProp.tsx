// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Collapse, FormControlLabel, FormHelperText, IconButton, InputLabel, Switch, Table, TableBody, TableCell, TableHead, TableRow } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/AddRounded';
import MoveDownIcon from '@material-ui/icons/ArrowDownward';
import MoveUpIcon from '@material-ui/icons/ArrowUpward';
import DeleteIcon from '@material-ui/icons/Delete';
import MoreIcon from '@material-ui/icons/MoreHoriz';
import classNames from 'classnames';
import React, { Component } from 'react';
import { Server } from '../../../api/server';
import * as ConfigEditor from '../configEditor';
import Property, { PropertyInputMinWidth } from './Property';

const styles = (theme: Theme) => createStyles({
  table: {
    border: '1px solid ' + theme.palette.divider,
    display: 'inline-block',
  },
  tableMargins: {
    marginLeft: '30px',
    marginTop: '15px',
  },
  helperText: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  hidden: {
    visibility: 'hidden',
  }
});

interface Props {
  styleOuter?: React.CSSProperties;
  key: string;
  server: Server;
  data: ConfigEditor.PageGroup | ConfigEditor.ArrayProperty;
  bare?: boolean;
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  errorMsg?: string;
  width?: string | number;
  pageClicked?: (path: ConfigEditor.Path) => void;
  requiresUpgrade?: (propertyPath: ConfigEditor.Path) => boolean;
  hideReorder?: boolean;
  hideDelete?: boolean;
  hideAdd?: boolean;
}

class TableProp extends Component<Props & WithStyles<typeof styles, true>> {
  unsubscribe?: () => void;

  componentDidMount() {
    this.unsubscribe = this.props.data.subscribe(this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    const header: React.ReactNode[] = [];
    const rows: React.ReactNode[] = [];
    if (this.props.data.type === 'pagegroup') {
      const pageGroup: ConfigEditor.PageGroup = this.props.data;
      if (pageGroup.getChildPages().length > 0 && this.props.pageClicked) header.push(this.renderHeaderCellShowLink());
      pageGroup.getChildPages().forEach((childPage, childPageIndex, arr) => {
        const row: React.ReactNode[] = [];
        pageGroup.tablePropertyNames.forEach((propName, propNameIndex) => {
          const prop = childPage.getChildren().props.find(childPageProp => propName === childPageProp.path[childPageProp.path.length - 1])!;
          if (prop === undefined) throw Error(`PageGroup's tablePropertyNames contains invalid prop name ${propName} on path ${pageGroup.path}`);
          if (childPageIndex === 0) {
            header.push(this.renderHeaderCell(propNameIndex, prop.name, prop.description));
          }
          row.push(this.renderDataCell(prop));
        });
        rows.push(this.renderRow(row, `${arr.length}/${childPageIndex}`, childPageIndex, arr.length, this.props.pageClicked));
      });
    } else if (this.props.data.childType === ConfigEditor.PropertyType.Object) {
      const arrayProp: ConfigEditor.ArrayProperty = this.props.data;
      arrayProp.childProperties && arrayProp.childProperties
        .forEach((childProp, childPropIndex, arr) => {
          const childPropObject = childProp as ConfigEditor.ObjectProperty;
          const row: React.ReactNode[] = [];
          childPropObject.childProperties && childPropObject.childProperties
            .filter(childProp => !childProp.hide)
            .forEach((grandchildProp, grandchildPropIndex) => {
              if (childPropIndex === 0) {
                header.push(this.renderHeaderCell(grandchildPropIndex, grandchildProp.name, grandchildProp.description));
              }
              row.push(this.renderDataCell(grandchildProp));
            });
          rows.push(this.renderRow(row, `${arr.length}/${childPropIndex}`, childPropIndex, arr.length));
        });
    } else {
      const arrayProp: ConfigEditor.ArrayProperty = this.props.data;
      arrayProp.childProperties && arrayProp.childProperties
        .filter(childProp => !childProp.hide)
        .forEach((childProp, childPropIndex, arr) => {
          if (childPropIndex === 0) {
            header.push(this.renderHeaderCell(0, childProp.name, childProp.description));
          }
          const row = [this.renderDataCell(childProp)];
          rows.push(this.renderRow(row, `${arr.length}/${childPropIndex}`, childPropIndex, arr.length));
        });
    }

    var content = (
      <>
        {rows.length > 0 && (
          <div className={classNames(
            this.props.classes.table,
            !this.props.bare && this.props.classes.tableMargins,
          )}>
            <Table style={{ width: 'inherit' }}>
              {header.length > 0 && (
                <TableHead>
                  <TableRow key='header'>
                    {header}
                    <TableCell key='delete' align='center' padding='checkbox'></TableCell>
                  </TableRow>
                </TableHead>
              )}
              <TableBody>
                {rows}
              </TableBody>
            </Table>
          </div>
        )}
        {!this.props.hideAdd && (
          <div style={{ marginLeft: '30px' }}>
            <IconButton aria-label='Add' onClick={() => {
              this.props.data.insert();
            }}>
              <AddIcon />
            </IconButton>
          </div>
        )}
      </>
    );
    const label = !this.props.bare && (
      <InputLabel error={!!this.props.errorMsg} shrink={false}>{this.props.label}</InputLabel>
    );
    const helperText = (this.props.errorMsg || (!this.props.bare && this.props.helperText)) && (
      <div><div className={this.props.classes.helperText}>
        <FormHelperText error={!!this.props.errorMsg}>{this.props.errorMsg || this.props.helperText}</FormHelperText>
      </div></div>
    );
    if (this.props.data.required) {
      return (
        <div>
          {(label || helperText) && (
            <div style={{
              width: this.props.width,
              minWidth: PropertyInputMinWidth,
            }}>
              {label}
              {helperText}
            </div>
          )}
          {content}
        </div>
      );
    } else {
      return (
        <div>
          <div style={{
            width: this.props.width,
            minWidth: PropertyInputMinWidth,
          }}>
            {label}
            <FormControlLabel
              control={(
                <Switch
                  checked={!!this.props.data.value}
                  onChange={(e, checked) => this.props.data.set(checked ? true : undefined)}
                  color='default'
                />
              )}
              label={helperText}
            />
          </div>
          <Collapse mountOnEnter in={this.props.data.value || false}>
            {content}
          </Collapse>
        </div>
      );
    }
  }

  renderRow(rowCells, key: string, index: number, total: number, onPageClick?: (path: ConfigEditor.Path) => void) {
    const allowReorder = !this.props.data.disableReordering && !this.props.hideReorder;
    return (
      <TableRow key={key}>
        {onPageClick && (
          <TableCell key={'more' + key} align='center' padding='checkbox'>
            <IconButton aria-label="More" onClick={() => {
              onPageClick([...this.props.data.path, index]);
            }}>
              <MoreIcon />
            </IconButton>
          </TableCell>
        )}
        {rowCells}
        <TableCell key={'action' + key} align='left' padding='checkbox'>
          <div style={{
            display: 'flex',
          }}>
            {allowReorder && (
              <div style={{
                display: 'flex',
                flexDirection: 'row',
              }}>
                <IconButton aria-label="Move up" className={(index === 0) ? this.props.classes.hidden : undefined} onClick={() => {
                  this.props.data.moveUp(index);
                }}>
                  <MoveUpIcon />
                </IconButton>
                <IconButton aria-label="Move down" className={(index === (total - 1)) ? this.props.classes.hidden : undefined} onClick={() => {
                  this.props.data.moveDown(index);
                }}>
                  <MoveDownIcon />
                </IconButton>
              </div>
            )}
            {!this.props.hideDelete && (
              <div style={{
                display: 'flex',
                flexDirection: allowReorder ? 'column' : 'row',
              }}>
                {/* TODO Duplication needs to regenerate ids, for now remove this functionality <IconButton aria-label="Duplicate" onClick={() => {
                  this.props.data.duplicate(index);
                }}>
                  import DuplicateIcon from '@material-ui/icons/FileCopyOutlined';
                  <DuplicateIcon />
                </IconButton> */}
                <IconButton aria-label="Delete" onClick={() => {
                  this.props.data.delete(index);
                }}>
                  <DeleteIcon />
                </IconButton>
              </div>
            )}
          </div>
        </TableCell>
      </TableRow>
    )
  }

  renderDataCell(prop: ConfigEditor.Page | ConfigEditor.PageGroup | ConfigEditor.Property) {
    return (
      <TableCell key={prop.key} align='center' size='small'>
        <Property
          server={this.props.server}
          isInsideMuiTable
          bare
          key={prop.key}
          prop={prop}
          pageClicked={this.props.pageClicked}
          requiresUpgrade={this.props.requiresUpgrade}
          width='100%'
        />
      </TableCell>
    );
  }
  renderHeaderCell(key: string | number, name?: string, description?: string) {
    return (
      <TableCell key={key} align='center' style={{ fontWeight: 'normal', width: this.props.width }} size='small'>
        {name && (<InputLabel shrink={false}>{name}</InputLabel>)}
        {description && (<FormHelperText>{description}</FormHelperText>)}
      </TableCell>
    );
  }
  renderHeaderCellShowLink() {
    return (
      <TableCell key='showLink' padding='checkbox'></TableCell>
    );
  }
}

export default withStyles(styles, { withTheme: true })(TableProp)

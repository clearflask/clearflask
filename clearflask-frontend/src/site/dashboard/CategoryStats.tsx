import { Table, TableBody, TableCell, TableRow, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import ServerAdmin from '../../api/serverAdmin';
import CategorySelect from '../../app/comps/CategorySelect';
import DividerCorner from '../../app/utils/DividerCorner';
import Loader from '../../app/utils/Loader';
import { contentScrollApplyStyles } from '../../common/ContentScroll';

const styles = (theme: Theme) => createStyles({
  root: {
    width: 'max-content',
    minWidth: 300,
  },
  resultsContainer: {
    display: 'inline-flex',
    flexWrap: 'wrap',
  },
  categorySelect: {
    marginBottom: -1,
  },
  resultsItem: {
    margin: theme.spacing(2, 6),
  },
  resultsItemInner: {
    padding: theme.spacing(4),
    display: 'flex',
    maxHeight: (props: Props) => props.maxContentHeight || undefined,
    width: 'max-content',
    ...contentScrollApplyStyles(theme, undefined, true),
  },
  table: {
    margin: 0,
    maxWidth: 'max-content',
    '& .MuiTableCell-root': {
      borderBottom: 'none !important',
    },
  },
  bigValue: {
    fontSize: '3em',
  },
  value: {
    fontSize: '1.2em',
  },
  viewTitleContainer: {
    display: 'flex',
    alignItems: 'baseline',
  },
  viewTitleWithDropdownContainer: {
    display: 'flex',
    alignItems: 'center',
  },
});
interface Props {
  server: Server;
  className?: string;
  maxContentHeight?: number | string;
}
interface ConnectProps {
  categories?: Client.Category[];
}
interface State {
  selectedCategoryId?: string;
  results?: Admin.IdeaAggregateResponse;
  error?: string;
}
class CategoryStats extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  constructor(props) {
    super(props);

    this.state = {
      selectedCategoryId: props.categories[0]?.categoryId,
    };
  }

  componentDidMount() {
    this.state.selectedCategoryId && this.searchCategory(this.state.selectedCategoryId);
  }

  render() {
    if (!this.props.categories || this.props.categories.length <= 0) return null;

    const category = this.state.selectedCategoryId && this.props.categories?.find(c => c.categoryId === this.state.selectedCategoryId) || undefined;
    const total = this.state.results?.total;
    const statuses = this.state.results?.statuses;
    const tags = this.state.results?.tags;

    return (
      <DividerCorner
        className={classNames(this.props.classes.root, this.props.className)}
        width='70%'
        title={this.props.categories.length !== 1 || !category ? undefined : (
          <div className={this.props.classes.viewTitleContainer}>
            <span>Statistics for&nbsp;</span>
            <span style={{ color: category.color }}>{category.name}</span>
          </div>
        )}
        header={this.props.categories.length <= 1 || !category ? undefined : (
          <div className={this.props.classes.viewTitleWithDropdownContainer}>
            <span>Statistics for&nbsp;</span>
            <CategorySelect
              className={this.props.classes.categorySelect}
              categoryOptions={this.props.categories}
              value={category?.categoryId || ''}
              onChange={categoryId => {
                this.setState({
                  selectedCategoryId: categoryId,
                  results: undefined,
                  error: undefined,
                });
                this.searchCategory(categoryId);
              }}
            />
          </div>
        )}
      >
        <Loader error={this.state.error} loaded={!!category}>
          {category && (
            <div className={this.props.classes.resultsContainer}>
              {this.renderResultItem('Total', this.renderValue(total, true))}
              {category.workflow.statuses.length > 0 && this.renderTable('By status',
                category.workflow.statuses.map(status => this.renderRow(
                  status.name,
                  status.color,
                  statuses ? this.renderValue(statuses[status.statusId]) || 0 : undefined)))}
              {category.tagging.tags.length > 0 && this.renderTable('By tag',
                category.tagging.tags.map(tag => this.renderRow(
                  tag.name,
                  tag.color,
                  tags ? this.renderValue(tags[tag.tagId] || 0) : undefined)))}
            </div>
          )}
        </Loader>
      </DividerCorner>
    );
  }

  renderTable(title: string, children: React.ReactNode) {
    return this.renderResultItem(title, (
      <Table
        size='small'
        className={this.props.classes.table}
      >
        <TableBody>
          {children}
        </TableBody>
      </Table>
    ));
  }

  renderRow(title: string, color?: string, value?: React.ReactNode): React.ReactNode {
    return (
      <TableRow key={title}>
        <TableCell><Typography variant='caption' style={{ color: color }}>{title}</Typography></TableCell>
        <TableCell><Typography>{value}</Typography></TableCell>
      </TableRow>
    );
  }

  renderResultItem(title: string, content: React.ReactNode): React.ReactNode {
    return (
      <DividerCorner
        className={this.props.classes.resultsItem}
        innerClassName={this.props.classes.resultsItemInner}
        title={title}
      >
        {content}
      </DividerCorner>
    );
  }

  renderValue(value?: React.ReactNode, big?: boolean): React.ReactNode {
    return (
      <Typography className={classNames(big ? this.props.classes.bigValue : this.props.classes.value)}>
        {value}
      </Typography>
    );
  }

  searchCategory(categoryId: string) {
    ServerAdmin.get().dispatchAdmin().then(d => d.ideaCategoryAggregateAdmin({
      projectId: this.props.server.getProjectId(),
      categoryId,
    })
      .then(results => this.setState({ results })))
      .catch(e => this.setState({ error: 'Failed to load' }));
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props): ConnectProps => {
  const connectProps: ConnectProps = {
    categories: state.conf.conf?.content.categories,
  };
  return connectProps;
})(withStyles(styles, { withTheme: true })(CategoryStats));

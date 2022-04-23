// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import StatusIcon from '@material-ui/icons/ClearAllOutlined';
import TagIcon from '@material-ui/icons/LabelOutlined';
import moment from 'moment';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import CategoryStat from './CategoryStat';
import Histogram from './Histogram';

const styles = (theme: Theme) => createStyles({
  stat: {
  },
  showMoreButtonContainer: {
    position: 'relative',
  },
  showMoreButton: {
    position: 'absolute',
    left: 0,
  },
});
interface Props {
  server: Server;
  className?: string;
}
interface ConnectProps {
  categories?: Client.Category[];
}
interface State {
  showAll?: boolean;
}
class CategoryStats extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = {};
  dispatchedCategoryIds: Set<string> = new Set();

  render() {
    const pieWidth = 300;
    const pieHeight = 200;
    const chartWidth = 100;
    const chartHeight = 70;
    const chartXAxis = {
      min: moment().subtract(7, 'd').toDate(),
      max: new Date(),
    };

    const aggregatePrefix = 'aggr-';
    const fetchAggregate: Set<string> = new Set();

    const stats: React.ReactNode[] = [];
    const showMax = this.state.showAll ? undefined : 3;
    var count = 0;
    var hasMore: boolean = false;
    outer: {
      for (const category of this.props.categories || []) {
        const aggregate: Admin.IdeaAggregateResponse | undefined = this.state[aggregatePrefix + category.categoryId] as Admin.IdeaAggregateResponse;
        var chartAdded: boolean = false;
        if (category.workflow.statuses.length > 1) {
          if (!!showMax && ++count > showMax) {
            hasMore = true;
            break outer;
          }
          chartAdded = true;
          if (aggregate) {
            stats.push(
              <CategoryStat
                className={this.props.classes.stat}
                icon={StatusIcon}
                title={`${category.name} Statuses`}
                chartWidth={pieWidth}
                chartHeight={pieHeight}
                category={category}
                show={{ type: 'status' }}
                results={aggregate}
              />
            );
          } else {
            fetchAggregate.add(category.categoryId);
          }
        }
        for (const tagGroup of category.tagging.tagGroups) {
          if (tagGroup.tagIds.length < 2) continue;

          if (!!showMax && ++count > showMax) {
            hasMore = true;
            break outer;
          }
          chartAdded = true;

          if (aggregate) {
            stats.push(
              <CategoryStat
                className={this.props.classes.stat}
                icon={TagIcon}
                title={`${category.name} ${tagGroup.name}`}
                chartWidth={pieWidth}
                chartHeight={pieHeight}
                category={category}
                show={{ type: 'tag', tagGroup }}
                results={aggregate}
              />
            );
          } else {
            fetchAggregate.add(category.categoryId);
          }
        }
        if (!chartAdded) {
          if (!!showMax && ++count > showMax) {
            hasMore = true;
            break outer;
          }

          stats.push(
            <Histogram
              title={category.name}
              server={this.props.server}
              className={this.props.classes.stat}
              chartWidth={chartWidth}
              chartHeight={chartHeight}
              xAxis={chartXAxis}
              search={d => d.ideaHistogramAdmin({
                projectId: this.props.server.getProjectId(),
                ideaHistogramSearchAdmin: {
                  filterCategoryIds: [category.categoryId],
                  interval: Admin.HistogramInterval.DAY,
                }
              })}
            />
          );
        }
      }
    }

    if (!this.state.showAll && !!hasMore) {
      stats.push(
        <div className={this.props.classes.showMoreButtonContainer}>
          <Button
            className={this.props.classes.showMoreButton}
            onClick={() => this.setState({ showAll: true })}
          >
            Show more
      </Button>
        </div>
      );
    }

    // Fetch data if needed
    fetchAggregate.forEach(categoryId => this.props.server.dispatchAdmin().then(d => d.ideaCategoryAggregateAdmin({
      projectId: this.props.server.getProjectId(),
      categoryId: categoryId,
    }).then(results => this.setState({ [aggregatePrefix + categoryId]: results }))));

    return stats;
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props): ConnectProps => {
  const connectProps: ConnectProps = {
    categories: state.conf.conf?.content.categories,
  };
  return connectProps;
})(withStyles(styles, { withTheme: true })(CategoryStats));

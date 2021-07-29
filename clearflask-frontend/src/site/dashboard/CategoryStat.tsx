import loadable from '@loadable/component';
import { SvgIconTypeMap } from '@material-ui/core';
import { OverridableComponent } from '@material-ui/core/OverridableComponent';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import * as Admin from '../../api/admin';
import Loading from '../../app/utils/Loading';
import { importFailed, importSuccess } from '../../Main';
import GraphBox from './GraphBox';

const ReactApexChart = loadable(() => import(/* webpackChunkName: "ReactApexChart", webpackPrefetch: true */'react-apexcharts').then(importSuccess).catch(importFailed), { fallback: (<Loading />), ssr: false });

const styles = (theme: Theme) => createStyles({
  chart: {
    '& .apexcharts-tooltip .apexcharts-active': {
      color: theme.palette.text.primary,
      background: theme.palette.background.paper + '!important',
      boxShadow: '0px 0px 40px 0 rgba(0,0,0,0.04)',
      border: '1px solid ' + theme.palette.divider,
      padding: theme.spacing(0, 1.5),
    },
  },
});
interface Props {
  className?: string;
  icon?: OverridableComponent<SvgIconTypeMap>;
  title: string;
  chartWidth?: string | number;
  chartHeight?: string | number;
  category: Admin.Category;
  show: {
    type: 'tag',
    tagGroup: Admin.TagGroup;
  } | {
    type: 'status',
  },
  results: Admin.IdeaAggregateResponse;
}
class Histogram extends Component<Props & WithStyles<typeof styles, true>> {

  render() {
    const labels: Array<string> = [];
    const data: Array<number> = [];
    const colors: Array<string> = [];
    var total = 0;
    if (this.props.show.type === 'status') {
      Object.entries(this.props.results.statuses)
        .sort(([, a], [, b]) => a - b)
        .forEach(e => {
          data.push(e[1]);
          const status = this.props.category.workflow.statuses.find(s => s.statusId === e[0]);
          labels.push(status?.name || e[0]);
          colors.push(status?.color || '#2dbaa1');
          total += e[1];
        });
    } else {
      const tagIds = new Set(this.props.show.tagGroup.tagIds);
      Object.entries(this.props.results.tags)
        .filter(e => tagIds.has(e[0]))
        .sort(([, a], [, b]) => a - b)
        .forEach(e => {
          data.push(e[1]);
          const tag = this.props.category.tagging.tags.find(t => t.tagId === e[0]);
          labels.push(tag?.name || e[0]);
          colors.push(tag?.color || this.props.theme.palette.text.primary);
          total += e[1];
        });
    }

    if (total <= 0) {
      return null;
    }

    const chart = (
      <span className={this.props.classes.chart}>
        <ReactApexChart
          series={data}
          options={{
            labels: labels,
            tooltip: {
              enabled: true,
              style: {
                fontFamily: this.props.theme.typography.fontFamily,
                fontSize: '1em',
              },
            },
            dataLabels: {
              enabled: true,
              formatter(val, opts) {
                const name = opts.w.globals.labels[opts.seriesIndex]
                const percentage = val;
                return percentage > 14 ? [name] : [''];
              },
              style: {
                colors: colors,
                fontFamily: this.props.theme.typography.fontFamily,
                fontSize: '1em',
              },
              dropShadow: { enabled: false },
            },
            chart: {
              animations: { enabled: false },
              toolbar: { show: false },
              sparkline: { enabled: true },
            },
            stroke: {
              width: 4,
              colors: 'rgba(255,255,255,1)',
            },
            fill: {
              type: 'gradient',
              colors: ['#2dbaa1', this.props.theme.palette.secondary.main],
              gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.3,
                opacityTo: 0.4,
                stops: [40, 100]
              }
            },
            states: {
              active: {
                filter: {
                  type: 'lighten',
                  value: 0.15,
                }
              },
            },
          }}
          type='donut'
          width={this.props.chartWidth}
          height={this.props.chartHeight}
        />
      </span>
    );

    return (
      <GraphBox
        className={this.props.className}
        icon={this.props.icon}
        title={this.props.title}
        chart={chart}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(Histogram);

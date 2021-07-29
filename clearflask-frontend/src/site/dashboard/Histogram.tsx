import loadable from '@loadable/component';
import { SvgIconTypeMap } from '@material-ui/core';
import { OverridableComponent } from '@material-ui/core/OverridableComponent';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import moment from 'moment';
import React, { Component } from 'react';
import * as Admin from '../../api/admin';
import { Server } from '../../api/server';
import Loading from '../../app/utils/Loading';
import { importFailed, importSuccess } from '../../Main';
import GraphBox from './GraphBox';

const ReactApexChart = loadable(() => import(/* webpackChunkName: "ReactApexChart", webpackPrefetch: true */'react-apexcharts').then(importSuccess).catch(importFailed), { fallback: (<Loading />), ssr: false });

const styles = (theme: Theme) => createStyles({
  chart: {
    '& .apexcharts-svg': {
      overflow: 'visible', // Edges of points get cut off without this
    },
    '& .apexcharts-tooltip': {
      display: 'none',
    },
    '& .apexcharts-xaxistooltip': {
      background: theme.palette.background.paper,
      '&::after': {
        borderBottomColor: theme.palette.background.paper,
      }
    },
  },
});
interface Props {
  className?: string;
  server: Server;
  icon?: OverridableComponent<SvgIconTypeMap>;
  title: string;
  chartWidth?: string | number;
  chartHeight?: string | number;
  xAxis?: {
    min: Date;
    max: Date;
  };
  search: (dispatcher: Admin.Dispatcher) => Promise<Admin.HistogramResponse>;
}
interface State {
  results?: Admin.HistogramResponse;
  error?: string;
}
class Histogram extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = {};

  componentDidMount() {
    if (!this.state.results) {
      this.props.server.dispatchAdmin()
        .then(this.props.search)
        .then(results => this.setState({ results }));
    }
  }

  render() {
    if (!this.state.results) return null;

    // Fill missing data with zeroes
    const data: Array<{ x: number, y: number }> = [];
    const startDate: Date | undefined = this.props.xAxis?.min || this.state.results.points[0]?.ts;
    if (startDate) {
      var pointsIndex = 0;
      const endDate: Date = this.props.xAxis?.max || this.state.results.points[this.state.results.points.length - 1]!.ts;
      for (var currDate = moment(startDate); currDate.diff(endDate, 'days') <= 0; currDate.add(1, 'days')) {
        var cnt = 0;
        const currPoint = this.state.results.points[pointsIndex];
        if (currPoint && currDate.isSame(currPoint.ts, 'day')) {
          cnt = currPoint.cnt;
          pointsIndex++;
        }
        data.push({
          x: currDate.valueOf(),
          y: cnt,
        })
      }
    }

    const chart = (
      <span className={this.props.classes.chart}>
        <ReactApexChart
          series={[{
            data,
          }]}
          options={{
            colors: ['#2dbaa1'],
            tooltip: {
              // enabled: false,
            },
            title: {
              floating: true,
            },
            xaxis: {
              type: 'datetime',
              min: this.props.xAxis?.min,
              max: this.props.xAxis?.max,
              labels: { show: false },
              axisBorder: { show: false },
              axisTicks: { show: false },
              floating: true,
              tooltip: {
                enabled: true,
                offsetY: 5,
                style: {
                  fontFamily: this.props.theme.typography.fontFamily,
                  fontSize: '1em',
                },
              },
            },
            yaxis: {
              labels: { show: false },
              floating: true,
              tooltip: {
                enabled: false,
              },
            },
            grid: {
              show: false,
              padding: {
                left: 0,
                right: 0
              }
            },
            dataLabels: {
              enabled: false,
            },
            markers: {
              size: 0,
            },
            chart: {
              zoom: { autoScaleYaxis: true },
              animations: { enabled: false },
              toolbar: { show: false },
              sparkline: { enabled: true },
            },
            stroke: {
              curve: 'smooth',
              width: 2,
            },
            fill: {
              type: 'gradient',
              colors: ['#2dbaa1'],
              gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.6,
                opacityTo: 0.8,
                stops: [0, 100]
              }
            },
            legend: { show: false, floating: true },
            subtitle: { floating: true },
            plotOptions: {
              area: {
                fillTo: 'end',
              },
            },
          }}
          type='area'
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
        value={this.state.results.hits?.value || 0}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(Histogram);

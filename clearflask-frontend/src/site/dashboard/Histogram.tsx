import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import ReactApexChart from "react-apexcharts";
import * as Admin from '../../api/admin';
import { Server } from '../../api/server';

const styles = (theme: Theme) => createStyles({
});
interface Props {
  server: Server;
  title: string;
  search: Admin.IdeaHistogramSearchAdmin;
}
interface State {
  results?: Admin.IdeaHistogramResponse;
  error?: string;
}
class Histogram extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = {};

  componentDidMount() {
    if (!this.state.results) {
      this.props.server.dispatchAdmin().then(d => d.ideaHistogramAdmin({
        projectId: this.props.server.getProjectId(),
        ideaHistogramSearchAdmin: this.props.search,
      })).then(results => this.setState({ results }));
    }
  }

  render() {
    if (!this.state.results) return null;

    const data: Array<{ x: number, y: number }> = [];
    this.state.results.points.forEach(point => data.push({
      x: point.ts.getTime(),
      y: point.cnt,
    }));

    return (
      <ReactApexChart
        series={[{
          data,
        }]}
        options={{
          colors: ['#2dbaa1'],
          tooltip: {
            // enabled: false,
          },
          xaxis: {
            type: 'datetime',
            min: this.props.search.filterCreatedStart,
            max: this.props.search.filterCreatedEnd,
            labels: { show: false },
            axisBorder: { show: false },
          },
          yaxis: {
            labels: { show: false },
          },
          grid: {
            show: false,
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
          },
          stroke: {
            lineCap: 'butt',
            curve: 'smooth',
            width: 2,
          },
          fill: {
            type: 'gradient',
            colors: ['#2dbaa1'],
            gradient: {
              shadeIntensity: 1,
              opacityFrom: 0.7,
              opacityTo: 0.9,
              stops: [0, 100]
            }
          },
          legend: { show: false },
        }}
        type='area'
        height={350}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(Histogram);

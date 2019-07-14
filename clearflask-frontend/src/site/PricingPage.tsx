import React, { Component } from 'react';
import { Typography, Grid, Button, Container, Card, CardHeader, CardContent, CardActions, Table, TableHead, TableRow, TableCell, TableBody, Paper } from '@material-ui/core';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import CheckIcon from '@material-ui/icons/CheckRounded';
import HelpPopover from '../common/HelpPopover';
import { useTheme } from '@material-ui/core/styles';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import { History, Location } from 'history';
import { PRE_SELECTED_PLAN_NAME } from './SignupPage';

/**
 * TODO:
 * - Add yearly pricing
 * - show credits for future development (get credits for yearly in full year)
 * - Add high user limit (5k active users), add new tier with a contact button
 */
export const Tiers:{
  price: number|string,
  priceUnit: string,
  title: string,
  description: string[],
  buttonText: string,
}[] = [
  {
    title: 'Basic',
    price: '$45',
    priceUnit: '/month',
    description: [
      '1 Project',
      'Unlimited users',
      'Unlimited content',
      '1/2 hour feature dev support',
    ],
    buttonText: 'Get started',
  },
  {
    title: 'Analytic',
    price: '$175',
    priceUnit: '/month',
    description: [
      'Unlimited projects, users',
      'Crowd-funding',
      'Analytics',
      '3 hours feature dev support',
    ],
    buttonText: 'Get started',
  },
  {
    title: 'Full',
    price: '$300',
    priceUnit: '/month',
    description: [
      'Multi-Agent Access',
      '99.5% SLA',
      'Integrations',
      'API Access',
      'Whitelabel',
      '6 hours feature dev support',
    ],
    buttonText: 'Get started',
  },
];

const styles = (theme:Theme) => createStyles({
  page: {
    margin: theme.spacing(2),
  },
  option: {
    display: 'inline-block',
    margin: theme.spacing(6),
    padding: theme.spacing(6),
  },
  cardHeader: {
    // backgroundColor: theme.palette.grey[200],
  },
  cardPricing: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'baseline',
    marginBottom: theme.spacing(2),
  },
});

const T = true;
const F = false;

interface Props {
  history:History;
}

class LandingPage extends Component<Props&WithStyles<typeof styles, true>> {
  render() {
    return (
      <div className={this.props.classes.page}>
        <Container maxWidth='md'>
          <Grid container spacing={5} alignItems='stretch'>
            {Tiers.map((tier, index) => (
              <Grid item key={tier.title} xs={12} sm={index === 2 ? 12 : 6} md={4}>
                <Card raised>
                  <CardHeader
                    title={tier.title}
                    titleTypographyProps={{ align: 'center' }}
                    subheaderTypographyProps={{ align: 'center' }}
                    className={this.props.classes.cardHeader}
                  />
                  <CardContent>
                    <div className={this.props.classes.cardPricing}>
                      <Typography component="h2" variant="h3" color="textPrimary">{tier.price}</Typography>
                      <Typography variant="h6" color="textSecondary">{tier.priceUnit}</Typography>
                    </div>
                    {tier.description.map(line => (
                      <div style={{display: 'flex', alignItems: 'center'}}>
                        <CheckIcon fontSize='inherit' />
                        &nbsp;
                        <Typography variant="subtitle1" key={line}>
                          {line}
                        </Typography>
                      </div>
                    ))}
                  </CardContent>
                  <CardActions>
                    <Button fullWidth variant='text' color="primary"
                      onClick={() => this.props.history.push('/signup', {[PRE_SELECTED_PLAN_NAME]: tier.title})}>
                      {tier.buttonText}
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
        <br />
        <br />
        <br />
        <Container maxWidth='md'>
          <FeatureList name='Core features' planNames={['Starter', 'Pro', 'Whatever']}>
            <FeatureListItem planContents={['1','Unlimited','Unlimited']} name='Projects' />
            <FeatureListItem planContents={['Unlimited','Unlimited','Unlimited']} name='Active users' />
            <FeatureListItem planContents={['Unlimited','Unlimited','Unlimited']} name='User submitted content' />
            <FeatureListItem planContents={[T,T,T]} name='Customizable pages: Ideas, Roadmap, FAQ, Knowledge base, etc...' />
            <FeatureListItem planContents={[T,T,T]} name='Voting and Emoji expressions' />
            <FeatureListItem planContents={[F,T,T]} name='Credit system / Crowd-funding' />
            <FeatureListItem planContents={[F,T,T]} name='Analytics' />
            <FeatureListItem planContents={[F,F,T]} name='Multi agent access' />
            <FeatureListItem planContents={[F,F,T]} name='Integrations' />
            <FeatureListItem planContents={[F,F,T]} name='API access' />
            <FeatureListItem planContents={[F,F,T]} name='Whitelabel' />
          </FeatureList>
        </Container>
      </div>
    );
  }
}

const FeatureList = (props:{
  planNames:string[],
  name:string,
  children?:any,
}) => {
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('sm'));
  return (
    <Paper elevation={8}>
      <Table
        size={mdUp ? 'medium' : 'small'}
      >
        <TableHead>
          <TableRow>
            <TableCell key='feature'><Typography variant='h6'>{props.name}</Typography></TableCell>
            <TableCell key='plan1'>Starter</TableCell>
            <TableCell key='plan1'>Full</TableCell>
            <TableCell key='plan1'>Enterprise</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {props.children}
        </TableBody>
      </Table>
    </Paper>
  );
}

const FeatureListItem = (props:{
  planContents:(boolean|React.ReactNode|string)[],
  name:string,
  helpText?:string
}) => {
  return (
    <TableRow key='name'>
      <TableCell key='feature'>
        {props.name}
        {props.helpText && (<HelpPopover description={props.helpText} />)}
      </TableCell>
      {props.planContents.map(content => (
        <TableCell key='plan1'>
          {content === T
            ? (<CheckIcon fontSize='inherit' />)
            : content}
        </TableCell>
      ))}
    </TableRow>
  );
}

export default withStyles(styles, { withTheme: true })(LandingPage);

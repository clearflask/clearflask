import React, { Component } from 'react';
import { Typography, Grid, Button, Container, Card, CardHeader, CardContent, CardActions } from '@material-ui/core';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import CheckIcon from '@material-ui/icons/CheckRounded';

const tiers:{
  price: number,
  title: string,
  description: string[],
  buttonText: string,
  buttonVariant?: 'text' | 'outlined' | 'contained',
}[] = [
  {
    title: 'Custom',
    price: 10,
    description: [
      'Up to 100 Users',
      '2 GB of storage',
      'Help center access',
      'Email support'
    ],
    buttonText: 'Sign up for free',
    buttonVariant: 'outlined',
  },
  {
    title: 'Full',
    price: 50,
    description: [
      'Unlimited Users',
      'Single Admin',
    ],
    buttonText: 'Get started',
    buttonVariant: 'contained',
  },
  {
    title: 'Enterprise',
    price: 400,
    description: [
      'Unlimited Users',
      'Multi-Agent Access',
      'Support',
      'Integrations',
      'API Access',
    ],
    buttonText: 'Contact us',
    buttonVariant: 'outlined',
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
    backgroundColor: theme.palette.grey[200],
  },
  cardPricing: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'baseline',
    marginBottom: theme.spacing(2),
  },
});

class LandingPage extends Component<WithStyles<typeof styles, true>> {

  render() {
    return (
      <div className={this.props.classes.page}>
        <Container maxWidth='md'>
          <Grid container spacing={5} alignItems='stretch'>
            {tiers.map(tier => (
              <Grid item key={tier.title} xs={12} sm={tier.title === 'Enterprise' ? 12 : 6} md={4}>
                <Card>
                  <CardHeader
                    title={tier.title}
                    titleTypographyProps={{ align: 'center' }}
                    subheaderTypographyProps={{ align: 'center' }}
                    className={this.props.classes.cardHeader}
                  />
                  <CardContent>
                    <div className={this.props.classes.cardPricing}>
                      <Typography component="h2" variant="h3" color="textPrimary">
                        ${tier.price}
                      </Typography>
                      <Typography variant="h6" color="textSecondary">
                        /mo
                      </Typography>
                    </div>
                    {tier.description.map(line => (
                      <div style={{display: 'flex', alignItems: 'baseline'}}>
                        <CheckIcon fontSize='inherit' />
                        <Typography variant="subtitle1" key={line}>
                          {line}
                        </Typography>
                      </div>
                    ))}
                  </CardContent>
                  <CardActions>
                    <Button fullWidth variant={tier.buttonVariant} color="primary">
                      {tier.buttonText}
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(LandingPage);

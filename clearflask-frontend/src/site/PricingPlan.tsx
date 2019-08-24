import React, { Component } from 'react';
import { Typography, Button, Card, CardHeader, CardContent, CardActions } from '@material-ui/core';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import CheckIcon from '@material-ui/icons/CheckRounded';
import { History, Location } from 'history';
import * as Admin from '../api/admin';
import InfoIcon from '@material-ui/icons/InfoOutlined';

const styles = (theme:Theme) => createStyles({
  cardPricing: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'baseline',
    marginBottom: theme.spacing(2),
  },
});

interface Props {
  history:History;
  plan:Admin.Plan;
  selected?:boolean;
  expanded?:boolean;
  actionTitle:string;
  actionOnClick:()=>void;
}

class PricingPlan extends Component<Props&WithStyles<typeof styles, true>> {
  render() {
    return (
      <Card raised>
        <CardHeader
          title={this.props.plan.title}
          titleTypographyProps={{ align: 'center' }}
          subheaderTypographyProps={{ align: 'center' }}
        />
        <CardContent>
          {this.props.plan.pricing ? (
            <React.Fragment>
              <div className={this.props.classes.cardPricing}>
                <Typography component='h2' variant='h6' color='textSecondary' style={{alignSelf: 'end'}}>{'$'}</Typography>
                <Typography component='h2' variant='h3'>{this.props.plan.pricing.price}</Typography>
                <Typography component='h2' variant='h6' color='textSecondary'>{'/ month'}</Typography>
              </div>
              <div className={this.props.classes.cardPricing}>
                <Typography component='h3'>{
                  this.props.plan.pricing.period === Admin.PlanPricingPeriodEnum.Yearly
                    ? ('$' + (this.props.plan.pricing.price * 12) + ' billed yearly')
                    : 'billed monthly'}</Typography>
              </div>
            </React.Fragment>
            ) : (
              <div className={this.props.classes.cardPricing}>
                <Typography component="h2" variant="h4" color="textPrimary">Contact us</Typography>
              </div>
            )}
          {this.props.plan.perks.map(perk => (
            <div key={perk.desc} style={{display: 'flex', alignItems: 'baseline'}}>
              <CheckIcon fontSize='inherit' />
              &nbsp;
              <Typography variant="subtitle1">
                {perk.desc}
                {!this.props.expanded && (<React.Fragment>
                  &nbsp;
                  <Typography variant='caption'><InfoIcon fontSize='inherit' /></Typography>
                </React.Fragment>)}
              </Typography>
              {this.props.expanded && (
                <div>
                  <Typography variant="subtitle2">{perk.terms}</Typography>
                </div>
              )}
            </div>
          ))}
        </CardContent>
        <CardActions>
          <Button fullWidth color="primary"
            variant={this.props.selected ? 'contained' : 'text'} 
            onClick={this.props.actionOnClick}
          >
            {this.props.actionTitle}
          </Button>
        </CardActions>
      </Card>
    );
  }
}

export default withStyles(styles, { withTheme: true })(PricingPlan);

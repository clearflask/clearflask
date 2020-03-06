import { Button, Card, CardActions, CardContent, CardHeader, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import CheckIcon from '@material-ui/icons/CheckRounded';
import InfoIcon from '@material-ui/icons/InfoOutlined';
import React, { Component } from 'react';
import * as Admin from '../api/admin';

const styles = (theme: Theme) => createStyles({
  cardPricing: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'baseline',
    marginBottom: theme.spacing(2),
  },
  box: {
    border: '1px solid ' + theme.palette.grey[300],
  },
});

interface Props {
  plan: Admin.Plan;
  selected?: boolean;
  expanded?: boolean;
  actionTitle?: string;
  actionOnClick?: () => void;
}

class PricingPlan extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    return (
      <Card elevation={0} className={this.props.classes.box}>
        <CardHeader
          title={this.props.plan.title}
          titleTypographyProps={{ align: 'center' }}
          subheaderTypographyProps={{ align: 'center' }}
        />
        <CardContent>
          {this.props.plan.pricing ? (
            <React.Fragment>
              <div className={this.props.classes.cardPricing}>
                <Typography component='h2' variant='h6' color='textSecondary' style={{ alignSelf: 'flex-start' }}>{'$'}</Typography>
                <Typography component='h2' variant='h3'>{this.props.plan.pricing.price}</Typography>
                <Typography component='h2' variant='h6' color='textSecondary'>{'/ month'}</Typography>
              </div>
              <div className={this.props.classes.cardPricing}>
                <Typography component='h3'>{
                  this.props.plan.pricing.period === Admin.PlanPricingPeriodEnum.Yearly
                    ? ('$' + (this.props.plan.pricing.price * 12) + ' billed yearly')
                    : ('$' + (this.props.plan.pricing.price * 3) + ' billed quarterly')
                }</Typography>
              </div>
            </React.Fragment>
          ) : (
              <div className={this.props.classes.cardPricing}>
                <Typography component="h2" variant="h4" color="textPrimary">Contact us</Typography>
              </div>
            )}
          {this.props.plan.perks.map(perk => (
            <div key={perk.desc} style={{ display: 'flex', alignItems: 'baseline' }}>
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
        {this.props.actionTitle && (
          <CardActions>
            <Button fullWidth color="primary"
              variant={this.props.selected ? 'contained' : 'text'}
              onClick={this.props.actionOnClick}
              disabled={!this.props.actionOnClick}
            >
              {this.props.actionTitle}
            </Button>
          </CardActions>
        )}
      </Card>
    );
  }
}

export default withStyles(styles, { withTheme: true })(PricingPlan);

import { Button, Card, CardActions, CardContent, CardHeader, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import CheckIcon from '@material-ui/icons/CheckRounded';
import React, { Component } from 'react';
import * as Admin from '../api/admin';
import HelpPopover from '../common/HelpPopover';

const styles = (theme: Theme) => createStyles({
  cardPricing: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'baseline',
    marginBottom: theme.spacing(2),
  },
  comingSoon: {
    color: theme.palette.text.hint,
  },
  cardBeta: {
    margin: theme.spacing(2),
    color: theme.palette.text.hint,
  },
  beta: {
    color: theme.palette.text.hint,
  },
  box: {
    border: '1px solid ' + theme.palette.grey[300],
  },
});

interface Props {
  plan: Admin.Plan;
  selected?: boolean;
  actionTitle?: string;
  actionOnClick?: () => void;
}

class PricingPlan extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    var billed;
    switch (this.props.plan.pricing?.period) {
      case Admin.PlanPricingPeriodEnum.Monthly:
        billed = `$${this.props.plan.pricing.price} billed ${this.props.plan.pricing.period.toLowerCase()}`;
        break;
      case Admin.PlanPricingPeriodEnum.Quarterly:
        billed = `$${this.props.plan.pricing.price * 3} billed ${this.props.plan.pricing.period.toLowerCase()}`;
        break;
      case Admin.PlanPricingPeriodEnum.Yearly:
        billed = `$${this.props.plan.pricing.price * 12} billed ${this.props.plan.pricing.period.toLowerCase()}`;
        break;
    }

    return (
      <Card elevation={0} className={this.props.classes.box}>
        <CardHeader
          title={(
            <React.Fragment>
              {this.props.plan.title}
              {this.props.plan.beta && (<span className={this.props.classes.beta}>*</span>)}
            </React.Fragment>
          )}
          titleTypographyProps={{ align: 'center' }}
        />
        <CardContent>
          {!!this.props.plan.pricing ? (
            <React.Fragment>
              <div className={this.props.classes.cardPricing}>
                <Typography component='h2' variant='h6' color='textSecondary' style={{ alignSelf: 'flex-start' }}>{'$'}</Typography>
                <Typography component='h2' variant='h3'>{this.props.plan.pricing.price}</Typography>
                <Typography component='h2' variant='h6' color='textSecondary'>{'/ month'}</Typography>
              </div>
              <div className={this.props.classes.cardPricing}>
                <Typography component='h3'>{billed}</Typography>
              </div>
            </React.Fragment>
          ) : (
              <div className={this.props.classes.cardPricing}>
                <Typography component="h2" variant="h4" className={this.props.classes.comingSoon}>Not yet available...</Typography>
              </div>
            )}
          {this.props.plan.perks.map(perk => (
            <div key={perk.desc} style={{ display: 'flex', alignItems: 'baseline' }}>
              <CheckIcon fontSize='inherit' />
              &nbsp;
              <Typography variant='subtitle1'>
                {perk.desc}
                {!!perk.terms && (<React.Fragment>
                  &nbsp;
                  <HelpPopover description={perk.terms} />
                </React.Fragment>)}
              </Typography>
            </div>
          ))}
        </CardContent>
        {this.props.plan.beta && (
          <Typography variant='caption' className={this.props.classes.cardBeta}>*Currently in beta for public use</Typography>
        )}
        {
          !!this.props.actionTitle && (
            <CardActions>
              <Button fullWidth color="primary"
                variant={this.props.selected ? 'contained' : 'text'}
                onClick={this.props.actionOnClick}
                disabled={!this.props.actionOnClick}
              >
                {this.props.actionTitle}
              </Button>
            </CardActions>
          )
        }
      </Card >
    );
  }
}

export default withStyles(styles, { withTheme: true })(PricingPlan);

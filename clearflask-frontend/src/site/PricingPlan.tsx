import { Button, Card, CardActions, CardContent, CardHeader, FormControlLabel, Radio, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import CheckIcon from '@material-ui/icons/CheckRounded';
import classNames from 'classnames';
import React, { Component } from 'react';
import * as Admin from '../api/admin';
import HelpPopper from '../common/HelpPopper';

const styles = (theme: Theme) => createStyles({
  cardPricing: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'baseline',
    marginBottom: theme.spacing(2),
  },
  comingSoon: {
    color: theme.palette.text.secondary,
  },
  cardBeta: {
    margin: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  beta: {
    fontSize: '0.5em',
    color: theme.palette.text.secondary,
  },
  box: {
    transition: theme.transitions.create('border'),
    border: '1px solid ' + theme.palette.grey[300],
  },
  boxSelected: {
    borderColor: theme.palette.primary.main,
  },
  actions: {
    margin: theme.spacing(0, 3, 1),
  },
});

interface Props {
  className?: string;
  plan: Admin.Plan;
  selected?: boolean;
  actionTitle?: string;
  actionType?: 'button' | 'radio';
  actionOnClick?: () => void;
  hidePerks?: boolean;
}

class PricingPlan extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    var billed;
    switch (this.props.plan.pricing?.period) {
      case Admin.PlanPricingPeriodEnum.Monthly:
        break;
      case Admin.PlanPricingPeriodEnum.Quarterly:
        billed = `$${this.props.plan.pricing.basePrice * 3} billed ${this.props.plan.pricing.period.toLowerCase()}`;
        break;
      case Admin.PlanPricingPeriodEnum.Yearly:
        billed = `$${this.props.plan.pricing.basePrice * 12} billed ${this.props.plan.pricing.period.toLowerCase()}`;
        break;
    }

    return (
      <Card elevation={0} className={classNames(this.props.className, this.props.classes.box, this.props.selected && this.props.classes.boxSelected)}>
        <CardHeader
          title={(
            <React.Fragment>
              {this.props.plan.title}
              {this.props.plan.beta && (<span className={this.props.classes.beta}>&nbsp;EARLY ACCESS</span>)}
            </React.Fragment>
          )}
          titleTypographyProps={{ align: 'center' }}
        />
        <CardContent>
          <div className={this.props.classes.cardPricing}>
            {!!this.props.plan.pricing ? (
              <React.Fragment>
                <Typography component='h2' variant='h6' color='textSecondary' style={{ alignSelf: 'flex-start' }}>{'$'}</Typography>
                <Typography component='h2' variant='h4'>{this.props.plan.pricing?.basePrice || 'Custom'}</Typography>
                <Typography component='h2' variant='h6' color='textSecondary'>{'/ month'}</Typography>
              </React.Fragment>
            ) : (
                <Typography component='h2' variant='h4' style={{ color: this.props.theme.palette.text.secondary }}>Contact</Typography>
              )}
          </div>
          <div className={this.props.classes.cardPricing}>
            <Typography component='h3'>{billed}</Typography>
          </div>
          {!this.props.hidePerks && this.props.plan.perks.map(perk => (
            <div key={perk.desc} style={{ display: 'flex', alignItems: 'baseline' }}>
              <CheckIcon fontSize='inherit' />
              &nbsp;
              <Typography variant='subtitle1'>
                {perk.desc}
                {!!perk.terms && (<React.Fragment>
                  &nbsp;
                  <HelpPopper description={perk.terms} />
                </React.Fragment>)}
              </Typography>
            </div>
          ))}
        </CardContent>
        {
          !!this.props.actionTitle && (
            <CardActions className={this.props.classes.actions}>
              {this.props.actionType === 'radio' ? (
                <FormControlLabel
                  label={this.props.actionTitle}
                  control={(
                    <Radio
                      checked={this.props.selected}
                      color='primary'
                      onChange={e => this.props.actionOnClick && this.props.actionOnClick()}
                      disabled={!this.props.actionOnClick}
                    />
                  )}
                />
              ) : (
                  <Button fullWidth color="primary"
                    onClick={this.props.actionOnClick}
                    disabled={!this.props.actionOnClick}
                  >
                    {this.props.actionTitle}
                  </Button>
                )}
            </CardActions>
          )
        }
      </Card >
    );
  }
}

export default withStyles(styles, { withTheme: true })(PricingPlan);

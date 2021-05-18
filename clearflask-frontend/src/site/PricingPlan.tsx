import { Button, Card, CardActions, CardContent, CardHeader, FormControlLabel, Radio, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import CheckIcon from '@material-ui/icons/CheckRounded';
import classNames from 'classnames';
import { LocationDescriptor } from 'history';
import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import * as Admin from '../api/admin';
import HelpPopper from '../common/HelpPopper';

const styles = (theme: Theme) => createStyles({
  title: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  cardPricing: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'baseline',
    marginBottom: theme.spacing(2),
  },
  cardPricingTerms: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing(-1),
    marginBottom: theme.spacing(2),
    lineHeight: 1.3 + '!important',
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
    marginLeft: '1em',
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
    flexDirection: 'column',
  },
  remark: {
    display: 'flex',
    justifyContent: 'center',
    margin: theme.spacing(0, 1, 1),
    textAlign: 'center',
  },
  reallyBlurry: {
    color: 'transparent',
    textShadow: '0px 0px 3px rgba(0,0,0,0.3)',
  },
  customInput: {
    color: theme.palette.text.disabled,
    borderBottom: '1px dashed ' + theme.palette.text.disabled,
  },
});

interface Props {
  className?: string;
  plan: Admin.Plan;
  selected?: boolean;
  customPrice?: string;
  actionTitle?: string;
  actionType?: 'button' | 'radio';
  actionTo?: LocationDescriptor;
  actionOnClick?: () => void;
  hidePerks?: boolean;
  remark?: React.ReactNode;
}

class PricingPlan extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    return (
      <Card elevation={0} className={classNames(this.props.className, this.props.classes.box, this.props.selected && this.props.classes.boxSelected)}>
        <CardHeader
          title={(
            <div className={this.props.classes.title}>
              {this.props.plan.title}
              {this.props.plan.beta && (
                <div className={this.props.classes.beta}>
                  EARLY<br />ACCESS
                </div>
              )}
            </div>
          )}
          titleTypographyProps={{ align: 'center' }}
        />
        <CardContent>
          {this.renderPriceTag()}
          {!this.props.hidePerks && this.props.plan.perks.map(perk => (
            <div key={perk.desc} style={{ display: 'flex', alignItems: 'baseline' }}>
              <CheckIcon fontSize='inherit' />
              &nbsp;
              <Typography variant='subtitle1'>
                {perk.desc}
                {!!perk.terms && (<>
                  &nbsp;
                  <HelpPopper description={perk.terms} />
                </>)}
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
                <Button
                  color='primary'
                  variant='contained'
                  disableElevation
                  style={{ fontWeight: 900 }}
                  onClick={this.props.actionOnClick}
                  disabled={!this.props.actionOnClick}
                  {...(this.props.actionTo ? {
                    component: Link,
                    to: this.props.actionTo,
                  } : {})}
                >
                  {this.props.actionTitle}
                </Button>
              )}
            </CardActions>
          )
        }
        {this.props.remark && (
          <div className={this.props.classes.remark}>
            <Typography variant='caption' component='div' color='textSecondary'>{this.props.remark}</Typography>
          </div>
        )}
      </Card >
    );
  }

  renderPriceTag() {
    if (this.props.customPrice !== undefined && !this.props.plan.pricing) {
      return (
        <>
          <div className={this.props.classes.cardPricing}>
            <Typography component='div' variant='subtitle2' color='textSecondary' style={{ alignSelf: 'flex-start' }}>{'$'}</Typography>
            &nbsp;&nbsp;
            <Typography component='h2' variant='h4' className={this.props.classes.customInput}>{this.props.customPrice || 'Custom'}</Typography>
              &nbsp;&nbsp;
            <Typography component='div' variant='subtitle2' color='textSecondary'>/&nbsp;year</Typography>
          </div>
          <div className={this.props.classes.cardPricingTerms}>
            <Typography component='div' variant='subtitle2' color='textSecondary'>{`High-volume`}</Typography>
            <Typography component='div' variant='subtitle2' color='textSecondary'>{`Discounted rate`}</Typography>
          </div>
        </>
      );
    }

    var monthlyPrice = this.props.plan.pricing?.basePrice || 0;
    var billed: any = null;
    switch (this.props.plan.pricing?.period) {
      case Admin.PlanPricingPeriodEnum.Monthly:
        // No need to show anything
        break;
      case Admin.PlanPricingPeriodEnum.Quarterly:
        monthlyPrice = Math.ceil(this.props.plan.pricing.basePrice / 3);
        billed = `$${this.props.plan.pricing.basePrice} billed ${this.props.plan.pricing.period.toLowerCase()}`;
        break;
      case Admin.PlanPricingPeriodEnum.Yearly:
        monthlyPrice = Math.ceil(this.props.plan.pricing.basePrice / 12);
        billed = `$${this.props.plan.pricing.basePrice} billed ${this.props.plan.pricing.period.toLowerCase()}`;
        break;
    }
    if (billed) billed = (
      <Typography component='div' variant='subtitle1'>{billed}</Typography>
    );

    // NOTE: Simplified menus were confusing when shown alongside a yearly option
    // const simplifiedMaus: boolean = this.props.plan.pricing.basePrice === this.props.plan.pricing.unitPrice
    //   && this.props.plan.pricing.baseMau === this.props.plan.pricing?.unitMau;
    // if (simplifiedMaus) return (
    //   <div className={this.props.classes.cardPricing}>
    //     <Typography component='div' variant='subtitle2' color='textSecondary' style={{ alignSelf: 'flex-start' }}>{'$'}</Typography>
    //     <Typography component='div' variant='h4'>{this.props.plan.pricing.basePrice}</Typography>
    //     <Typography component='div' variant='subtitle2' color='textSecondary'>{`/ ${this.props.plan.pricing.baseMau} MAU`}</Typography>
    //     {billed && (
    //       <div className={this.props.classes.cardPricingTerms}>
    //         {billed}
    //       </div>
    //     )}
    //   </div>
    // );

    var extraMau: any = null;
    if (this.props.plan.pricing && (this.props.plan.pricing.unitPrice || 0) > 0) {
      extraMau = (
        <>
          <Typography component='div' variant='subtitle2' color='textSecondary'>{`${this.props.plan.pricing.baseMau} tracked users`}</Typography>
          <Typography component='div' variant='subtitle2' color='textSecondary'>{`+ $${this.props.plan.pricing.unitPrice} / ${this.props.plan.pricing.unitMau} tracked users`}</Typography>
        </>
      );
    }

    return (
      <>
        <div className={this.props.classes.cardPricing}>
          <Typography component='h2' variant='subtitle2' color='textSecondary' style={{ alignSelf: 'flex-start' }}>{'$'}</Typography>
          <Typography component='h2' variant='h4'>{monthlyPrice}</Typography>
          <Typography component='h2' variant='subtitle2' color='textSecondary'>{'/ mo'}</Typography>
        </div>
        {(extraMau || billed) && (
          <div className={this.props.classes.cardPricingTerms}>
            {extraMau}
            {billed}
          </div>
        )}
      </>
    );
  }
}

export default withStyles(styles, { withTheme: true })(PricingPlan);

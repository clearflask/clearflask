import { darken, lighten, Theme } from '@material-ui/core/styles';
import { CSSProperties } from '@material-ui/core/styles/withStyles';

export const buttonHover = (theme: Theme): Record<string, string | CSSProperties> => {
  return {
    transition: theme.transitions.create(['border-color']),
    borderLeft: '4px solid transparent',
    '&:hover': {
      borderLeftColor: theme.palette.type === 'dark'
        ? lighten(theme.palette.background.default, 0.04)
        : darken(theme.palette.background.default, 0.04),
    },
  };
};

export const buttonSelected = (theme: Theme): Record<string, string | CSSProperties> => {
  return {
    borderLeftColor: theme.palette.primary.main + '!important',
  };
};

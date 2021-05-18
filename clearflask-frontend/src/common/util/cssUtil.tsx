import { fade, Theme } from '@material-ui/core/styles';
import { CSSProperties } from '@material-ui/core/styles/withStyles';

export const buttonHover = (theme: Theme): Record<string, string | CSSProperties> => {
  return {
    transition: theme.transitions.create('background-color'),
    '&:hover': {
      backgroundColor: `rgba(${theme.palette.type === 'dark' ? '255,255,255' : '0,0,0'},0.04)`,
    },
  };
};

export const buttonSelected = (theme: Theme): Record<string, string | CSSProperties> => {
  return {
    backgroundColor: fade(theme.palette.primary.main, 0.08) + '!important',
  };
};

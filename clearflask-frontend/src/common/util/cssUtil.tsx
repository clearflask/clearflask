import { Theme } from '@material-ui/core/styles';
import { CSSProperties } from '@material-ui/core/styles/withStyles';

export const buttonHover = (theme: Theme): Record<string, string | CSSProperties> => {
  return {
    transition: theme.transitions.create('background-color'),
    '&:hover': {
      backgroundColor: `rgba(${theme.palette.type === 'dark' ? '255,255,255' : '0,0,0'},0.04)`,
    },
  };
};

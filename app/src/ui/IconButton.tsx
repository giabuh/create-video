import {Tooltip} from './Tooltip.tsx';
import s from './IconButton.module.css';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: React.ReactNode;
  variant?: 'secondary' | 'ghost';
  size?: 'sm' | 'md';
};

export function IconButton({label, icon, variant = 'ghost', size = 'md', className, type = 'button', ...rest}: Props): React.JSX.Element {
  return (
    <Tooltip content={label}>
      <button {...rest} type={type} aria-label={label} className={[s.btn, s[variant], s[size], className].filter(Boolean).join(' ')}>
        {icon}
      </button>
    </Tooltip>
  );
}

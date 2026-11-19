import {Spinner} from './Spinner.tsx';
import s from './Button.module.css';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
};

export function Button({variant = 'secondary', size = 'md', loading, loadingText, icon, className, children, disabled, type = 'button', ...rest}: ButtonProps): React.JSX.Element {
  return (
    <button
      {...rest}
      type={type}
      className={[s.btn, s[variant], s[size], className].filter(Boolean).join(' ')}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined} /* keeps keyboard focus while loading */
      onClick={loading ? (e) => e.preventDefault() : rest.onClick}
    >
      {/* both layers share one grid cell so the width is the wider of the two and never jumps */}
      <span className={s.layer} style={loading ? {visibility: 'hidden'} : undefined}>
        {icon}
        {children}
      </span>
      <span className={s.layer} style={loading ? undefined : {visibility: 'hidden'}} aria-hidden={!loading}>
        <Spinner size={16} />
        {loadingText ?? children}
      </span>
    </button>
  );
}

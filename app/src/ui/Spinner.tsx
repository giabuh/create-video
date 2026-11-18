import s from './Spinner.module.css';

export function Spinner({size = 18, label}: {size?: number; label?: string}): React.JSX.Element {
  return (
    <span
      className={s.spinner}
      style={{width: size, height: size}}
      {...(label ? {role: 'status', 'aria-label': label} : {'aria-hidden': true})}
    />
  );
}

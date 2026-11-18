import s from './PageHeader.module.css';

export function PageHeader({title, subtitle, actions}: {title: string; subtitle?: React.ReactNode; actions?: React.ReactNode}): React.JSX.Element {
  return (
    <header className={s.header}>
      <div>
        <h1 className={s.title}>{title}</h1>
        {subtitle && <div className={s.subtitle}>{subtitle}</div>}
      </div>
      {actions && <div className={s.actions}>{actions}</div>}
    </header>
  );
}

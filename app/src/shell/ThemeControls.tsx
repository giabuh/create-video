import {Segmented, useTheme} from '../ui/index.ts';
import s from './ThemeControls.module.css';

export function ThemeControls(): React.JSX.Element {
  const {theme, setTheme, textSize, setTextSize} = useTheme();
  return (
    <div className={s.root}>
      <div className={s.group}>
        <span className={s.label}>Giao diện</span>
        <Segmented size="sm" aria-label="Giao diện" value={theme} onChange={setTheme}
          options={[{value: 'system', label: 'Hệ thống'}, {value: 'light', label: 'Sáng'}, {value: 'dark', label: 'Tối'}]} />
      </div>
      <div className={s.group}>
        <span className={s.label}>Cỡ chữ</span>
        <Segmented size="sm" aria-label="Cỡ chữ" value={textSize} onChange={setTextSize}
          options={[{value: 'md', label: 'Vừa'}, {value: 'lg', label: 'Lớn'}, {value: 'xl', label: 'Rất lớn'}]} />
      </div>
    </div>
  );
}

import {useState} from 'react';
import {useBrands} from '../../api/hooks.ts';
import {ErrorState, PageHeader, Segmented} from '../../ui/index.ts';
import {BrandSection, BrandSkeleton} from './BrandSection.tsx';
import {SettingsForm, type SettingsGroup} from './SettingsForm.tsx';
import s from './Settings.module.css';

export function SettingsScreen(): React.JSX.Element {
  const brands = useBrands();
  const [group, setGroup] = useState<SettingsGroup>('brand');
  return (
    <div className={s.page}>
      <PageHeader title="Brand & cài đặt" subtitle="Màu, logo, thông tin liên hệ của từng thương hiệu và các mặc định cho mọi video." />
      <div className={s.settingsTabs}>
        <Segmented<SettingsGroup> className={s.tabList} aria-label="Nhóm cài đặt" value={group} onChange={setGroup} options={[
          {value: 'brand', label: 'Thương hiệu'}, {value: 'defaults', label: 'Video mới'},
          {value: 'av', label: 'Phụ đề & âm thanh'}, {value: 'appearance', label: 'Giao diện'},
        ]} />
      </div>
      <div hidden={group !== 'brand'}>
        {brands.isLoading ? <BrandSkeleton />
          : brands.error || !brands.data ? <ErrorState error={brands.error} onRetry={() => void brands.refetch()} />
          : <BrandSection brands={brands.data} />}
      </div>
      <SettingsForm group={group} />
    </div>
  );
}

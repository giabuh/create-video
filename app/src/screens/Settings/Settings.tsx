import {useBrands} from '../../api/hooks.ts';
import {ErrorState, PageHeader} from '../../ui/index.ts';
import {BrandSection, BrandSkeleton} from './BrandSection.tsx';
import {SettingsForm} from './SettingsForm.tsx';
import s from './Settings.module.css';

export function SettingsScreen(): React.JSX.Element {
  const brands = useBrands();
  return (
    <div className={s.page}>
      <PageHeader title="Brand & cài đặt" subtitle="Màu, logo, thông tin liên hệ của từng thương hiệu và các mặc định cho mọi video." />
      {brands.isLoading ? <BrandSkeleton />
        : brands.error || !brands.data ? <ErrorState error={brands.error} onRetry={() => void brands.refetch()} />
        : <BrandSection brands={brands.data} />}
      <SettingsForm />
    </div>
  );
}

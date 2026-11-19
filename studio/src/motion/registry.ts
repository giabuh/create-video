// One entry per file studio/src/motion/<Name>.tsx exporting <Name> and <Name>Schema.
// The app reads this registry directly: titles, descriptions and schemas drive its forms.
import {Annotate, AnnotateSchema} from './Annotate';
import {Callout, CalloutSchema} from './Callout';
import {Checklist, ChecklistSchema} from './Checklist';
import {CountUp, CountUpSchema} from './CountUp';
import {DateBadge, DateBadgeSchema} from './DateBadge';
import {GlossyPill, GlossyPillSchema} from './GlossyPill';
import {GiantText, GiantTextSchema} from './GiantText';
import {KineticText, KineticTextSchema} from './KineticText';
import {LowerThird, LowerThirdSchema} from './LowerThird';
import {Picture, PictureSchema} from './Picture';
import {PinLabel, PinLabelSchema} from './PinLabel';
import {PriceTag, PriceTagSchema} from './PriceTag';
import {ProgressBar, ProgressBarSchema} from './ProgressBar';
import {Ribbon, RibbonSchema} from './Ribbon';
import {defineMotion, type MotionDef} from './schema';
import {Text, TextSchema} from './Text';
import {TwoTier, TwoTierSchema} from './TwoTier';

export const MOTION: Record<string, MotionDef> = {
  Text: defineMotion({component: Text, schema: TextSchema, title: 'Chữ tự do', description: 'Một khối chữ, tự chọn cỡ, màu, nền, kiểu hiện'}),
  KineticText: defineMotion({component: KineticText, schema: KineticTextSchema, title: 'Chữ động nhiều dòng', description: 'Các dòng bật lên lần lượt'}),
  CountUp: defineMotion({component: CountUp, schema: CountUpSchema, title: 'Số đếm', description: 'Số chạy từ A đến B'}),
  Checklist: defineMotion({component: Checklist, schema: ChecklistSchema, title: 'Danh sách tích', description: 'Các mục có dấu ✓ hiện lần lượt'}),
  PriceTag: defineMotion({component: PriceTag, schema: PriceTagSchema, title: 'Thẻ giá', description: 'Giá mới, giá cũ gạch ngang'}),
  DateBadge: defineMotion({component: DateBadge, schema: DateBadgeSchema, title: 'Thẻ ngày', description: 'Nhãn + ngày (VD: khai giảng)'}),
  LowerThird: defineMotion({component: LowerThird, schema: LowerThirdSchema, title: 'Thanh tên', description: 'Tên + mô tả trượt vào từ cạnh'}),
  Annotate: defineMotion({component: Annotate, schema: AnnotateSchema, title: 'Nét vẽ tay', description: 'Khoanh, gạch chân, tô nền một vùng hoặc một chữ'}),
  Picture: defineMotion({component: Picture, schema: PictureSchema, title: 'Ảnh / video chèn', description: 'Logo, sticker, khung hình trong hình'}),
  ProgressBar: defineMotion({component: ProgressBar, schema: ProgressBarSchema, title: 'Thanh tiến trình', description: 'Chạy hết chiều dài lớp — hợp với track toàn video'}),
  Ribbon: defineMotion({component: Ribbon, schema: RibbonSchema, title: 'Ruy băng', description: 'Băng màu gấp góc, chữ gõ vào, dòng phụ có chấm', ownsExit: true}),
  TwoTier: defineMotion({component: TwoTier, schema: TwoTierSchema, title: 'Thẻ hai tầng', description: 'Ô sáng ở trên, băng xéo màu ở dưới', ownsExit: true}),
  PinLabel: defineMotion({component: PinLabel, schema: PinLabelSchema, title: 'Ghim vị trí', description: 'Ghim 📍 rơi xuống kèm chữ (địa điểm)', ownsExit: true}),
  GlossyPill: defineMotion({component: GlossyPill, schema: GlossyPillSchema, title: 'Nhãn bóng', description: 'Viên gradient viền sáng, vệt bóng quét qua, dòng phụ, sticker', ownsExit: true}),
  Callout: defineMotion({component: Callout, schema: CalloutSchema, title: 'Nhãn chỉ điểm', description: 'Ô chữ có đường kẻ chỉ vào người/vật', ownsExit: true}),
  GiantText: defineMotion({component: GiantText, schema: GiantTextSchema, title: 'Chữ khổng lồ', description: 'Chữ to lướt ngang màn hình rồi đọng lại một dòng', ownsExit: true}),
};

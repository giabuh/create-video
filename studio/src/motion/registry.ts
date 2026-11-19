// One entry per file studio/src/motion/<Name>.tsx exporting <Name> and <Name>Schema.
// The app reads this registry directly: titles, descriptions and schemas drive its forms.
import {Annotate, AnnotateSchema} from './Annotate';
import {Checklist, ChecklistSchema} from './Checklist';
import {CountUp, CountUpSchema} from './CountUp';
import {DateBadge, DateBadgeSchema} from './DateBadge';
import {KineticText, KineticTextSchema} from './KineticText';
import {LowerThird, LowerThirdSchema} from './LowerThird';
import {Picture, PictureSchema} from './Picture';
import {PriceTag, PriceTagSchema} from './PriceTag';
import {ProgressBar, ProgressBarSchema} from './ProgressBar';
import {defineMotion, type MotionDef} from './schema';
import {Text, TextSchema} from './Text';

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
};

// One entry per file studio/src/motion/<Name>.tsx exporting <Name> and <Name>Schema.
// The app reads this registry directly: titles, descriptions and schemas drive its forms.
import {Annotate, AnnotateSchema} from './Annotate';
import {BarChart, BarChartSchema} from './BarChart';
import {Headline, HeadlineSchema} from './Headline';
import {Callout, CalloutSchema} from './Callout';
import {Checklist, ChecklistSchema} from './Checklist';
import {CountUp, CountUpSchema} from './CountUp';
import {DateBadge, DateBadgeSchema} from './DateBadge';
import {GlossyPill, GlossyPillSchema} from './GlossyPill';
import {GiantText, GiantTextSchema} from './GiantText';
import {KineticText, KineticTextSchema} from './KineticText';
import {LineChart, LineChartSchema} from './LineChart';
import {LowerThird, LowerThirdSchema} from './LowerThird';
import {Picture, PictureSchema} from './Picture';
import {TitleCard, TitleCardSchema} from './TitleCard';
import {PinLabel, PinLabelSchema} from './PinLabel';
import {PriceTag, PriceTagSchema} from './PriceTag';
import {MaxKinetic, MaxKineticSchema} from './MaxKinetic';
import {MaxOffer, MaxOfferSchema} from './MaxOffer';
import {MaxPhone, MaxPhoneSchema} from './MaxPhone';
import {FeedPhone, FeedPhoneSchema} from './FeedPhone';
import {MaxSteps, MaxStepsSchema} from './MaxSteps';
import {OfferCard, OfferCardSchema} from './OfferCard';
import {ProgressBar, ProgressBarSchema} from './ProgressBar';
import {Ribbon, RibbonSchema} from './Ribbon';
import {defineMotion, type MotionDef} from './schema';
import {Stamp, StampSchema} from './Stamp';
import {Text, TextSchema} from './Text';
import {TwoTier, TwoTierSchema} from './TwoTier';

export const MOTION: Record<string, MotionDef> = {
  Text: defineMotion({component: Text, schema: TextSchema, title: 'Chữ tự do', description: 'Một khối chữ, tự chọn cỡ, màu, nền, kiểu hiện'}),
  KineticText: defineMotion({component: KineticText, schema: KineticTextSchema, title: 'Chữ động nhiều dòng', description: 'Các dòng bật lên lần lượt'}),
  CountUp: defineMotion({component: CountUp, schema: CountUpSchema, title: 'Số đếm', description: 'Số chạy từ A đến B'}),
  Checklist: defineMotion({component: Checklist, schema: ChecklistSchema, title: 'Danh sách tích', description: 'Các mục có dấu ✓ hiện lần lượt'}),
  PriceTag: defineMotion({component: PriceTag, schema: PriceTagSchema, title: 'Thẻ giá', description: 'Giá mới, giá cũ gạch ngang'}),
  OfferCard: defineMotion({component: OfferCard, schema: OfferCardSchema, title: 'Thẻ ưu đãi', description: 'Thẻ trắng nhấn cụm chữ vàng + con dấu giảm giá, hoặc số khổng lồ', ownsExit: true}),
  DateBadge: defineMotion({component: DateBadge, schema: DateBadgeSchema, title: 'Thẻ ngày', description: 'Nhãn + ngày (VD: khai giảng)'}),
  LowerThird: defineMotion({component: LowerThird, schema: LowerThirdSchema, title: 'Thanh tên', description: 'Tên + mô tả trượt vào từ cạnh'}),
  Annotate: defineMotion({component: Annotate, schema: AnnotateSchema, title: 'Nét vẽ tay', description: 'Khoanh, gạch chân, tô nền một vùng hoặc một chữ'}),
  Picture: defineMotion({component: Picture, schema: PictureSchema, title: 'Ảnh / video chèn', description: 'Logo, sticker, khung hình trong hình'}),
  ProgressBar: defineMotion({component: ProgressBar, schema: ProgressBarSchema, title: 'Thanh tiến trình', description: 'Chạy hết chiều dài lớp — hợp với track toàn video'}),
  Ribbon: defineMotion({component: Ribbon, schema: RibbonSchema, title: 'Ruy băng', description: 'Băng màu gấp góc, chữ gõ vào, dòng phụ có chấm', ownsExit: true}),
  TwoTier: defineMotion({component: TwoTier, schema: TwoTierSchema, title: 'Thẻ hai tầng', description: 'Ô sáng ở trên, băng xéo màu ở dưới', ownsExit: true}),
  TitleCard: defineMotion({component: TitleCard, schema: TitleCardSchema, title: 'Thẻ tiêu đề', description: 'Nhãn vàng và thẻ xanh đậm với tiêu đề lớn'}),
  PinLabel: defineMotion({component: PinLabel, schema: PinLabelSchema, title: 'Ghim vị trí', description: 'Ghim 📍 rơi xuống kèm chữ (địa điểm)', ownsExit: true}),
  GlossyPill: defineMotion({component: GlossyPill, schema: GlossyPillSchema, title: 'Nhãn bóng', description: 'Viên gradient viền sáng, vệt bóng quét qua, dòng phụ, sticker', ownsExit: true}),
  Callout: defineMotion({component: Callout, schema: CalloutSchema, title: 'Nhãn chỉ điểm', description: 'Ô chữ có đường kẻ chỉ vào người/vật', ownsExit: true}),
  GiantText: defineMotion({component: GiantText, schema: GiantTextSchema, title: 'Chữ khổng lồ', description: 'Chữ to lướt ngang màn hình rồi đọng lại một dòng', ownsExit: true}),
  Stamp: defineMotion({component: Stamp, schema: StampSchema, title: 'Con dấu', description: 'Con dấu đỏ đóng xuống, vòng sóng lan ra', ownsExit: true}),
  BarChart: defineMotion({component: BarChart, schema: BarChartSchema, title: 'Biểu đồ cột', description: 'Cột ngang có nhãn, số chạy lên, ghi nguồn'}),
  LineChart: defineMotion({component: LineChart, schema: LineChartSchema, title: 'Biểu đồ đường', description: 'Đường vẽ dần theo thời gian, ghi nguồn'}),
  Headline: defineMotion({component: Headline, schema: HeadlineSchema, title: 'Tiêu đề báo (tự thiết kế)', description: 'Tiêu đề chữ có chân, cụm từ được tô nổi như bút dạ, ghi nguồn'}),
  MaxKinetic: defineMotion({component: MaxKinetic, schema: MaxKineticSchema, title: 'Chữ đập mạnh', description: 'Khác Chữ động nhiều dòng: từng từ đóng xuống cỡ lớn hoặc trượt vào thẻ kính, có mờ chuyển động', ownsExit: true}),
  MaxOffer: defineMotion({component: MaxOffer, schema: MaxOfferSchema, title: 'Ưu đãi nổi bật', description: 'Khác Thẻ ưu đãi: nhãn + tiêu đề, hoặc số đếm trong ngôi sao tia sáng xoay', ownsExit: true}),
  FeedPhone: defineMotion({component: FeedPhone, schema: FeedPhoneSchema, title: 'Điện thoại lướt bảng tin', description: 'Màn hình điện thoại: bảng tin lướt qua bài quảng cáo, hoặc tin nhắn khách đổ về', ownsExit: true}),
  MaxPhone: defineMotion({component: MaxPhone, schema: MaxPhoneSchema, title: 'Số điện thoại lớn', description: 'Số điện thoại trên tấm kính, từng nhóm số rơi xuống theo lời đọc, điện thoại rung', ownsExit: true}),
  MaxSteps: defineMotion({component: MaxSteps, schema: MaxStepsSchema, title: 'Các bước', description: 'Khác Danh sách tích: hàng kính trượt vào theo lời đọc, bước đang đọc phát sáng, dấu tích vẽ nét', ownsExit: true}),
};

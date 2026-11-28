import {defineMotion, type MotionDef} from '../../motion/schema';
import {AdsMock, AdsMockSchema} from './AdsMock';
import {FearList, FearListSchema} from './FearList';
import {LoopCard, LoopCardSchema} from './LoopCard';

export const MOTION: Record<string, MotionDef> = {
  FearList: defineMotion({component: FearList, schema: FearListSchema, title: 'Danh sách nỗi sợ', description: 'Thẻ giấy liệt kê nỗi sợ, từng dòng hiện theo lời đọc, khoanh tay dòng chính', ownsExit: true}),
  AdsMock: defineMotion({component: AdsMock, schema: AdsMockSchema, title: 'Trình quảng cáo minh hoạ', description: 'Trang giấy: 4 bước chạy quảng cáo, con trỏ Bạn đi qua từng bước', ownsExit: true}),
  LoopCard: defineMotion({component: LoopCard, schema: LoopCardSchema, title: 'Vòng tự làm', description: 'Hiểu -> Tự làm, vòng Triển khai / Đọc kết quả / Điều chỉnh', ownsExit: true}),
};

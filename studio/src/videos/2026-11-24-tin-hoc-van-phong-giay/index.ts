import {defineMotion, type MotionDef} from '../../motion/schema';
import {DocMock, DocMockSchema} from './DocMock';
import {PaperNote, PaperNoteSchema} from './PaperNote';
import {PaperPage, PaperPageSchema} from './PaperPage';
import {SheetMock, SheetMockSchema} from './SheetMock';

export const MOTION: Record<string, MotionDef> = {
  PaperNote: defineMotion({component: PaperNote, schema: PaperNoteSchema, title: 'Thẻ giấy góc', description: 'Thẻ giấy có băng dính: bước x/y, danh sách icon, ghi chú', ownsExit: true}),
  PaperPage: defineMotion({component: PaperPage, schema: PaperPageSchema, title: 'Trang giấy', description: 'Nền giấy kem, dấu cắt góc, tiêu đề serif + nhãn băng dính, chân trang mono', ownsExit: true}),
  SheetMock: defineMotion({component: SheetMock, schema: SheetMockSchema, title: 'Bảng tính minh hoạ', description: 'Bảng tính giấy: gõ công thức, tham chiếu tô màu, tách phép tính, sửa số tự tính lại', ownsExit: true}),
  DocMock: defineMotion({component: DocMock, schema: DocMockSchema, title: 'Văn bản minh hoạ', description: 'Trang văn bản: tiêu đề lộn xộn thành đều nhau, mục lục tự dựng', ownsExit: true}),
};

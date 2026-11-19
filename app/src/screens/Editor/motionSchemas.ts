export type MotionField = {key: string; label: string; type: 'text' | 'number' | 'list'; optional: boolean};
const f = (key: string, label: string, type: MotionField['type'], optional = false): MotionField => ({key, label, type, optional});

export const MOTION_SCHEMAS: Record<string, MotionField[]> = {
  KineticText: [f('lines', 'Các dòng chữ (mỗi dòng một ý)', 'list')],
  CountUp: [f('from', 'Từ', 'number'), f('to', 'Đến', 'number'), f('decimals', 'Số lẻ', 'number', true), f('label', 'Nhãn', 'text', true), f('suffix', 'Hậu tố', 'text', true)],
  Checklist: [f('items', 'Các mục (mỗi dòng một mục)', 'list'), f('title', 'Tiêu đề', 'text', true)],
  PriceTag: [f('price', 'Giá', 'text'), f('old', 'Giá cũ', 'text', true), f('note', 'Ghi chú', 'text', true)],
  DateBadge: [f('label', 'Nhãn', 'text'), f('date', 'Ngày', 'text')],
  LowerThird: [f('title', 'Tiêu đề', 'text'), f('subtitle', 'Phụ đề', 'text', true)],
};

const ok = (t: MotionField['type'], v: unknown) =>
  t === 'text' ? typeof v === 'string' : t === 'number' ? typeof v === 'number' && Number.isFinite(v) : Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Error messages (Vietnamese) for required-missing and wrong-type fields; [] when valid or the component has no schema. */
export function validateMotionProps(component: string, props: Record<string, unknown> | undefined): string[] {
  const schema = MOTION_SCHEMAS[component];
  if (!schema) return [];
  const out: string[] = [];
  for (const fd of schema) {
    const v = props?.[fd.key];
    const empty = v === undefined || v === null || v === '' || (fd.type === 'list' && Array.isArray(v) && v.length === 0);
    if (empty) { if (!fd.optional) out.push(`${fd.label}: bắt buộc`); }
    else if (!ok(fd.type, v)) out.push(`${fd.label}: sai kiểu dữ liệu`);
  }
  return out;
}

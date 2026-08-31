import { describe, it, expect } from 'vitest';

// اختبار بسيط للتأكد أن بيئة الاختبار تعمل
describe('smoke', () => {
  it('يعمل الاختبار الأساسي', () => {
    expect(1 + 1).toBe(2);
  });
});
// @vitest-environment jsdom
// ============================================================
// رِفق — اختبارات واجهة النظام (B4): ملكية البيانات
// 1) تصدير: ينزّل ملف JSON باسم صحيح + تأكيد لطيف
// 2) استيراد: لا شيء يحدث قبل التأكيد الصريح، ثم تُستعاد البيانات
// 3) ملف غير صحيح / نسخة مستقبلية ← رفض واضح بلا مساس بالبيانات
// 4) حذف: تأكيد مزدوج ثم قاعدة فاضية
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPage } from '../../src/ui/screens/system/SettingsPage';
import { taskRepository } from '../../src/core/db/repositories';
import { db } from '../../src/core/db/schema';
import { exportAll } from '../../src/utils/backup';
import { voice } from '../../src/i18n/voice';

const S = voice.system;

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function makeTask(title: string): Promise<void> {
  await taskRepository.create({
    title,
    importance: 'low',
    urgency: 'low',
    estimatedDuration: 30,
    status: 'todo'
  } as unknown as Parameters<typeof taskRepository.create>[0]);
}

/** ملف وهمي مع نص مضمون (jsdom لا يضمن File.text في كل الإصدارات) */
function fileOf(name: string, content: string): File {
  const file = new File([content], name, { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: async () => content });
  return file;
}

function pickFile(input: HTMLElement, name: string, content: string): void {
  fireEvent.change(input, { target: { files: [fileOf(name, content)] } });
}

describe('System UI — ملكية البيانات', () => {
  it('التصدير ينزّل ملف JSON بتاريخ اليوم ويؤكد بلطف', async () => {
    const user = userEvent.setup();
    await makeTask('مهمة قبل النسخة');

    const createURL = vi.fn(() => 'blob:refq');
    Object.defineProperty(URL, 'createObjectURL', { value: createURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
    let downloaded = '';
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloaded = this.download;
      });

    render(<SettingsPage />);
    await user.click(await screen.findByRole('button', { name: S.exportButton }));

    await waitFor(() => expect(createURL).toHaveBeenCalled());
    expect(clickSpy).toHaveBeenCalled();
    expect(downloaded).toMatch(/^refq-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(await screen.findByText(S.exportDone)).toBeDefined();
  });

  it('الاستيراد لا يمس البيانات قبل التأكيد الصريح ثم يستعيدها', async () => {
    const user = userEvent.setup();
    await makeTask('مهمة النسخة');
    const snapshot = await exportAll();
    await db.tasks.clear();

    render(<SettingsPage />);
    const input = (await screen.findByLabelText(S.importButton)) as HTMLInputElement;
    pickFile(input, 'refq-backup.json', JSON.stringify(snapshot));

    // سؤال التأكيد أولًا — لا استيراد صامت
    expect(await screen.findByText(S.importConfirmQuestion)).toBeDefined();
    expect(await taskRepository.getAll()).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: S.importConfirm }));

    await waitFor(async () => {
      expect(await taskRepository.getAll()).toHaveLength(1);
    });
    expect((await taskRepository.getAll())[0].title).toBe('مهمة النسخة');
    expect(await screen.findByText(S.importDone.replace('{tables}', '10'))).toBeDefined();
  });

  it('ملف غير صحيح يُرفض بلا مساس بالبيانات', async () => {
    await makeTask('محفوظة كما هي');

    render(<SettingsPage />);
    const input = (await screen.findByLabelText(S.importButton)) as HTMLInputElement;
    pickFile(input, 'bad.json', 'ليست نسخة احتياطية');

    expect(await screen.findByText(S.importInvalid)).toBeDefined();
    expect(screen.queryByText(S.importConfirmQuestion)).toBeNull();
    expect(await taskRepository.getAll()).toHaveLength(1);
  });

  it('نسخة مستقبلية غير مدعومة تُرفض برسالة واضحة', async () => {
    const snapshot = { ...(await exportAll()), schemaVersion: 99 };

    render(<SettingsPage />);
    const input = (await screen.findByLabelText(S.importButton)) as HTMLInputElement;
    pickFile(input, 'future.json', JSON.stringify(snapshot));

    expect(await screen.findByText(S.importUnsupported.replace('{version}', '99'))).toBeDefined();
    expect(screen.queryByText(S.importConfirmQuestion)).toBeNull();
  });

  it('حذف كل البيانات يحتاج تأكيدًا مزدوجًا', async () => {
    const user = userEvent.setup();
    await makeTask('هتمسح');

    render(<SettingsPage />);

    await user.click(await screen.findByRole('button', { name: S.dangerButton }));

    // الضغطة الأولى = سؤال فقط، والبيانات ما زالت موجودة
    expect(await screen.findByText(S.dangerConfirmQuestion)).toBeDefined();
    expect(await taskRepository.getAll()).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: S.dangerConfirm }));

    await waitFor(async () => {
      expect(await taskRepository.getAll()).toHaveLength(0);
    });
    expect(await screen.findByText(S.dangerDone)).toBeDefined();
  });
});

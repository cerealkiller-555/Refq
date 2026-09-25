// @vitest-environment jsdom
// ============================================================
// رِفق — اختبارات واجهة القلب (B3)
// 1) السجل يعرض 20 أولًا ثم «شوفي كمان» — بلا قص صامت
// 2) فلتر النوع يعرض نوعًا واحدًا فقط
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeartPage } from '../../src/ui/screens/heart/HeartPage';
import { useHeartStore } from '../../src/core/store/useHeartStore';
import { db } from '../../src/core/db/schema';
import { voice } from '../../src/i18n/voice';

const H = voice.heart;

beforeEach(async () => {
  await db.delete();
  await db.open();
  useHeartStore.setState({ reflections: [] });
});

afterEach(() => cleanup());

describe('Heart UI — السجل والفلاتر', () => {
  it('يعرض 20 تأملًا أولًا ثم «شوفي كمان» لإظهار الباقي', async () => {
    const user = userEvent.setup();
    for (let i = 0; i < 25; i++) {
      await useHeartStore.getState().addReflection('athar', { feeling: `شعور ${i}` });
    }
    await useHeartStore.getState().addReflection('muhasaba', { good: 'شيء طيب' });

    render(<HeartPage />);

    await waitFor(() => {
      expect(document.querySelectorAll('.history-row')).toHaveLength(20);
    });

    // الباقي 6 ظاهر في العدّاد بدل القص الصامت
    const more = screen.getByRole('button', { name: `${H.showMore} (6)` });
    await user.click(more);

    await waitFor(() => {
      expect(document.querySelectorAll('.history-row')).toHaveLength(26);
    });
    expect(screen.queryByRole('button', { name: `${H.showMore} (6)` })).toBeNull();
  });

  it('فلتر النوع يعرض نوعًا واحدًا فقط ويخفي غيره', async () => {
    const user = userEvent.setup();
    await useHeartStore.getState().addReflection('athar', { feeling: 'ارتياح' });
    await useHeartStore.getState().addReflection('muhasaba', { good: 'صبر' });
    await useHeartStore.getState().addReflection('waqfa', { wins: 'نجاح' });

    render(<HeartPage />);

    await waitFor(() => {
      expect(document.querySelectorAll('.history-row')).toHaveLength(3);
    });

    await user.click(screen.getByRole('button', { name: `${H.tabIcons.muhasaba} ${H.tabs.muhasaba}` }));

    await waitFor(() => {
      expect(document.querySelectorAll('.history-row')).toHaveLength(1);
    });
    expect(screen.getByText('صبر')).toBeDefined();
    expect(screen.queryByText('ارتياح')).toBeNull();
    expect(screen.queryByText('نجاح')).toBeNull();

    // «الكل» يرجّع كل الأنواع
    await user.click(screen.getByRole('button', { name: H.historyFilterAll }));
    await waitFor(() => {
      expect(document.querySelectorAll('.history-row')).toHaveLength(3);
    });
  });
});

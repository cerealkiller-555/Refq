// @vitest-environment jsdom
// ============================================================
// رِفق — التنقل السفلي وإعادة توجيه المسار القديم
// 1) أربع وجهات فقط: اليوم · التخطيط · خطتي · القلب (بلا رحلتي)
// 2) /learning يعيد التوجيه إلى /myplan
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../src/app/router';
import { db } from '../../src/core/db/schema';
import { voice } from '../../src/i18n/voice';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(() => cleanup());

function renderAt(path: string) {
  const memoryRouter = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={memoryRouter} />);
  return memoryRouter;
}

describe('التنقل الرئيسي', () => {
  it('أربع وجهات فقط بلا «رحلتي»', async () => {
    renderAt('/myplan');

    const nav = await screen.findByRole('navigation', { name: 'التنقل الرئيسي' });
    const labels = Array.from(nav.querySelectorAll('.nav-label')).map((el) => el.textContent);

    expect(labels).toEqual(['اليوم', 'التخطيط', voice.myPlan.navLabel, 'القلب']);
    expect(screen.queryByText('رحلتي')).toBeNull();
  });
});

describe('إعادة توجيه المسار القديم', () => {
  it('/learning تُعيد التوجيه إلى /myplan', async () => {
    const memoryRouter = renderAt('/learning');

    expect(await screen.findByText(voice.myPlan.title)).toBeDefined();
    expect(memoryRouter.state.location.pathname).toBe('/myplan');
  });
});

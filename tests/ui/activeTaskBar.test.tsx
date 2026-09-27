// @vitest-environment jsdom
// ============================================================
// رِفق — اختبارات واجهة شريط المهمة الجارية (ActiveTaskBar)
// 1) لا يظهر شيء بلا مهمة جارية
// 2) العنوان + المؤقت، والإيقاف/الاستئناف
// 3) × يُخفي الشريط ويُبقي المهمة جارية + زر الاسترجاع يعيده
// 4) سؤال الاستبدال باسمي المهمتين، و«رجوع» لا يغيّر شيئًا
// 5) «استبدال» يرجع الجارية todo ويبدأ الجديدة
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActiveTaskBar } from '../../src/ui/components/ActiveTaskBar';
import { useActiveTaskStore } from '../../src/core/store/useActiveTaskStore';
import { useLearningStore } from '../../src/core/store/useLearningStore';
import {
  taskRepository,
  learningPathRepository,
  pathItemRepository,
  sessionRepository
} from '../../src/core/db/repositories';
import { db } from '../../src/core/db/schema';
import { voice } from '../../src/i18n/voice';

const A = voice.activeTask;

async function seedTask(title: string): Promise<string> {
  const task = await taskRepository.create({
    title,
    importance: 'low',
    urgency: 'low',
    estimatedDuration: 30,
    status: 'todo'
  } as Parameters<typeof taskRepository.create>[0]);
  return task.id;
}

async function seedLearningItem(title: string): Promise<string> {
  const path = await learningPathRepository.create({
    title: 'مسار الشريط',
    type: 'course',
    status: 'active',
    order: 1
  } as Parameters<typeof learningPathRepository.create>[0]);
  const item = await pathItemRepository.create({
    pathId: path.id,
    title,
    order: 1,
    status: 'todo',
    estimatedDuration: 25
  } as Parameters<typeof pathItemRepository.create>[0]);
  return item.id;
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  localStorage.clear();
  useActiveTaskStore.setState({
    active: null,
    loaded: false,
    hidden: false,
    pending: null,
    timer: null
  });
});

afterEach(() => cleanup());

describe('ActiveTaskBar — شريط المهمة الجارية', () => {
  it('لا يظهر شيء عندما لا توجد مهمة جارية', async () => {
    render(<ActiveTaskBar />);

    await waitFor(() => {
      expect(useActiveTaskStore.getState().loaded).toBe(true);
    });
    expect(document.querySelector('.active-task-bar')).toBeNull();
  });

  it('يعرض العنوان والمؤقت، ويستجيب للإيقاف والاستئناف', async () => {
    const user = userEvent.setup();
    const id = await seedTask('مراجعة الفصل');
    await useActiveTaskStore.getState().startItem(id, 'task', 'مراجعة الفصل', 30);

    render(<ActiveTaskBar />);

    expect(await screen.findByText('مراجعة الفصل')).toBeDefined();
    expect(document.querySelector('.timer-ring')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: A.pause }));
    await waitFor(() => {
      expect(useActiveTaskStore.getState().timer?.pausedAt).not.toBeNull();
    });
    expect(await screen.findByText(A.paused)).toBeDefined();

    await user.click(screen.getByRole('button', { name: A.resume }));
    await waitFor(() => {
      expect(useActiveTaskStore.getState().timer?.pausedAt).toBeNull();
    });
  });

  it('× يُخفي الشريط ويُبقي المهمة جارية، وزر الاسترجاع يعيده', async () => {
    const user = userEvent.setup();
    const id = await seedTask('مهمة مخفية');
    await useActiveTaskStore.getState().startItem(id, 'task', 'مهمة مخفية', 30);

    render(<ActiveTaskBar />);
    await user.click(await screen.findByRole('button', { name: A.hide }));

    await waitFor(() => {
      expect(document.querySelector('.active-task-bar')).toBeNull();
    });
    // المهمة لم تُمسّ في الـDB (إخفاء مؤقت فقط)
    expect((await taskRepository.get(id))?.status).toBe('in_progress');

    await user.click(await screen.findByRole('button', { name: A.restore }));
    expect(await screen.findByText('مهمة مخفية')).toBeDefined();
  });

  it('سؤال الاستبدال يظهر باسمي المهمتين، و«رجوع» لا يغيّر شيئًا', async () => {
    const user = userEvent.setup();
    const a = await seedTask('الجارية');
    const b = await seedTask('الجديدة');
    await useActiveTaskStore.getState().startItem(a, 'task', 'الجارية', 30);

    render(<ActiveTaskBar />);
    await screen.findByText('الجارية');

    // بدء مهمة أخرى من خارج الشريط (مثل زر ▶ في «اليوم» أو «خطتي»)
    await act(async () => {
      await useActiveTaskStore.getState().startItem(b, 'task', 'الجديدة', 30);
    });

    const question = A.replaceQuestion
      .replace('{current}', 'الجارية')
      .replace('{next}', 'الجديدة');
    expect(await screen.findByText(question)).toBeDefined();

    await user.click(screen.getByRole('button', { name: A.back }));

    await waitFor(() => {
      expect(useActiveTaskStore.getState().pending).toBeNull();
    });
    expect(useActiveTaskStore.getState().active?.id).toBe(a);
    expect((await taskRepository.get(b))?.status).toBe('todo');
  });

  it('«استبدال» يرجع الجارية todo ويبدأ الجديدة', async () => {
    const user = userEvent.setup();
    const a = await seedTask('القديمة');
    const b = await seedTask('بديلة');
    await useActiveTaskStore.getState().startItem(a, 'task', 'القديمة', 30);

    render(<ActiveTaskBar />);
    await screen.findByText('القديمة');
    await act(async () => {
      await useActiveTaskStore.getState().startItem(b, 'task', 'بديلة', 30);
    });

    await user.click(await screen.findByRole('button', { name: A.replace }));

    await waitFor(async () => {
      expect(useActiveTaskStore.getState().active?.id).toBe(b);
    });
    expect((await taskRepository.get(a))?.status).toBe('todo');
    expect((await taskRepository.get(b))?.status).toBe('in_progress');
  });

  it('إكمال خطوة تعلّم من الشريط (✓) يسجّل جلسة واحدة بمدة المؤقت', async () => {
    const user = userEvent.setup();
    useLearningStore.setState({ paths: [], itemsByPath: {}, sessions: [] });
    const itemId = await seedLearningItem('محاضرة الشريط');
    await useActiveTaskStore.getState().startItem(itemId, 'learning', 'محاضرة الشريط', 25);

    render(<ActiveTaskBar />);
    await screen.findByText('محاضرة الشريط');

    await user.click(screen.getByRole('button', { name: voice.common.complete }));

    await waitFor(async () => {
      expect((await pathItemRepository.get(itemId))?.status).toBe('done');
    });
    const sessions = await sessionRepository.getByPathItem(itemId);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].durationMinutes).toBe(25);
    // الجلسة أُغلقت والمؤقت مُسح والشريط خرج
    await waitFor(() => {
      expect(useActiveTaskStore.getState().active).toBeNull();
    });
    expect(useActiveTaskStore.getState().timer).toBeNull();
  });

  it('تعديل عنوان الخطوة الجارية من شاشة أخرى يظهر في الشريط (قناة التعلّم)', async () => {
    useLearningStore.setState({ paths: [], itemsByPath: {}, sessions: [] });
    const itemId = await seedLearningItem('عنوان قديم');
    await useActiveTaskStore.getState().startItem(itemId, 'learning', 'عنوان قديم', 25);

    render(<ActiveTaskBar />);
    await screen.findByText('عنوان قديم');

    // تعديل من شاشة أخرى (مثل «خطتي») — بلا أي نداء تحميل موضعي
    await act(async () => {
      await useLearningStore.getState().updateItem(itemId, { title: 'عنوان محدّث' });
    });

    expect(await screen.findByText('عنوان محدّث')).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByText('عنوان قديم')).toBeNull();
    });
    // المؤقت والجلسة المفتوحة لم تُمسّا
    expect(useActiveTaskStore.getState().timer?.id).toBe(itemId);
  });

  it('حذف الخطوة الجارية من «خطتي» يُفرّغ الشريط (قناة التعلّم بلا تعويض موضعي)', async () => {
    useLearningStore.setState({ paths: [], itemsByPath: {}, sessions: [] });
    const itemId = await seedLearningItem('خطوة تُحذف');
    await useActiveTaskStore.getState().startItem(itemId, 'learning', 'خطوة تُحذف', 25);

    render(<ActiveTaskBar />);
    await screen.findByText('خطوة تُحذف');

    await act(async () => {
      await useLearningStore.getState().deleteItem(itemId);
    });

    await waitFor(() => {
      expect(useActiveTaskStore.getState().active).toBeNull();
      expect(document.querySelector('.active-task-bar')).toBeNull();
    });
    expect(useActiveTaskStore.getState().timer).toBeNull();
  });
});

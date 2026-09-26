// ============================================================
// رِفق — الراوتر الرئيسي
// التنقل: اليوم · التخطيط · خطتي · القلب — و/learning يعيد
// توجيهه إلى /myplan (مكانه الجديد خطتي).
// ============================================================

import { createHashRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './layout';
import { TodayPage } from '../ui/screens/today/TodayPage';
import { PlanningPage } from '../ui/screens/planning/PlanningPage';
import { MyPlanPage } from '../ui/screens/myplan/MyPlanPage';
import { HeartPage } from '../ui/screens/heart/HeartPage';
import { SettingsPage } from '../ui/screens/system/SettingsPage';

export const routes = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <TodayPage /> },
      { path: 'planning', element: <PlanningPage /> },
      { path: 'myplan', element: <MyPlanPage /> },
      // المسار القديم — يعيد التوجيه إلى خطتي
      { path: 'learning', element: <Navigate to="/myplan" replace /> },
      { path: 'heart', element: <HeartPage /> },
      { path: 'settings', element: <SettingsPage /> }
    ]
  }
];

export const router = createHashRouter(routes);
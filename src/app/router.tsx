// ============================================================
// رِفق — الراوتر الرئيسي
// ============================================================

import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './layout';
import { TodayPage } from '../ui/screens/today/TodayPage';
import { PlanningPage } from '../ui/screens/planning/PlanningPage';
import { LearningPage } from '../ui/screens/learning/LearningPage';
import { VaultPage } from '../ui/screens/vault/VaultPage';
import { HeartPage } from '../ui/screens/heart/HeartPage';
import { SettingsPage } from '../ui/screens/system/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <TodayPage /> },
      { path: 'planning', element: <PlanningPage /> },
      { path: 'learning', element: <LearningPage /> },
      { path: 'vault', element: <VaultPage /> },
      { path: 'heart', element: <HeartPage /> },
      { path: 'settings', element: <SettingsPage /> }
    ]
  }
]);
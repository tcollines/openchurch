import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ResponsiveShell } from '@/components/layout/ResponsiveShell';
import { LoginPage } from '@/modules/auth/LoginPage';
import { CouncilChurchesPage, CouncilChurchPage, CouncilWalletPage } from '@/modules/platform/CouncilPages';
import { NewChurchPage } from '@/modules/platform/NewChurchPage';
import { AdministrationModule } from '@/modules/administration/AdministrationModule';
import { FinanceModule } from '@/modules/finance/FinanceModule';
import { FellowshipModule } from '@/modules/fellowship/FellowshipModule';
import { NotificationsPage } from '@/modules/notifications/Notifications';
import { AirportStarsModule } from '@/modules/airport-stars/AirportStarsModule';
import { TelePastoringModule } from '@/modules/tele-pastoring/TelePastoringModule';
import { ChildrensChurchModule } from '@/modules/childrens-church/ChildrensChurchModule';
import { DiscipleshipModule } from '@/modules/discipleship/DiscipleshipModule';
import { SubscriptionLock } from '@/modules/billing/SubscriptionLock';
import { SetupPage } from '@/modules/setup/SetupPage';
import { LegalPage } from '@/modules/legal/LegalPage';
import { SubscriptionService } from '@/services/churchService';
import { FellowshipUnitType, UserRole } from '@/shared/enums';
import { getDefaultRouteForUser } from '@/shared/formatters';

const ProtectedGuard: React.FC<{
  allowedRoles?: UserRole[];
  children: React.ReactNode;
}> = ({ allowedRoles, children }) => {
  const { user, tenant } = useAuth();
  const location = useLocation();
  // Keeps the lock screen up after paying, so the "Payment received" screen can show.
  const [holdLock, setHoldLock] = React.useState(false);
  if (!user) {
    return <Navigate to={{ pathname: '/login', search: location.search, hash: location.hash }} replace />;
  }

  // Expired subscription: lock the church (Network Council is never locked).
  const expired =
    user.role !== UserRole.PLATFORM_ADMIN && SubscriptionService.getState(tenant)?.phase === 'expired';
  if (expired || holdLock) {
    return <SubscriptionLock onHold={setHoldLock} />;
  }

  // Platform Admin & Church Admin have global oversight access across their tenant
  if (
    user.role === UserRole.PLATFORM_ADMIN ||
    (user.role === UserRole.ADMIN &&
      (!allowedRoles || !allowedRoles.includes(UserRole.PLATFORM_ADMIN)))
  ) {
    return <ResponsiveShell>{children}</ResponsiveShell>;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getDefaultRouteForUser(user, tenant)} replace />;
  }

  return <ResponsiveShell>{children}</ResponsiveShell>;
};

const RootRedirect: React.FC = () => {
  const { user, tenant } = useAuth();
  const location = useLocation();
  if (
    location.hash.includes('type=invite') ||
    location.search.includes('type=invite')
  ) {
    return <Navigate to={{ pathname: '/get-started', search: location.search, hash: location.hash }} replace />;
  }
  if (
    location.hash.includes('access_token=') ||
    location.hash.includes('error_description=') ||
    location.search.includes('token_hash=')
  ) {
    return <Navigate to={{ pathname: '/login', search: location.search, hash: location.hash }} replace />;
  }
  return <Navigate to={getDefaultRouteForUser(user, tenant)} replace />;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Custom Pastor Login Page (opened only from the welcome email link) → Get started (/setup) */}
      <Route path="/get-started" element={<LoginPage />} />
      <Route path="/get-started/:slug" element={<LoginPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/terms" element={<LegalPage />} />
      <Route path="/privacy" element={<LegalPage />} />

      {/* Multi-Tenant Network Council */}
      <Route
        path="/platform/tenants/new"
        element={
          <ProtectedGuard allowedRoles={[UserRole.PLATFORM_ADMIN]}>
            <NewChurchPage />
          </ProtectedGuard>
        }
      />
      <Route
        path="/platform/tenants"
        element={
          <ProtectedGuard allowedRoles={[UserRole.PLATFORM_ADMIN]}>
            <CouncilChurchesPage />
          </ProtectedGuard>
        }
      />
      <Route
        path="/platform/tenants/:id"
        element={
          <ProtectedGuard allowedRoles={[UserRole.PLATFORM_ADMIN]}>
            <CouncilChurchPage />
          </ProtectedGuard>
        }
      />
      <Route
        path="/platform/wallet"
        element={
          <ProtectedGuard allowedRoles={[UserRole.PLATFORM_ADMIN]}>
            <CouncilWalletPage />
          </ProtectedGuard>
        }
      />

      <Route
        path="/notifications"
        element={
          <ProtectedGuard>
            <NotificationsPage />
          </ProtectedGuard>
        }
      />

      {/* 1. Administration Dept */}
      <Route
        path="/admin/*"
        element={
          <ProtectedGuard allowedRoles={[UserRole.ADMIN]}>
            <AdministrationModule />
          </ProtectedGuard>
        }
      />

      {/* 2. Finance Dept */}
      <Route
        path="/finance/*"
        element={
          <ProtectedGuard
            allowedRoles={[UserRole.FINANCE_HOD, UserRole.FINANCE_OFFICER]}
          >
            <FinanceModule />
          </ProtectedGuard>
        }
      />

      {/* 3. Bacenta Dept (Head of Bacentas + Individual Bacenta Dashboards) */}
      <Route
        path="/bacentas/*"
        element={
          <ProtectedGuard
            allowedRoles={[UserRole.BACENTA_HOD, UserRole.BACENTA_LEADER]}
          >
            <FellowshipModule unitType={FellowshipUnitType.BACENTA} />
          </ProtectedGuard>
        }
      />

      {/* 4. Airport Stars Dept (HOD + Check-In-Locked Members) */}
      <Route
        path="/airport-stars/*"
        element={
          <ProtectedGuard
            allowedRoles={[UserRole.AIRPORT_HOD, UserRole.AIRPORT_MEMBER]}
          >
            <AirportStarsModule />
          </ProtectedGuard>
        }
      />

      {/* 5. Tele Pastoring Dept */}
      <Route
        path="/tele-pastoring/*"
        element={
          <ProtectedGuard
            allowedRoles={[UserRole.TELE_HOD, UserRole.TELE_PASTOR]}
          >
            <TelePastoringModule />
          </ProtectedGuard>
        }
      />

      {/* 6. Children's Church Dept */}
      <Route
        path="/children/*"
        element={
          <ProtectedGuard
            allowedRoles={[UserRole.CHILDREN_HOD, UserRole.CHILDREN_WORKER]}
          >
            <ChildrensChurchModule />
          </ProtectedGuard>
        }
      />

      {/* 7. Campuses Dept (Head of Campuses + Individual Campus Dashboards) */}
      <Route
        path="/campuses/*"
        element={
          <ProtectedGuard
            allowedRoles={[UserRole.CAMPUS_HOD, UserRole.CAMPUS_LEADER]}
          >
            <FellowshipModule unitType={FellowshipUnitType.CAMPUS} />
          </ProtectedGuard>
        }
      />

      {/* 8. Discipleship Dept (HOD + check-in-only team members) */}
      <Route
        path="/discipleship/*"
        element={
          <ProtectedGuard allowedRoles={[UserRole.DISCIPLESHIP_HOD, UserRole.DISCIPLESHIP_MEMBER]}>
            <DiscipleshipModule />
          </ProtectedGuard>
        }
      />

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;


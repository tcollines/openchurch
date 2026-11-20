import React, { createContext, useContext, useEffect, useState } from 'react';
import { PlatformService, subscribeToChurchStore } from '@/services/churchService';
import { apiClient, getStoredToken, setStoredToken, clearStoredToken } from '@/services/apiClient';
import { Department, Tenant, User } from '@/shared/types';
import { UserRole } from '@/shared/enums';

interface AuthContextValue {
  user: User | null;
  tenant: Tenant | null;
  activeTenantId: string;
  loginByEmail: (email: string) => Promise<{ ok: boolean; error?: string }>;
  loginWithGoogle: (payload: { credential?: string; email?: string }) => Promise<{ ok: boolean; error?: string; user?: User }>;
  completeSupabaseSession: (payload: {
    token: string;
    user: User;
    tenant?: Tenant | null;
    departments?: Department[];
    users?: User[];
  }) => User;
  loginAsUser: (userId: string) => void;
  switchSupervisedTenant: (tenantId: string) => void;
  logout: () => void;
}

const SESSION_KEY = 'open_church_active_user_id';
const SUPERVISED_TENANT_KEY = 'open_church_supervised_tenant_id';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [, setVersion] = useState(0);
  const [userId, setUserId] = useState<string | null>(() =>
    localStorage.getItem(SESSION_KEY)
  );
  const [supervisedTenantId, setSupervisedTenantId] = useState<string>(() => {
    const saved = localStorage.getItem(SUPERVISED_TENANT_KEY);
    if (saved === 't-kampala' || saved === 't-nairobi') {
      localStorage.removeItem(SUPERVISED_TENANT_KEY);
      return '';
    }
    return saved || '';
  });

  useEffect(() => {
    const unsub = subscribeToChurchStore(() => setVersion((v) => v + 1));
    if (getStoredToken()) {
      void PlatformService.hydrateFromBackendBootstrap();
    }
    return unsub;
  }, []);

  const allUsers = PlatformService.getAllUsers();
  const user = userId ? allUsers.find((u) => u.id === userId) ?? null : null;
  const availableTenants = PlatformService.getTenants();

  const activeTenantId =
    user?.role === UserRole.PLATFORM_ADMIN
      ? availableTenants.some((t) => t.id === supervisedTenantId)
        ? supervisedTenantId
        : availableTenants[0]?.id || ''
      : user?.tenantId || '';

  const tenant = PlatformService.getTenantById(activeTenantId);

  const loginByEmail = async (email: string): Promise<{ ok: boolean; error?: string }> => {
    const trimmed = email.trim();
    const match = allUsers.find(
      (u) => u.email.toLowerCase() === trimmed.toLowerCase() && u.isActive
    );
    if (!match) {
      return { ok: false, error: 'No active Open Church account found for that email.' };
    }
    if (match.tenantId) {
      const userTenant = PlatformService.getTenantById(match.tenantId);
      if (userTenant?.status === 'SUSPENDED') {
        return { ok: false, error: 'This church tenant is currently suspended.' };
      }
    }

    // Attempt backend JWT login if backend is running
    try {
      const res = await apiClient.post<{ token: string; user: any; tenant: any }>('/auth/login', {
        email: trimmed,
      });
      if (res?.token) {
        setStoredToken(res.token);
      }
    } catch {
      // Backend not running yet or in offline preview mode: continue with local session
    }

    localStorage.setItem(SESSION_KEY, match.id);
    setUserId(match.id);
    return { ok: true };
  };

  const completeSupabaseSession = (payload: {
    token: string;
    user: User;
    tenant?: Tenant | null;
    departments?: Department[];
    users?: User[];
  }): User => {
    setStoredToken(payload.token);
    const mergedUsers = [
      payload.user,
      ...(payload.users ?? []).filter((u) => u.id !== payload.user.id),
    ];
    const syncedUser =
      PlatformService.syncBackendEntities({
        tenant: payload.tenant ?? null,
        departments: payload.departments,
        users: mergedUsers,
      }) || payload.user;
    localStorage.setItem(SESSION_KEY, syncedUser.id);
    setUserId(syncedUser.id);
    void PlatformService.hydrateFromBackendBootstrap();
    return syncedUser;
  };

  const loginWithGoogle = async (payload: {
    credential?: string;
    email?: string;
  }): Promise<{ ok: boolean; error?: string; user?: User }> => {
    try {
      const res = await apiClient.post<{
        token: string;
        user: User;
        tenant?: Tenant | null;
        departments?: Department[];
        googlePicture?: string;
      }>('/auth/google', payload);

      if (res?.token && res?.user) {
        const syncedUser = completeSupabaseSession(res);
        return { ok: true, user: syncedUser };
      }
      return { ok: false, error: 'Google sign-in did not return a session.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      // Fallback in case of local offline mock mode
      if (payload.email) {
        const localMatch = allUsers.find(
          (u) => u.email.toLowerCase() === payload.email?.toLowerCase() && u.isActive
        );
        if (localMatch) {
          localStorage.setItem(SESSION_KEY, localMatch.id);
          setUserId(localMatch.id);
          return { ok: true, user: localMatch };
        }
      }
      return { ok: false, error: msg };
    }
  };

  const loginAsUser = (targetUserId: string): void => {
    const targetUser = allUsers.find((u) => u.id === targetUserId);
    if (targetUser) {
      apiClient.post<{ token: string }>('/auth/login', { email: targetUser.email })
        .then((res) => {
          if (res?.token) setStoredToken(res.token);
        })
        .catch(() => {
          // offline mode
        });
    }
    localStorage.setItem(SESSION_KEY, targetUserId);
    setUserId(targetUserId);
  };

  const switchSupervisedTenant = (nextTenantId: string): void => {
    localStorage.setItem(SUPERVISED_TENANT_KEY, nextTenantId);
    setSupervisedTenantId(nextTenantId);
  };

  const logout = (): void => {
    clearStoredToken();
    localStorage.removeItem(SESSION_KEY);
    setUserId(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        activeTenantId,
        loginByEmail,
        loginWithGoogle,
        completeSupabaseSession,
        loginAsUser,
        switchSupervisedTenant,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};


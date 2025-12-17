import { create } from 'zustand';

interface User {
  id: number;
  email: string;
  name: string | null;
  role: string;
  companyId: number | null;
  companyName: string | null;
  onboardingStatus?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  updateUser: (user: Partial<User>) => void;
  initialize: () => void;
}

const getStoredAuth = () => {
  if (typeof window === 'undefined') return { user: null, accessToken: null, isAuthenticated: false };
  try {
    const stored = localStorage.getItem('bidforge-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        user: parsed.user || null,
        accessToken: parsed.accessToken || null,
        isAuthenticated: !!parsed.accessToken,
      };
    }
  } catch (e) {
    console.error('Failed to parse stored auth:', e);
  }
  return { user: null, accessToken: null, isAuthenticated: false };
};

const persistAuth = (state: Partial<AuthState>) => {
  if (typeof window === 'undefined') return;
  try {
    // Only store user and access token - refresh token is in HttpOnly cookie
    localStorage.setItem('bidforge-auth', JSON.stringify({
      user: state.user,
      accessToken: state.accessToken,
    }));
  } catch (e) {
    console.error('Failed to persist auth:', e);
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  setAuth: (user, accessToken) => {
    const newState = { user, accessToken, isAuthenticated: true, isLoading: false };
    persistAuth(newState);
    set(newState);
  },
  clearAuth: () => {
    localStorage.removeItem('bidforge-auth');
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
  },
  setLoading: (isLoading) => set({ isLoading }),
  updateUser: (userData) =>
    set((state) => {
      const newUser = state.user ? { ...state.user, ...userData } : null;
      if (newUser) persistAuth({ ...state, user: newUser });
      return { user: newUser };
    }),
  initialize: () => {
    const stored = getStoredAuth();
    set({ ...stored, isLoading: false });
  },
}));

export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const { accessToken, setAuth, clearAuth } = useAuthStore.getState();

  const isFormData = options.body instanceof FormData;

  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
  };

  if (accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }

  let response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include', // Include cookies for refresh token
  });

  // Handle 401 (Unauthorized) or 403 (Forbidden) by attempting refresh
  if ((response.status === 401 || response.status === 403) && endpoint !== '/api/auth/refresh') {
    const refreshResponse = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Send refresh token cookie
    });

    if (refreshResponse.ok) {
      const { accessToken: newAccessToken } = await refreshResponse.json();
      const state = useAuthStore.getState();
      if (state.user) {
        setAuth(state.user, newAccessToken);
      }

      (headers as Record<string, string>)['Authorization'] = `Bearer ${newAccessToken}`;
      response = await fetch(endpoint, {
        ...options,
        headers,
        credentials: 'include',
      });
    } else {
      clearAuth();
    }
  }

  return response;
}

export async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include', // Include cookies for refresh token
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Login failed' };
    }

    // Refresh token is now in HttpOnly cookie, only store access token
    useAuthStore.getState().setAuth(data.user, data.accessToken);
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Network error. Please try again.' };
  }
}

export async function register(
  email: string,
  password: string,
  name?: string,
  companyName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, companyName }),
      credentials: 'include', // Include cookies for refresh token
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || data.details?.[0]?.message || 'Registration failed' };
    }

    // Refresh token is now in HttpOnly cookie, only store access token
    useAuthStore.getState().setAuth(data.user, data.accessToken);
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Network error. Please try again.' };
  }
}

export async function logout(): Promise<void> {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    useAuthStore.getState().clearAuth();
  }
}

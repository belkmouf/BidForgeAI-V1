import { create } from 'zustand';

interface User {
  id: number;
  email: string;
  name: string | null;
  role: string;
  companyId: number | null;
  companyName: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  updateUser: (user: Partial<User>) => void;
  initialize: () => void;
}

const getStoredAuth = () => {
  if (typeof window === 'undefined') return { user: null, accessToken: null, refreshToken: null, isAuthenticated: false };
  try {
    const stored = localStorage.getItem('bidforge-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        user: parsed.user || null,
        accessToken: parsed.accessToken || null,
        refreshToken: parsed.refreshToken || null,
        isAuthenticated: !!parsed.accessToken,
      };
    }
  } catch (e) {
    console.error('Failed to parse stored auth:', e);
  }
  return { user: null, accessToken: null, refreshToken: null, isAuthenticated: false };
};

const persistAuth = (state: Partial<AuthState>) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('bidforge-auth', JSON.stringify({
      user: state.user,
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
    }));
  } catch (e) {
    console.error('Failed to persist auth:', e);
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  setAuth: (user, accessToken, refreshToken) => {
    const newState = { user, accessToken, refreshToken, isAuthenticated: true, isLoading: false };
    persistAuth(newState);
    set(newState);
  },
  clearAuth: () => {
    localStorage.removeItem('bidforge-auth');
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isLoading: false });
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
  const { accessToken, refreshToken, setAuth, clearAuth } = useAuthStore.getState();
  
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
  });

  if (response.status === 403 && refreshToken) {
    const refreshResponse = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (refreshResponse.ok) {
      const { accessToken: newAccessToken } = await refreshResponse.json();
      const state = useAuthStore.getState();
      if (state.user) {
        setAuth(state.user, newAccessToken, refreshToken);
      }
      
      (headers as Record<string, string>)['Authorization'] = `Bearer ${newAccessToken}`;
      response = await fetch(endpoint, {
        ...options,
        headers,
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
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Login failed' };
    }

    useAuthStore.getState().setAuth(data.user, data.accessToken, data.refreshToken);
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Network error. Please try again.' };
  }
}

export async function register(
  email: string,
  password: string,
  name?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || data.details?.[0]?.message || 'Registration failed' };
    }

    useAuthStore.getState().setAuth(data.user, data.accessToken, data.refreshToken);
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

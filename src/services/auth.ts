import { login as apiLogin, logout as apiLogout, refreshToken as apiRefreshToken } from './api';
import type { LoginRequest, LoginResponse, User } from '../types/multi-tenant';

// JWT token management
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setStoredRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function removeStoredRefreshToken(): void {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// Authentication functions
export async function login(request: LoginRequest): Promise<LoginResponse> {
  try {
    const response = await apiLogin(request);
    
    // Store tokens
    if (response.accessToken) {
      setStoredToken(response.accessToken);
    }
    if (response.refreshToken) {
      setStoredRefreshToken(response.refreshToken);
    }
    
    return response;
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

export async function logout(): Promise<void> {
  try {
    // Call logout API
    await apiLogout();
  } catch (error) {
    console.error('Logout API call failed:', error);
  } finally {
    // Always clear local tokens
    removeStoredToken();
    removeStoredRefreshToken();
  }
}

export async function refreshToken(): Promise<LoginResponse> {
  try {
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await apiRefreshToken();
    
    // Update stored tokens
    if (response.accessToken) {
      setStoredToken(response.accessToken);
    }
    if (response.refreshToken) {
      setStoredRefreshToken(response.refreshToken);
    }
    
    return response;
  } catch (error) {
    console.error('Token refresh failed:', error);
    // Clear tokens on refresh failure
    removeStoredToken();
    removeStoredRefreshToken();
    throw error;
  }
}

// JWT token parsing
export function parseJwt(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to parse JWT:', error);
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) {
    return true;
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  return payload.exp < currentTime;
}

export function getTokenUser(token: string): User | null {
  const payload = parseJwt(token);
  if (!payload || !payload.user) {
    return null;
  }
  
  return payload.user as User;
} 
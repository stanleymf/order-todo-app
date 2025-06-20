import { v4 as uuidv4 } from 'uuid';
import { databaseService } from './database';
import { User, Tenant, ShopifyStore } from '../types/multi-tenant';

// JWT payload interface
export interface JWTPayload {
  iss: string;        // Issuer
  sub: string;        // Subject (user ID)
  aud: string;        // Audience (tenant ID)
  exp: number;        // Expiration
  iat: number;        // Issued at
  nbf: number;        // Not before
  
  // Custom claims
  tenantId: string;   // Tenant identifier
  userId: string;     // User identifier
  role: string;       // User role
  permissions: string[]; // User permissions
  sessionId: string;  // Session identifier
  currentStoreId?: string; // Current store context
  assignedStores: string[]; // Stores user can access
}

// Authentication result interface
export interface AuthResult {
  success: boolean;
  user?: User;
  tenant?: Tenant;
  token?: string;
  refreshToken?: string;
  message?: string;
  error?: string;
}

// Login credentials interface
export interface LoginCredentials {
  email: string;
  password: string;
  tenantDomain?: string;
}

// Session interface
export interface Session {
  id: string;
  userId: string;
  tenantId: string;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  currentStoreId?: string;
  createdAt: Date;
  lastActivity: Date;
}

// In-memory session store (in production, use Redis or database)
const sessions = new Map<string, Session>();

// JWT secret (in production, use environment variable)
const JWT_SECRET = 'your-super-secret-jwt-key-change-in-production';
const JWT_REFRESH_SECRET = 'your-super-secret-refresh-key-change-in-production';

export class MultiTenantAuthService {
  private static instance: MultiTenantAuthService;

  private constructor() {}

  static getInstance(): MultiTenantAuthService {
    if (!MultiTenantAuthService.instance) {
      MultiTenantAuthService.instance = new MultiTenantAuthService();
    }
    return MultiTenantAuthService.instance;
  }

  // Generate JWT token
  private generateToken(payload: Omit<JWTPayload, 'iss' | 'iat' | 'nbf' | 'exp'>): string {
    const now = Math.floor(Date.now() / 1000);
    const tokenPayload: JWTPayload = {
      ...payload,
      iss: 'order-todo-app',
      iat: now,
      nbf: now,
      exp: now + (60 * 60 * 24) // 24 hours
    };

    // Simple JWT encoding (in production, use a proper JWT library)
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payloadStr = btoa(JSON.stringify(tokenPayload));
    const signature = btoa(JWT_SECRET); // In production, use proper HMAC

    return `${header}.${payloadStr}.${signature}`;
  }

  // Generate refresh token
  private generateRefreshToken(sessionId: string): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sessionId,
      exp: now + (60 * 60 * 24 * 7) // 7 days
    };

    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payloadStr = btoa(JSON.stringify(payload));
    const signature = btoa(JWT_REFRESH_SECRET);

    return `${header}.${payloadStr}.${signature}`;
  }

  // Validate JWT token
  async validateToken(token: string): Promise<JWTPayload | null> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payloadStr = atob(parts[1]);
      const payload: JWTPayload = JSON.parse(payloadStr);

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) return null;

      // Verify session exists
      const session = sessions.get(payload.sessionId);
      if (!session || session.token !== token) return null;

      // Update last activity
      session.lastActivity = new Date();

      return payload;
    } catch (error) {
      console.error('Token validation error:', error);
      return null;
    }
  }

  // Validate refresh token
  private validateRefreshToken(refreshToken: string): string | null {
    try {
      const parts = refreshToken.split('.');
      if (parts.length !== 3) return null;

      const payloadStr = atob(parts[1]);
      const payload = JSON.parse(payloadStr);

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) return null;

      return payload.sessionId;
    } catch (error) {
      console.error('Refresh token validation error:', error);
      return null;
    }
  }

  // Login user
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      // Find tenant by domain
      let tenant: Tenant | null = null;
      if (credentials.tenantDomain) {
        const tenants = await databaseService.listTenants({ domain: credentials.tenantDomain });
        tenant = tenants[0] || null;
      }

      // If no tenant specified, try to find user by email across all tenants
      if (!tenant) {
        const allTenants = await databaseService.listTenants();
        for (const t of allTenants) {
          const users = await databaseService.getUsers(t.id);
          const user = users.find(u => u.email === credentials.email);
          if (user) {
            tenant = t;
            break;
          }
        }
      }

      if (!tenant) {
        return {
          success: false,
          error: 'Tenant not found'
        };
      }

      // Find user in tenant
      const users = await databaseService.getUsers(tenant.id);
      const user = users.find(u => u.email === credentials.email);

      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Simple password validation (in production, use proper hashing)
      if (credentials.password !== 'password') {
        return {
          success: false,
          error: 'Invalid password'
        };
      }

      // Create session
      const sessionId = uuidv4();
      const token = this.generateToken({
        sub: user.id,
        aud: tenant.id,
        tenantId: tenant.id,
        userId: user.id,
        role: user.role,
        permissions: user.permissions,
        sessionId,
        assignedStores: [] // Will be populated from user's store access
      });

      const refreshToken = this.generateRefreshToken(sessionId);

      const session: Session = {
        id: sessionId,
        userId: user.id,
        tenantId: tenant.id,
        token,
        refreshToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        createdAt: new Date(),
        lastActivity: new Date()
      };

      sessions.set(sessionId, session);

      return {
        success: true,
        user,
        tenant,
        token,
        refreshToken
      };

    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Login failed'
      };
    }
  }

  // Refresh token
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      const sessionId = this.validateRefreshToken(refreshToken);
      if (!sessionId) {
        return {
          success: false,
          error: 'Invalid refresh token'
        };
      }

      const session = sessions.get(sessionId);
      if (!session || session.refreshToken !== refreshToken) {
        return {
          success: false,
          error: 'Invalid session'
        };
      }

      // Get user and tenant
      const tenant = await databaseService.getTenant(session.tenantId);
      const users = await databaseService.getUsers(session.tenantId);
      const user = users.find(u => u.id === session.userId);

      if (!tenant || !user) {
        return {
          success: false,
          error: 'User or tenant not found'
        };
      }

      // Generate new tokens
      const newToken = this.generateToken({
        sub: user.id,
        aud: tenant.id,
        tenantId: tenant.id,
        userId: user.id,
        role: user.role,
        permissions: user.permissions,
        sessionId,
        assignedStores: []
      });

      const newRefreshToken = this.generateRefreshToken(sessionId);

      // Update session
      session.token = newToken;
      session.refreshToken = newRefreshToken;
      session.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      session.lastActivity = new Date();

      return {
        success: true,
        user,
        tenant,
        token: newToken,
        refreshToken: newRefreshToken
      };

    } catch (error) {
      console.error('Token refresh error:', error);
      return {
        success: false,
        error: 'Token refresh failed'
      };
    }
  }

  // Logout
  async logout(sessionToken: string): Promise<boolean> {
    try {
      const payload = await this.validateToken(sessionToken);
      if (!payload) return false;

      sessions.delete(payload.sessionId);
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  // Switch store context
  async switchStore(sessionToken: string, storeId: string): Promise<AuthResult> {
    try {
      const payload = await this.validateToken(sessionToken);
      if (!payload) {
        return {
          success: false,
          error: 'Invalid session'
        };
      }

      const session = sessions.get(payload.sessionId);
      if (!session) {
        return {
          success: false,
          error: 'Session not found'
        };
      }

      // Verify user has access to this store
      const stores = await databaseService.getStores(payload.tenantId);
      const store = stores.find(s => s.id === storeId);
      
      if (!store) {
        return {
          success: false,
          error: 'Store not found'
        };
      }

      // Update session with new store context
      session.currentStoreId = storeId;

      // Generate new token with updated store context
      const newToken = this.generateToken({
        sub: payload.userId,
        aud: payload.tenantId,
        tenantId: payload.tenantId,
        userId: payload.userId,
        role: payload.role,
        permissions: payload.permissions,
        sessionId: payload.sessionId,
        currentStoreId: storeId,
        assignedStores: payload.assignedStores
      });

      session.token = newToken;
      session.lastActivity = new Date();

      return {
        success: true,
        token: newToken
      };

    } catch (error) {
      console.error('Store switch error:', error);
      return {
        success: false,
        error: 'Store switch failed'
      };
    }
  }

  // Get current session
  async getCurrentSession(token: string): Promise<Session | null> {
    try {
      const payload = await this.validateToken(token);
      if (!payload) return null;

      return sessions.get(payload.sessionId) || null;
    } catch (error) {
      console.error('Get session error:', error);
      return null;
    }
  }

  // Clean up expired sessions
  cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [sessionId, session] of sessions.entries()) {
      if (session.expiresAt < now) {
        sessions.delete(sessionId);
      }
    }
  }

  // Get all active sessions (for admin purposes)
  getActiveSessions(): Session[] {
    return Array.from(sessions.values());
  }
}

// Export singleton instance
export const authService = MultiTenantAuthService.getInstance(); 
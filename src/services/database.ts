import sqlite3 from 'sqlite3';
import { join } from 'path';
import { 
  Tenant, 
  CreateTenantRequest, 
  Order, 
  CreateOrderRequest, 
  OrderFilters,
  ShopifyStore,
  User,
  TenantFilters
} from '../types/multi-tenant';

export class DatabaseService {
  private db: sqlite3.Database;

  constructor() {
    const dbPath = join(process.cwd(), 'data', 'order-todo.db');
    this.db = new sqlite3.Database(dbPath);
    this.initializeTables();
  }

  private initializeTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      const schema = `
        CREATE TABLE IF NOT EXISTS tenants (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          domain TEXT UNIQUE NOT NULL,
          subscription_plan TEXT DEFAULT 'starter',
          status TEXT DEFAULT 'active',
          settings TEXT DEFAULT '{}',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tenant_orders (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          shopify_order_id TEXT,
          customer_name TEXT NOT NULL,
          delivery_date TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          priority INTEGER DEFAULT 0,
          assigned_to TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        );

        CREATE TABLE IF NOT EXISTS tenant_products (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          shopify_product_id TEXT,
          name TEXT NOT NULL,
          description TEXT,
          price REAL,
          stock_quantity INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        );

        CREATE TABLE IF NOT EXISTS tenant_users (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          role TEXT DEFAULT 'florist',
          permissions TEXT DEFAULT '[]',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        );

        CREATE TABLE IF NOT EXISTS shopify_stores (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          shopify_domain TEXT UNIQUE NOT NULL,
          access_token TEXT NOT NULL,
          webhook_secret TEXT,
          sync_enabled BOOLEAN DEFAULT true,
          last_sync_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        );
      `;

      this.db.exec(schema, (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Tenant management methods
  createTenant(tenantData: CreateTenantRequest): Promise<Tenant> {
    return new Promise((resolve, reject) => {
      const tenantId = crypto.randomUUID();
      const settings = {
        timezone: 'UTC',
        currency: 'USD',
        businessHours: { start: '09:00', end: '17:00' },
        features: { analytics: false, multiStore: false, advancedReporting: false },
        ...tenantData.settings
      };

      const stmt = this.db.prepare(`
        INSERT INTO tenants (id, name, domain, subscription_plan, settings)
        VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run(
        tenantId, 
        tenantData.name, 
        tenantData.domain, 
        tenantData.subscriptionPlan || 'starter', 
        JSON.stringify(settings),
        (err: Error | null) => {
          if (err) {
            reject(err);
          } else {
            this.getTenant(tenantId).then((tenant) => {
              if (tenant) {
                resolve(tenant);
              } else {
                reject(new Error('Failed to retrieve created tenant'));
              }
            }).catch(reject);
          }
        }
      );
      stmt.finalize();
    });
  }

  getTenant(tenantId: string): Promise<Tenant | null> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare('SELECT * FROM tenants WHERE id = ?');
      stmt.get(tenantId, (err: Error | null, result: any) => {
        stmt.finalize();
        if (err) {
          reject(err);
        } else if (!result) {
          resolve(null);
        } else {
          resolve({
            id: result.id,
            name: result.name,
            domain: result.domain,
            subscriptionPlan: result.subscription_plan,
            status: result.status,
            settings: JSON.parse(result.settings),
            createdAt: result.created_at,
            updatedAt: result.updated_at
          });
        }
      });
    });
  }

  updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant | null> {
    return new Promise(async (resolve, reject) => {
      try {
        const tenant = await this.getTenant(tenantId);
        if (!tenant) {
          resolve(null);
          return;
        }

        const fields = Object.keys(updates).filter(key => key !== 'id' && key !== 'createdAt' && key !== 'updatedAt');
        if (fields.length === 0) {
          resolve(tenant);
          return;
        }

        const setClause = fields.map(field => {
          const dbField = field === 'subscriptionPlan' ? 'subscription_plan' : field;
          return `${dbField} = ?`;
        }).join(', ');
        
        const values = fields.map(field => {
          const value = updates[field as keyof Tenant];
          return field === 'settings' ? JSON.stringify(value) : value;
        });

        const stmt = this.db.prepare(`
          UPDATE tenants 
          SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `);
        
        stmt.run(...values, tenantId, (err: Error | null) => {
          stmt.finalize();
          if (err) {
            reject(err);
          } else {
            this.getTenant(tenantId).then(resolve).catch(reject);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  deleteTenant(tenantId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare('DELETE FROM tenants WHERE id = ?');
      stmt.run(tenantId, function(this: sqlite3.RunResult, err: Error | null) {
        stmt.finalize();
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  listTenants(filters?: TenantFilters): Promise<Tenant[]> {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM tenants WHERE 1=1';
      const params: any[] = [];

      if (filters?.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters?.subscriptionPlan) {
        query += ' AND subscription_plan = ?';
        params.push(filters.subscriptionPlan);
      }

      if (filters?.domain) {
        query += ' AND domain LIKE ?';
        params.push(`%${filters.domain}%`);
      }

      query += ' ORDER BY created_at DESC';

      this.db.all(query, params, (err: Error | null, results: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(results.map(result => ({
            id: result.id,
            name: result.name,
            domain: result.domain,
            subscriptionPlan: result.subscription_plan,
            status: result.status,
            settings: JSON.parse(result.settings),
            createdAt: result.created_at,
            updatedAt: result.updated_at
          })));
        }
      });
    });
  }

  // Order management methods
  getOrders(tenantId: string, filters?: OrderFilters): Promise<Order[]> {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM tenant_orders WHERE tenant_id = ?';
      const params: any[] = [tenantId];

      if (filters?.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters?.assignedTo) {
        query += ' AND assigned_to = ?';
        params.push(filters.assignedTo);
      }

      if (filters?.deliveryDate) {
        query += ' AND delivery_date = ?';
        params.push(filters.deliveryDate);
      }

      if (filters?.priority !== undefined) {
        query += ' AND priority = ?';
        params.push(filters.priority);
      }

      query += ' ORDER BY priority DESC, delivery_date ASC';

      this.db.all(query, params, (err: Error | null, results: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(results.map(result => ({
            id: result.id,
            tenantId: result.tenant_id,
            shopifyOrderId: result.shopify_order_id,
            customerName: result.customer_name,
            deliveryDate: result.delivery_date,
            status: result.status,
            priority: result.priority,
            assignedTo: result.assigned_to,
            notes: result.notes,
            createdAt: result.created_at,
            updatedAt: result.updated_at
          })));
        }
      });
    });
  }

  createOrder(tenantId: string, orderData: CreateOrderRequest): Promise<Order> {
    return new Promise((resolve, reject) => {
      const orderId = crypto.randomUUID();
      const stmt = this.db.prepare(`
        INSERT INTO tenant_orders (id, tenant_id, shopify_order_id, customer_name, delivery_date, status, priority, assigned_to, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        orderId,
        tenantId,
        orderData.shopifyOrderId,
        orderData.customerName,
        orderData.deliveryDate,
        orderData.status || 'pending',
        orderData.priority || 0,
        orderData.assignedTo,
        orderData.notes,
        (err: Error | null) => {
          stmt.finalize();
          if (err) {
            reject(err);
          } else {
            this.getOrder(tenantId, orderId).then((order) => {
              if (order) {
                resolve(order);
              } else {
                reject(new Error('Failed to retrieve created order'));
              }
            }).catch(reject);
          }
        }
      );
    });
  }

  getOrder(tenantId: string, orderId: string): Promise<Order | null> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare('SELECT * FROM tenant_orders WHERE tenant_id = ? AND id = ?');
      stmt.get(tenantId, orderId, (err: Error | null, result: any) => {
        stmt.finalize();
        if (err) {
          reject(err);
        } else if (!result) {
          resolve(null);
        } else {
          resolve({
            id: result.id,
            tenantId: result.tenant_id,
            shopifyOrderId: result.shopify_order_id,
            customerName: result.customer_name,
            deliveryDate: result.delivery_date,
            status: result.status,
            priority: result.priority,
            assignedTo: result.assigned_to,
            notes: result.notes,
            createdAt: result.created_at,
            updatedAt: result.updated_at
          });
        }
      });
    });
  }

  updateOrder(tenantId: string, orderId: string, updates: Partial<Order>): Promise<Order | null> {
    return new Promise(async (resolve, reject) => {
      try {
        const order = await this.getOrder(tenantId, orderId);
        if (!order) {
          resolve(null);
          return;
        }

        const fields = Object.keys(updates).filter(key => 
          key !== 'id' && key !== 'tenantId' && key !== 'createdAt' && key !== 'updatedAt'
        );
        
        if (fields.length === 0) {
          resolve(order);
          return;
        }

        const setClause = fields.map(field => {
          const dbField = field === 'shopifyOrderId' ? 'shopify_order_id' : 
                         field === 'customerName' ? 'customer_name' :
                         field === 'deliveryDate' ? 'delivery_date' :
                         field === 'assignedTo' ? 'assigned_to' : field;
          return `${dbField} = ?`;
        }).join(', ');
        
        const values = fields.map(field => updates[field as keyof Order]);

        const stmt = this.db.prepare(`
          UPDATE tenant_orders 
          SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
          WHERE tenant_id = ? AND id = ?
        `);
        
        stmt.run(...values, tenantId, orderId, (err: Error | null) => {
          stmt.finalize();
          if (err) {
            reject(err);
          } else {
            this.getOrder(tenantId, orderId).then(resolve).catch(reject);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  deleteOrder(tenantId: string, orderId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare('DELETE FROM tenant_orders WHERE tenant_id = ? AND id = ?');
      stmt.run(tenantId, orderId, function(this: sqlite3.RunResult, err: Error | null) {
        stmt.finalize();
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  // Product management methods (placeholder for now)
  getProducts(tenantId: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare('SELECT * FROM tenant_products WHERE tenant_id = ?');
      stmt.all(tenantId, (err: Error | null, results) => {
        stmt.finalize();
        if (err) {
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
  }

  // User management methods (placeholder for now)
  getUsers(tenantId: string): Promise<User[]> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare('SELECT * FROM tenant_users WHERE tenant_id = ?');
      stmt.all(tenantId, (err: Error | null, results: any[]) => {
        stmt.finalize();
        if (err) {
          reject(err);
        } else {
          resolve(results.map((result: any) => ({
            id: result.id,
            tenantId: result.tenant_id,
            email: result.email,
            name: result.name,
            role: result.role,
            permissions: JSON.parse(result.permissions),
            createdAt: result.created_at,
            updatedAt: result.updated_at
          })));
        }
      });
    });
  }

  createUser(tenantId: string, userData: { email: string; name: string; role?: string; permissions?: string[] }): Promise<User> {
    return new Promise((resolve, reject) => {
      const userId = crypto.randomUUID();
      const stmt = this.db.prepare(`
        INSERT INTO tenant_users (id, tenant_id, email, name, role, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        userId,
        tenantId,
        userData.email,
        userData.name,
        userData.role || 'florist',
        JSON.stringify(userData.permissions || []),
        (err: Error | null) => {
          stmt.finalize();
          if (err) {
            reject(err);
          } else {
            this.getUser(tenantId, userId).then((user) => {
              if (user) {
                resolve(user);
              } else {
                reject(new Error('Failed to retrieve created user'));
              }
            }).catch(reject);
          }
        }
      );
    });
  }

  getUser(tenantId: string, userId: string): Promise<User | null> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare('SELECT * FROM tenant_users WHERE tenant_id = ? AND id = ?');
      stmt.get(tenantId, userId, (err: Error | null, result: any) => {
        stmt.finalize();
        if (err) {
          reject(err);
        } else if (!result) {
          resolve(null);
        } else {
          resolve({
            id: result.id,
            tenantId: result.tenant_id,
            email: result.email,
            name: result.name,
            role: result.role,
            permissions: JSON.parse(result.permissions),
            createdAt: result.created_at,
            updatedAt: result.updated_at
          });
        }
      });
    });
  }

  updateUser(tenantId: string, userId: string, updates: Partial<User>): Promise<User | null> {
    return new Promise(async (resolve, reject) => {
      try {
        const user = await this.getUser(tenantId, userId);
        if (!user) {
          resolve(null);
          return;
        }

        const fields = Object.keys(updates).filter(key => 
          key !== 'id' && key !== 'tenantId' && key !== 'createdAt' && key !== 'updatedAt'
        );
        
        if (fields.length === 0) {
          resolve(user);
          return;
        }

        const setClause = fields.map(field => `${field} = ?`).join(', ');
        const values = fields.map(field => {
          const value = updates[field as keyof User];
          return field === 'permissions' ? JSON.stringify(value) : value;
        });

        const stmt = this.db.prepare(`
          UPDATE tenant_users 
          SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
          WHERE tenant_id = ? AND id = ?
        `);
        
        stmt.run(...values, tenantId, userId, (err: Error | null) => {
          stmt.finalize();
          if (err) {
            reject(err);
          } else {
            this.getUser(tenantId, userId).then(resolve).catch(reject);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  deleteUser(tenantId: string, userId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare('DELETE FROM tenant_users WHERE tenant_id = ? AND id = ?');
      stmt.run(tenantId, userId, function(this: sqlite3.RunResult, err: Error | null) {
        stmt.finalize();
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  // Store management methods (placeholder for now)
  getStores(tenantId: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare('SELECT * FROM shopify_stores WHERE tenant_id = ?');
      stmt.all(tenantId, (err: Error | null, results) => {
        stmt.finalize();
        if (err) {
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
  }

  // Close database connection
  close(): void {
    this.db.close();
  }
}

// Singleton instance
export const databaseService = new DatabaseService(); 
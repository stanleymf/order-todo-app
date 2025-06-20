import { Tenant, CreateTenantRequest, User, Order } from '../types/multi-tenant';

export const d1DatabaseService = {
  // Create a new tenant
  async createTenant(env: any, tenantData: CreateTenantRequest): Promise<Tenant> {
    const tenantId = crypto.randomUUID();
    const settings = {
      timezone: 'UTC',
      currency: 'USD',
      businessHours: { start: '09:00', end: '17:00' },
      features: { analytics: false, multiStore: false, advancedReporting: false },
      ...tenantData.settings
    };
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO tenants (id, name, domain, subscription_plan, status, settings, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`
    ).bind(
      tenantId,
      tenantData.name,
      tenantData.domain,
      tenantData.subscriptionPlan || 'starter',
      JSON.stringify(settings),
      now,
      now
    ).run();
    return await d1DatabaseService.getTenant(env, tenantId) as Tenant;
  },

  // Get a tenant by ID
  async getTenant(env: any, tenantId: string): Promise<Tenant | null> {
    const { results } = await env.DB.prepare('SELECT * FROM tenants WHERE id = ?').bind(tenantId).all();
    const result = results[0];
    if (!result) return null;
    return {
      id: result.id,
      name: result.name,
      domain: result.domain,
      subscriptionPlan: result.subscription_plan,
      status: result.status,
      settings: JSON.parse(result.settings),
      createdAt: result.created_at,
      updatedAt: result.updated_at
    };
  },

  // List tenants (optionally filter by domain)
  async listTenants(env: any, filters?: { domain?: string }): Promise<Tenant[]> {
    let query = 'SELECT * FROM tenants';
    let params: any[] = [];
    if (filters?.domain) {
      query += ' WHERE domain = ?';
      params.push(filters.domain);
    }
    const { results } = await env.DB.prepare(query).bind(...params).all();
    return results.map((result: any) => ({
      id: result.id,
      name: result.name,
      domain: result.domain,
      subscriptionPlan: result.subscription_plan,
      status: result.status,
      settings: JSON.parse(result.settings),
      createdAt: result.created_at,
      updatedAt: result.updated_at
    }));
  },

  // Create a new user for a tenant
  async createUser(env: any, tenantId: string, userData: { email: string; name: string; role?: string; permissions?: string[] }): Promise<User> {
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO tenant_users (id, tenant_id, email, name, role, permissions, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      userId,
      tenantId,
      userData.email,
      userData.name,
      userData.role || 'florist',
      JSON.stringify(userData.permissions || []),
      now,
      now
    ).run();
    return await d1DatabaseService.getUser(env, tenantId, userId) as User;
  },

  // Get a user by ID
  async getUser(env: any, tenantId: string, userId: string): Promise<User | null> {
    const { results } = await env.DB.prepare('SELECT * FROM tenant_users WHERE tenant_id = ? AND id = ?').bind(tenantId, userId).all();
    const result = results[0];
    if (!result) return null;
    return {
      id: result.id,
      tenantId: result.tenant_id,
      email: result.email,
      name: result.name,
      role: result.role,
      permissions: JSON.parse(result.permissions),
      createdAt: result.created_at,
      updatedAt: result.updated_at
    };
  },

  // List users for a tenant
  async getUsers(env: any, tenantId: string): Promise<User[]> {
    const { results } = await env.DB.prepare('SELECT * FROM tenant_users WHERE tenant_id = ?').bind(tenantId).all();
    return results.map((result: any) => ({
      id: result.id,
      tenantId: result.tenant_id,
      email: result.email,
      name: result.name,
      role: result.role,
      permissions: JSON.parse(result.permissions),
      createdAt: result.created_at,
      updatedAt: result.updated_at
    }));
  },

  // List orders for a tenant (with optional filters)
  async getOrders(env: any, tenantId: string, filters?: { status?: string; assignedTo?: string; deliveryDate?: string; storeId?: string }): Promise<Order[]> {
    let query = 'SELECT * FROM tenant_orders WHERE tenant_id = ?';
    let params: any[] = [tenantId];

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
    // Note: storeId filter would need to be added to the orders table schema if needed

    query += ' ORDER BY delivery_date ASC, priority DESC, created_at ASC';
    
    const { results } = await env.DB.prepare(query).bind(...params).all();
    return results.map((result: any) => ({
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
    }));
  },

  // Create a new order for a tenant
  async createOrder(env: any, tenantId: string, orderData: { customerName: string; deliveryDate: string; status?: string; priority?: number; assignedTo?: string; notes?: string; shopifyOrderId?: string }): Promise<Order> {
    const orderId = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO tenant_orders (id, tenant_id, shopify_order_id, customer_name, delivery_date, status, priority, assigned_to, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      orderId,
      tenantId,
      orderData.shopifyOrderId || null,
      orderData.customerName,
      orderData.deliveryDate,
      orderData.status || 'pending',
      orderData.priority || 0,
      orderData.assignedTo || null,
      orderData.notes || null,
      now,
      now
    ).run();
    return await d1DatabaseService.getOrder(env, tenantId, orderId) as Order;
  },

  // Get a single order by ID
  async getOrder(env: any, tenantId: string, orderId: string): Promise<Order | null> {
    const { results } = await env.DB.prepare('SELECT * FROM tenant_orders WHERE tenant_id = ? AND id = ?').bind(tenantId, orderId).all();
    const result = results[0];
    if (!result) return null;
    return {
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
    };
  },

  // Update an order
  async updateOrder(env: any, tenantId: string, orderId: string, updateData: Partial<Order>): Promise<Order | null> {
    const now = new Date().toISOString();
    const fields = [];
    const values = [];

    if (updateData.customerName !== undefined) {
      fields.push('customer_name = ?');
      values.push(updateData.customerName);
    }
    if (updateData.deliveryDate !== undefined) {
      fields.push('delivery_date = ?');
      values.push(updateData.deliveryDate);
    }
    if (updateData.status !== undefined) {
      fields.push('status = ?');
      values.push(updateData.status);
    }
    if (updateData.priority !== undefined) {
      fields.push('priority = ?');
      values.push(updateData.priority);
    }
    if (updateData.assignedTo !== undefined) {
      fields.push('assigned_to = ?');
      values.push(updateData.assignedTo);
    }
    if (updateData.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updateData.notes);
    }
    if (updateData.shopifyOrderId !== undefined) {
      fields.push('shopify_order_id = ?');
      values.push(updateData.shopifyOrderId);
    }

    fields.push('updated_at = ?');
    values.push(now);

    if (fields.length === 1) { // Only updated_at
      return await d1DatabaseService.getOrder(env, tenantId, orderId);
    }

    values.push(tenantId, orderId);
    const query = `UPDATE tenant_orders SET ${fields.join(', ')} WHERE tenant_id = ? AND id = ?`;
    
    await env.DB.prepare(query).bind(...values).run();
    return await d1DatabaseService.getOrder(env, tenantId, orderId);
  },

  // Delete an order
  async deleteOrder(env: any, tenantId: string, orderId: string): Promise<boolean> {
    const { meta } = await env.DB.prepare('DELETE FROM tenant_orders WHERE tenant_id = ? AND id = ?').bind(tenantId, orderId).run();
    return meta.changes > 0;
  }
}; 
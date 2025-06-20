import { v4 as uuidv4 } from 'uuid';
import { databaseService } from './database';
import { 
  Tenant, 
  CreateTenantRequest, 
  MigrationResult, 
  ValidationResult,
  CreateOrderRequest
} from '../types/multi-tenant';

// Import existing storage functions
import { getOrders, getProducts, getUsers } from '../utils/storage';

export class MigrationService {
  async createDefaultTenant(): Promise<Tenant> {
    const defaultTenant: CreateTenantRequest = {
      name: 'Default Florist',
      domain: 'default-florist',
      subscriptionPlan: 'starter',
      settings: {
        timezone: 'UTC',
        currency: 'USD',
        businessHours: {
          start: '09:00',
          end: '17:00'
        },
        features: {
          analytics: true,
          multiStore: false,
          advancedReporting: false
        }
      }
    };

    return databaseService.createTenant(defaultTenant);
  }

  async migrateOrdersToTenant(tenantId: string): Promise<MigrationResult> {
    try {
      const existingOrders = getOrders();
      let migrated = 0;
      let errors = 0;

      for (const order of existingOrders) {
        try {
          const orderData: CreateOrderRequest = {
            shopifyOrderId: undefined, // Not available in existing data
            customerName: order.productName, // Using productName as customer name for now
            deliveryDate: order.date, // Using date as delivery date
            status: order.status,
            priority: 0, // Default priority
            assignedTo: order.assignedFloristId,
            notes: order.remarks
          };

          databaseService.createOrder(tenantId, orderData);
          migrated++;
        } catch (error) {
          console.error(`Failed to migrate order ${order.id}:`, error);
          errors++;
        }
      }

      return {
        success: true,
        migrated,
        errors,
        message: `Migrated ${migrated} orders with ${errors} errors`
      };
    } catch (error) {
      return {
        success: false,
        migrated: 0,
        errors: 1,
        message: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async migrateProductsToTenant(tenantId: string): Promise<MigrationResult> {
    try {
      const existingProducts = getProducts();
      let migrated = 0;
      let errors = 0;

      // For now, we'll just count products but not migrate them yet
      // since we need to implement the product migration logic
      migrated = existingProducts.length;

      return {
        success: true,
        migrated,
        errors,
        message: `Found ${migrated} products to migrate (migration not implemented yet)`
      };
    } catch (error) {
      return {
        success: false,
        migrated: 0,
        errors: 1,
        message: `Product migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async migrateUsersToTenant(tenantId: string): Promise<MigrationResult> {
    try {
      const existingUsers = getUsers();
      let migrated = 0;
      let errors = 0;

      // For now, we'll just count users but not migrate them yet
      // since we need to implement the user migration logic
      migrated = existingUsers.length;

      return {
        success: true,
        migrated,
        errors,
        message: `Found ${migrated} users to migrate (migration not implemented yet)`
      };
    } catch (error) {
      return {
        success: false,
        migrated: 0,
        errors: 1,
        message: `User migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async validateMigration(tenantId: string): Promise<ValidationResult> {
    const tenant = databaseService.getTenant(tenantId);
    if (!tenant) {
      return { valid: false, errors: ['Tenant not found'] };
    }

    const orders = databaseService.getOrders(tenantId);
    const originalOrders = getOrders();

    const errors: string[] = [];
    
    if (orders.length !== originalOrders.length) {
      errors.push(`Order count mismatch: ${orders.length} vs ${originalOrders.length}`);
    }

    // Validate that all orders have the correct tenant_id
    const invalidOrders = orders.filter(order => order.tenantId !== tenantId);
    if (invalidOrders.length > 0) {
      errors.push(`Found ${invalidOrders.length} orders with incorrect tenant_id`);
    }

    return {
      valid: errors.length === 0,
      errors,
      summary: {
        tenant: tenant.name,
        ordersMigrated: orders.length,
        productsMigrated: 0,
        usersMigrated: 0
      }
    };
  }

  async backupExistingData(): Promise<void> {
    try {
      const orders = getOrders();
      const products = getProducts();
      const users = getUsers();

      const backup = {
        timestamp: new Date().toISOString(),
        orders,
        products,
        users
      };

      // Store backup in localStorage with timestamp
      localStorage.setItem('migration_backup_' + Date.now(), JSON.stringify(backup));
      
      console.log('✅ Backup created successfully');
      console.log(`   Orders: ${orders.length}`);
      console.log(`   Products: ${products.length}`);
      console.log(`   Users: ${users.length}`);
    } catch (error) {
      console.error('❌ Backup failed:', error);
      throw error;
    }
  }

  async rollbackMigration(tenantId: string): Promise<boolean> {
    try {
      // Delete all data for the tenant
      const orders = databaseService.getOrders(tenantId);
      for (const order of orders) {
        databaseService.deleteOrder(tenantId, order.id);
      }

      // Delete the tenant
      const deleted = databaseService.deleteTenant(tenantId);
      
      if (deleted) {
        console.log('✅ Rollback completed successfully');
        return true;
      } else {
        console.log('❌ Failed to delete tenant');
        return false;
      }
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      return false;
    }
  }
}

export const migrationService = new MigrationService(); 
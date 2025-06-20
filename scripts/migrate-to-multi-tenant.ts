import { migrationService } from '../src/services/migration';

async function runMigration() {
  console.log('🚀 Starting migration to multi-tenant architecture...\n');

  try {
    // Step 1: Create backup
    console.log('💾 Creating backup of existing data...');
    await migrationService.backupExistingData();
    console.log('✅ Backup completed\n');

    // Step 2: Create default tenant
    console.log('📋 Creating default tenant...');
    const tenant = await migrationService.createDefaultTenant();
    console.log(`✅ Created tenant: ${tenant.name} (${tenant.id})\n`);

    // Step 3: Migrate orders
    console.log('📦 Migrating orders...');
    const orderResult = await migrationService.migrateOrdersToTenant(tenant.id);
    console.log(`✅ ${orderResult.message}\n`);

    // Step 4: Migrate products
    console.log('🛍️ Migrating products...');
    const productResult = await migrationService.migrateProductsToTenant(tenant.id);
    console.log(`✅ ${productResult.message}\n`);

    // Step 5: Migrate users
    console.log('👥 Migrating users...');
    const userResult = await migrationService.migrateUsersToTenant(tenant.id);
    console.log(`✅ ${userResult.message}\n`);

    // Step 6: Validate migration
    console.log('🔍 Validating migration...');
    const validation = await migrationService.validateMigration(tenant.id);
    
    if (validation.valid) {
      console.log('✅ Migration validation passed!');
      if (validation.summary) {
        console.log('📊 Migration Summary:');
        console.log(`   Tenant: ${validation.summary.tenant}`);
        console.log(`   Orders: ${validation.summary.ordersMigrated}`);
        console.log(`   Products: ${validation.summary.productsMigrated}`);
        console.log(`   Users: ${validation.summary.usersMigrated}`);
      }
      console.log('\n🎉 Migration completed successfully!');
      console.log('\n📝 Next steps:');
      console.log('   1. Test the application to ensure it still works');
      console.log('   2. Begin implementing authentication system');
      console.log('   3. Update UI components for multi-tenant support');
    } else {
      console.log('❌ Migration validation failed:');
      validation.errors.forEach(error => console.log(`   - ${error}`));
      console.log('\n🔄 Rolling back migration...');
      const rollbackSuccess = await migrationService.rollbackMigration(tenant.id);
      if (rollbackSuccess) {
        console.log('✅ Rollback completed successfully');
      } else {
        console.log('❌ Rollback failed - manual intervention required');
      }
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⚠️ Migration interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Migration terminated');
  process.exit(0);
});

// Run the migration
runMigration(); 
/**
 * Master Seed Script
 * Seeds all RBAC data (permissions and role templates)
 * Run: npm run seed:rbac OR node src/scripts/seed-all.js
 */
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const runScript = async (scriptPath, description) => {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🚀 ${description}`);
  console.log(`${'='.repeat(70)}\n`);
  
  try {
    const { stdout, stderr } = await execAsync(`node ${scriptPath}`);
    console.log(stdout);
    if (stderr) console.error(stderr);
    return true;
  } catch (error) {
    console.error(`❌ Error running ${scriptPath}:`, error.message);
    return false;
  }
};

const seedAll = async () => {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                    CLOUDTRUCK RBAC SEED SCRIPT                     ║');
  console.log('║                 Seeding Permissions & Role Templates               ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  
  const startTime = Date.now();
  
  // Step 1: Seed Permissions
  const step1 = await runScript(
    'src/scripts/seed-permissions.js',
    'Step 1: Seeding Permissions'
  );
  
  if (!step1) {
    console.log('\n❌ Failed to seed permissions. Aborting...\n');
    process.exit(1);
  }
  
  // Step 2: Seed Role Templates (depends on permissions)
  const step2 = await runScript(
    'src/scripts/seed-role-templates.js',
    'Step 2: Seeding Role Templates'
  );
  
  if (!step2) {
    console.log('\n❌ Failed to seed role templates. Aborting...\n');
    process.exit(1);
  }
  
  // Step 3: Seed Market Rates
  const step3 = await runScript(
    'src/scripts/seed-market-rates.js',
    'Step 3: Seeding Market Rates'
  );

  if (!step3) {
    console.log('\n❌ Failed to seed market rates. Aborting...\n');
    process.exit(1);
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                      ✅ SEEDING COMPLETED                          ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log(`\n⏱️  Time taken: ${duration}s\n`);
  console.log('📝 Next Steps:');
  console.log('   1. Verify permissions in database');
  console.log('   2. Assign role templates to staff members');
  console.log('   3. Test permission-based access in the admin panel\n');
};

seedAll();

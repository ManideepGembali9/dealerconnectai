// Cross-platform launcher for DealerConnect AI Three Independent Apps
const { spawn } = require('child_process');

const variant = process.argv[2] || 'customer';
const isTunnel = process.argv.includes('--tunnel');

const validVariants = ['customer', 'dealer', 'admin'];
if (!validVariants.includes(variant)) {
  console.error(`Invalid app variant: "${variant}". Choose from: ${validVariants.join(', ')}`);
  process.exit(1);
}

process.env.APP_VARIANT = variant;

const titles = {
  customer: 'Customer App (com.dealerconnectai.customer)',
  dealer: 'Dealer App (com.dealerconnectai.dealer)',
  admin: 'Admin App (com.dealerconnectai.admin)',
};

console.log('========================================================');
console.log(`🚀 Starting: DealerConnect AI ${titles[variant]}`);
console.log(`Mode: ${isTunnel ? 'All Area Networks (WAN / Tunnel)' : 'Local Area Network (LAN)'}`);
console.log('========================================================\n');

const args = ['expo', 'start'];
if (isTunnel) {
  args.push('--tunnel', 'ngrok');
}

const child = spawn('npx', args, {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    APP_VARIANT: variant,
  },
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

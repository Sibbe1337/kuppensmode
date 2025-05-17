const fs = require('fs');
const path = require('path');

console.log('Running build-copy.js...');

const packageJsonPath = path.resolve(__dirname, 'package.json');

try {
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`Source package.json not found at ${packageJsonPath}`);
  }

  const packageJson = require(packageJsonPath);

  // Remove scripts and devDependencies, add type and main
  delete packageJson.scripts;
  delete packageJson.devDependencies;
  packageJson.type = 'commonjs';
  packageJson.main = 'index.js'; // Explicitly set main entry point

  const packageJsonString = JSON.stringify(packageJson, null, 2);

  for (const dir of ['dist-snapshot', 'dist-restore', 'dist-stripe-webhook', 'dist-daily-stats', 'dist-add-test-user']) {
    const distDir = path.resolve(__dirname, dir);
    const destPackageJsonPath = path.resolve(distDir, 'package.json');

    if (!fs.existsSync(distDir)) {
      console.warn(`dist directory ${distDir} not found, creating it.`);
      fs.mkdirSync(distDir, { recursive: true });
    }

    fs.writeFileSync(destPackageJsonPath, packageJsonString);
    console.log(`Cleaned package.json with main field copied to ${destPackageJsonPath}`);
  }
  console.log('build-copy.js finished successfully.');

} catch (error) {
  console.error('Error in build-copy.js:', error);
  process.exit(1); // Exit with error code
} 
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

// Check if dist folder exists, if not build it
if (!existsSync(join(process.cwd(), 'dist'))) {
  console.log('Building TypeScript...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('Build completed successfully');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Start the server
import('./dist/index.js').catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
}); 
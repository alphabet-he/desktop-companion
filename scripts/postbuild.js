const fs = require('fs');
const path = require('path');

const templatesDir = path.join(__dirname, '../src/templates/configs');
const distDir = path.join(__dirname, '../dist');

if (!fs.existsSync(distDir)) {
    console.log('No dist directory found.');
    process.exit(0);
}

const folders = fs.readdirSync(distDir);
for (const folder of folders) {
    const platformFolder = path.join(distDir, folder);
    const stat = fs.statSync(platformFolder);
    
    if (stat.isDirectory() && folder.startsWith('desktop-companion-')) {
        const targetDir = path.join(platformFolder, 'configs');
        console.log(`Copying templates to ${targetDir}...`);
        fs.cpSync(templatesDir, targetDir, { recursive: true });
    }
}

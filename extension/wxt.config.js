import { defineConfig } from 'wxt';

export default defineConfig({
    modules: ['@wxt-dev/module-react'],
    imports: false,
    manifest: {
        name: 'PetWise SmartPaste',
        description: 'Paste PetWise records into the field you choose in your practice management software.',
        version: '0.2.0',
        // activeTab lets the popup see which site it was opened on; sites are only added one at a time when the vet
        // enables them, so the install prompt asks for nothing beyond the local mock PIMS.
        permissions: ['storage', 'activeTab', 'scripting'],
        optional_host_permissions: ['http://*/*', 'https://*/*'],
        icons: { 16: 'icon-16.png', 48: 'icon-48.png', 128: 'icon-128.png' },
        action: { default_title: 'PetWise SmartPaste' },
    },
    dev: {
        // CRA uses 3000 and the PetWise API 3001.
        server: { port: 3010, strictPort: true },
    },
    webExt: {
        startUrls: ['http://127.0.0.1:4173/'],
    },
    vite: () => ({
        server: {
            // Lets the content script import the PetWise Copy all formatter from ../src.
            fs: { allow: ['..'] },
        },
    }),
});

import { defineConfig } from 'wxt';

export default defineConfig({
    modules: ['@wxt-dev/module-react'],
    imports: false,
    manifest: {
        name: 'PetWise SmartPaste',
        description: 'Paste PetWise SOAP records into the field you choose in your practice management software.',
        version: '0.1.0',
        permissions: ['storage'],
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

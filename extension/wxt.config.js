import { defineConfig } from 'wxt';

// Fixes the unpacked extension id to fdaakcanieiagjadphmnblgicldefcfd on every machine, so the PetWise web app
// knows where to send records (REACT_APP_SMARTPASTE_EXTENSION_ID). Public key only; the Web Store assigns its own.
const DEV_KEY =
    'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAs8Umsb5PQkiTtZ1p6mwN6TlLcDrkOydoWrObp4IHRSIZ++svoBoYWv7Pur57zxjZSNLd6aOf1h55VjUy4Wmq8UCxd4Pq1VnN3U0IP7qZfzN0QBHlAbnItwHfgsVz81ZxeZ35XZhUZG+jCYvnEdISGMaVWS+SgebEfDC7AqspCC7pwD9HYSJsI+8102ubf6rJabX9vRKgxqg0Hj7FIAcAJl19JqN3nmzUEGRcB12LbeHkuk4iKFVOlCeQVe1Z0UPddMz9bMHnkV/U/BuP4343MFB3ePje9Ww3LseWVGD6Lmamr+x5gJfOY+KRBG+RiTMWn8HyEdSw8m318f1aoR6PMQIDAQAB';

// Pages allowed to send records to SmartPaste: the PetWise app and its local dev server. The e2e build also admits
// the fixture's stand-in PetWise page.
const PETWISE_ORIGINS = ['https://petwise.vet/*', 'https://www.petwise.vet/*', 'https://app.petwise.vet/*', 'http://localhost:3000/*'];
const TEST_PETWISE_ORIGINS = process.env.SMARTPASTE_E2E ? ['http://127.0.0.1:4174/*'] : [];

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
        key: DEV_KEY,
        externally_connectable: { matches: [...PETWISE_ORIGINS, ...TEST_PETWISE_ORIGINS] },
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

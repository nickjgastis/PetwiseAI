import { defineConfig } from 'wxt';
import { KNOWN_PIMS_PATTERNS } from './platform/pimsSites.js';

// Fixes the unpacked extension id to fdaakcanieiagjadphmnblgicldefcfd on every machine, so the PetWise web app
// knows where to send records (REACT_APP_SMARTPASTE_EXTENSION_ID). Public key only; the Web Store assigns its own.
const DEV_KEY =
    'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAs8Umsb5PQkiTtZ1p6mwN6TlLcDrkOydoWrObp4IHRSIZ++svoBoYWv7Pur57zxjZSNLd6aOf1h55VjUy4Wmq8UCxd4Pq1VnN3U0IP7qZfzN0QBHlAbnItwHfgsVz81ZxeZ35XZhUZG+jCYvnEdISGMaVWS+SgebEfDC7AqspCC7pwD9HYSJsI+8102ubf6rJabX9vRKgxqg0Hj7FIAcAJl19JqN3nmzUEGRcB12LbeHkuk4iKFVOlCeQVe1Z0UPddMz9bMHnkV/U/BuP4343MFB3ePje9Ww3LseWVGD6Lmamr+x5gJfOY+KRBG+RiTMWn8HyEdSw8m318f1aoR6PMQIDAQAB';

// Pages allowed to send records to SmartPaste: the PetWise app and its local dev server. The e2e build also admits
// the fixture's stand-in PetWise page.
const PETWISE_ORIGINS = ['https://petwise.vet/*', 'https://www.petwise.vet/*', 'https://app.petwise.vet/*', 'http://localhost:3000/*'];
const TEST_PETWISE_ORIGINS = process.env.SMARTPASTE_E2E ? ['http://127.0.0.1:4174/*'] : [];

// `npm run zip:store`: the Chrome Web Store upload. No dev key (the store assigns the id), no local PetWise dev
// server, and no built-in mock PIMS.
const STORE = !!process.env.SMARTPASTE_STORE;
const isLocal = (pattern) => /^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(pattern);

export default defineConfig({
    modules: ['@wxt-dev/module-react'],
    imports: false,
    manifest: {
        name: 'PetWise SmartPaste',
        description: 'Paste PetWise records into the field you choose in your practice management software.',
        version: '1.0.0',
        // activeTab lets the popup see which site it was opened on. The install prompt names only the known cloud
        // practice software; any other site is added one at a time when the vet enables it.
        permissions: ['storage', 'activeTab', 'scripting'],
        host_permissions: KNOWN_PIMS_PATTERNS,
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
    hooks: {
        'build:manifestGenerated': (_wxt, manifest) => {
            if (!STORE) return;
            delete manifest.key;
            for (const script of manifest.content_scripts || []) script.matches = script.matches.filter((m) => !isLocal(m));
            manifest.externally_connectable.matches = manifest.externally_connectable.matches.filter((m) => !isLocal(m));
        },
    },
    vite: () => ({
        define: { __SMARTPASTE_STORE__: JSON.stringify(STORE) },
        server: {
            // Lets the content script import the PetWise Copy all formatter from ../src.
            fs: { allow: ['..'] },
        },
    }),
});

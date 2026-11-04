import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, chromium, expect } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
export const EXTENSION_PATH = path.resolve(here, '../../.output/chrome-mv3');
export const FIXTURE = 'http://127.0.0.1:4173';

// Fixed by the manifest `key` in wxt.config.js.
export const extensionId = () => 'fdaakcanieiagjadphmnblgicldefcfd';

// Stand-in for the PetWise web app: an origin the e2e build lists in externally_connectable.
export const PETWISE_ORIGIN = 'http://127.0.0.1:4174';

// Every test gets a fresh browser profile with the built extension loaded, so stored selections never leak between tests.
export const test = base.extend({
    context: async ({}, use) => {
        const context = await chromium.launchPersistentContext('', {
            channel: 'chromium',
            headless: !process.env.HEADED,
            viewport: { width: 1280, height: 900 },
            args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
        });
        await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: FIXTURE });
        await use(context);
        await context.close();
    },
    page: async ({ context }, use) => {
        const page = await context.newPage();
        await use(page);
    },
});

export { expect };

// Playwright's CSS engine pierces open shadow roots, so these reach inside the SmartPaste UI.
export const chipIn = (scope) => scope.locator('petwise-smartpaste [data-testid="smartpaste"]');
export const pasteButton = (scope, label) => chipIn(scope).getByRole('button', { name: `Paste ${label}`, exact: true });
export const settingsButton = (scope) => chipIn(scope).getByRole('button', { name: 'SmartPaste settings' });
export const menuIn = (scope) => chipIn(scope).getByRole('dialog', { name: 'SmartPaste settings' });

export const normalize = (text) => String(text).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

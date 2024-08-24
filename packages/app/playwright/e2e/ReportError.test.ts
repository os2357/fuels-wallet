import type { Browser, BrowserContext, Page } from '@playwright/test';
import test, { chromium, expect } from '@playwright/test';

import {
  getButtonByText,
  getByAriaLabel,
  hasText,
  reload,
  visit,
} from '../commons';
import { mockData } from '../mocks';

test.describe('ReportError', () => {
  let browser: Browser;
  let page: Page;
  let browserContext: BrowserContext;

  test.beforeAll(async () => {
    browser = await chromium.launch();
    browserContext = await browser.newContext();
    page = await browserContext.newPage();
    await mockData(page);
  });

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  async function getPageErrors(page: Page): Promise<any> {
    return await page.evaluate(async () => {
      const fuelDB = window.fuelDB;
      const errors = (await fuelDB?.errors?.toArray?.()) ?? [];
      return errors;
    });
  }

  test('should show Error page when there is a unhandled js error in React', async () => {
    await visit(page, '/');
    await page.evaluate(() => {
      window.testCrash();
    });

    await hasText(page, /Unexpected error/i);

    // get errors from indexedDB
    const errors = await getPageErrors(page);
    expect(errors.length).toBeGreaterThan(0);

    // report error
    await getByAriaLabel(page, 'Send error reports').click();
    await expect(page.getByText(/Unexpected error/)).toHaveCount(0);

    const errorsAfterReporting = await getPageErrors(page);
    expect(errorsAfterReporting.length).toBe(0);
  });

  test('should show floating error button when there is a error in the database', async () => {
    await visit(page, '/');
    await page.evaluate(async () => {
      await window.fuelDB.errors.clear();
      await window.fuelDB.errors.add({
        id: '12345',
        error: {
          name: 'React error',
          message: 'Test Error',
          stack: 'Line error 1',
        },
        extra: {
          timestamp: Date.now(),
          location: 'http://localhost:3000',
          pathname: '/',
          hash: '#',
          counts: 0,
        },
      });
    });

    await reload(page);
    const floatingButton = await page.waitForSelector(
      '[data-testid="ErrorFloatingButton"]',
      { state: 'visible' }
    );
    expect(floatingButton.isVisible).toBeTruthy();
  });

  test('should be able to ignore a error', async () => {
    await visit(page, '/');
    await page.evaluate(async () => {
      await window.fuelDB.errors.clear();
      await window.fuelDB.errors.add({
        id: '12345',
        error: {
          name: 'React error',
          message: 'Test Error',
          stack: 'Line error 1',
        },
        extra: {
          timestamp: Date.now(),
          location: 'http://localhost:3000',
          pathname: '/',
          hash: '#',
          counts: 0,
        },
      });
    });
    await reload(page);
    (
      await page.waitForSelector('[data-testid="ErrorFloatingButton"]', {
        state: 'visible',
      })
    ).click();
    await hasText(page, /Unexpected error/i);

    // report error
    await getByAriaLabel(page, 'Ignore error(s)').click();
    await expect(page.getByText(/Unexpected error/i)).toHaveCount(0);

    const errorsAfterReporting = await getPageErrors(page);
    expect(errorsAfterReporting.length).toBe(1);
  });
  test('should be able to dismiss all errors', async () => {
    await visit(page, '/');
    await page.evaluate(async () => {
      await window.fuelDB.errors.clear();
      await window.fuelDB.errors.add({
        id: '12345',
        error: {
          name: 'React error',
          message: 'Test Error',
          stack: 'Line error 1',
        },
        extra: {
          timestamp: Date.now(),
          location: 'http://localhost:3000',
          pathname: '/',
          hash: '#',
          counts: 0,
        },
      });
    });
    await reload(page);
    (
      await page.waitForSelector('[data-testid="ErrorFloatingButton"]', {
        state: 'visible',
      })
    ).click();
    await hasText(page, /Unexpected error/i);

    // report error
    await getByAriaLabel(
      page,
      'Ignore and dismiss all errors permanently'
    ).click();
    await expect(page.getByText(/Unexpected error/i)).toHaveCount(0);

    const errorsAfterReporting = await getPageErrors(page);
    expect(errorsAfterReporting.length).toBe(0);
  });
  test('should hide when the single error is dismissed', async () => {
    await visit(page, '/');
    await page.evaluate(async () => {
      await window.fuelDB.errors.clear();
      await window.fuelDB.errors.add({
        id: '12345',
        error: {
          name: 'React error',
          message: 'Test Error',
          stack: 'Line error 1',
        },
        extra: {
          timestamp: Date.now(),
          location: 'http://localhost:3000',
          pathname: '/',
          hash: '#',
          counts: 0,
        },
      });
    });
    await reload(page);
    (
      await page.waitForSelector('[data-testid="ErrorFloatingButton"]', {
        state: 'visible',
      })
    ).click();
    await hasText(page, /Unexpected error/i);

    // report error
    await getByAriaLabel(page, 'Dismiss error').click();
    await expect(page.getByText(/Unexpected error/i)).toHaveCount(0);

    const errorsAfterReporting = await getPageErrors(page);
    expect(errorsAfterReporting.length).toBe(0);
  });
  test('should detect and capture global errors', async () => {
    await visit(page, '/');
    await page.evaluate(async () => {
      await window.fuelDB.errors.clear();
      console.error(new Error('Test Error'));
    });
    await reload(page);
    (
      await page.waitForSelector('[data-testid="ErrorFloatingButton"]', {
        state: 'visible',
      })
    ).click();
    await hasText(page, /Unexpected error/i);

    const errorsAfterReporting = await getPageErrors(page);
    expect(errorsAfterReporting.length).toBe(1);
  });

  test('should deduplicate errors', async () => {
    await visit(page, '/');
    await page.evaluate(async () => {
      await window.fuelDB.errors.clear();
      await window.fuelDB.errors.add({
        id: '12345',
        error: {
          name: 'React error',
          message: 'Test Error',
          stack: 'Line error 1',
        },
        extra: {
          timestamp: Date.now(),
          location: 'http://localhost:3000',
          pathname: '/',
          hash: '#',
          counts: 0,
        },
      });
      await window.fuelDB.errors.add({
        id: '12345',
        error: {
          name: 'React error',
          message: 'Test Error',
          stack: 'Line error 1',
        },
        extra: {
          timestamp: Date.now(),
          location: 'http://localhost:3000',
          pathname: '/',
          hash: '#',
          counts: 0,
        },
      });
    });
    await reload(page);
    (
      await page.waitForSelector('[data-testid="ErrorFloatingButton"]', {
        state: 'visible',
      })
    ).click();
    await hasText(page, /Unexpected error/i);
    await reload(page);
    const errorsAfterReporting = await getPageErrors(page);
    expect(errorsAfterReporting.length).toBe(1);
  });
});

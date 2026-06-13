import { expect, type Page } from '@playwright/test';

export interface PageIssue {
	readonly type: 'pageerror' | 'console-error';
	readonly text: string;
}

export function trackPageIssues(page: Page): PageIssue[] {
	const issues: PageIssue[] = [];
	page.on('pageerror', (error) => {
		issues.push({
			type: 'pageerror',
			text: error.message,
		});
	});
	page.on('console', (message) => {
		if (message.type() !== 'error') {
			return;
		}
		issues.push({
			type: 'console-error',
			text: message.text(),
		});
	});
	return issues;
}

export async function expectNoPageIssues(issues: readonly PageIssue[]): Promise<void> {
	expect(issues, issues.map((issue) => issue.text).join('\n')).toEqual([]);
}

export async function openRoute(page: Page, route: string): Promise<void> {
	await page.goto(route);
}


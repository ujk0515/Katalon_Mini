export interface ProjectConfig {
  name: string;
  type: 'web' | 'mobile';
  version: string;
  createdAt: string;
  lastOpenedAt: string;
  browserConfig: BrowserConfig;
}

export interface BrowserConfig {
  browser: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  timeout: number;
  viewport: { width: number; height: number } | null;
}

export const DEFAULT_BROWSER_CONFIG: BrowserConfig = {
  browser: 'chromium',
  headless: false,
  timeout: 30000,
  viewport: null,
};

export interface FileTreeNode {
  id: string;
  name: string;
  type: 'folder' | 'testcase' | 'suite';
  path: string;
  children?: FileTreeNode[];
}

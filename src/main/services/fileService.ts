import * as fs from 'fs';
import * as path from 'path';
import type { ProjectConfig, FileTreeNode } from '../../shared/types/project';
import { DEFAULT_MOBILE_CONFIG } from '../../shared/types/mobile';

const PROJECT_FILE = 'qa-automation-tool.project.json';
const TEST_CASES_DIR = 'Test Cases';
const TEST_SUITES_DIR = 'Test Suites';
const REPORTS_DIR = 'Reports';
const PROFILES_DIR = 'Profiles';
const OBJECT_REPO_DIR = 'Object Repository';

export function createProject(
  projectPath: string,
  name: string,
  type: 'web' | 'mobile',
  defaultBrowserConfig: any
): ProjectConfig {
  // Create directories
  fs.mkdirSync(projectPath, { recursive: true });
  fs.mkdirSync(path.join(projectPath, TEST_CASES_DIR), { recursive: true });
  fs.mkdirSync(path.join(projectPath, TEST_SUITES_DIR), { recursive: true });
  fs.mkdirSync(path.join(projectPath, REPORTS_DIR), { recursive: true });
  fs.mkdirSync(path.join(projectPath, PROFILES_DIR), { recursive: true });

  // Create default profile for GlobalVariable support
  const defaultProfile = { name: 'default', variables: {} };
  fs.writeFileSync(
    path.join(projectPath, PROFILES_DIR, 'default.profile.json'),
    JSON.stringify(defaultProfile, null, 2),
    'utf-8',
  );

  // Create Object Repository for mobile projects
  if (type === 'mobile') {
    fs.mkdirSync(path.join(projectPath, OBJECT_REPO_DIR), { recursive: true });
  }

  const config: ProjectConfig = {
    name,
    type,
    version: '0.1.0',
    createdAt: new Date().toISOString(),
    lastOpenedAt: new Date().toISOString(),
    browserConfig: defaultBrowserConfig,
    ...(type === 'mobile' ? { mobileConfig: DEFAULT_MOBILE_CONFIG } : {}),
  };

  fs.writeFileSync(
    path.join(projectPath, PROJECT_FILE),
    JSON.stringify(config, null, 2),
    'utf-8'
  );

  return config;
}

export function openProject(projectPath: string): ProjectConfig {
  const configPath = path.join(projectPath, PROJECT_FILE);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Project file not found: ${configPath}`);
  }

  const config: ProjectConfig = JSON.parse(
    fs.readFileSync(configPath, 'utf-8')
  );

  // Update last opened
  config.lastOpenedAt = new Date().toISOString();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

  return config;
}

export function getFileTree(projectPath: string): FileTreeNode[] {
  const testCasesPath = path.join(projectPath, TEST_CASES_DIR);
  const testSuitesPath = path.join(projectPath, TEST_SUITES_DIR);
  const tcTree = fs.existsSync(testCasesPath) ? buildTree(testCasesPath, projectPath) : [];
  const suiteTree = fs.existsSync(testSuitesPath) ? buildSuiteTree(testSuitesPath, projectPath) : [];
  return [...tcTree, ...suiteTree];
}

function buildTree(dirPath: string, basePath: string): FileTreeNode[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const nodes: FileTreeNode[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      nodes.push({
        id: relativePath,
        name: entry.name,
        type: 'folder',
        path: relativePath,
        children: buildTree(fullPath, basePath),
      });
    } else if (entry.name.endsWith('.groovy')) {
      nodes.push({
        id: relativePath,
        name: entry.name,
        type: 'testcase',
        path: relativePath,
      });
    }
  }

  // Folders first, then files
  nodes.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'folder' ? -1 : 1;
  });

  return nodes;
}

function buildSuiteTree(dirPath: string, basePath: string): FileTreeNode[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const nodes: FileTreeNode[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      nodes.push({
        id: relativePath,
        name: entry.name,
        type: 'folder',
        path: relativePath,
        children: buildSuiteTree(fullPath, basePath),
      });
    } else if (entry.name.endsWith('.suite')) {
      nodes.push({
        id: relativePath,
        name: entry.name,
        type: 'suite',
        path: relativePath,
      });
    }
  }

  nodes.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'folder' ? -1 : 1;
  });

  return nodes;
}

export function createFile(
  projectPath: string,
  relativePath: string,
  isFolder: boolean
): void {
  const fullPath = path.join(projectPath, relativePath);

  if (fs.existsSync(fullPath)) {
    throw new Error(`Already exists: ${relativePath}`);
  }

  if (isFolder) {
    fs.mkdirSync(fullPath, { recursive: true });
  } else {
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    if (relativePath.endsWith('.suite')) {
      const defaultSuite = { name: path.basename(relativePath, '.suite'), testCases: [], stopOnFailure: false };
      fs.writeFileSync(fullPath, JSON.stringify(defaultSuite, null, 2), 'utf-8');
    } else {
      fs.writeFileSync(fullPath, '// New Test Case\n', 'utf-8');
    }
  }
}

export function readFile(projectPath: string, relativePath: string): string {
  const fullPath = path.join(projectPath, relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

export function writeFile(
  projectPath: string,
  relativePath: string,
  content: string
): void {
  const fullPath = path.join(projectPath, relativePath);
  fs.writeFileSync(fullPath, content, 'utf-8');
}

export function renameFile(
  projectPath: string,
  oldRelPath: string,
  newRelPath: string
): void {
  const oldFull = path.join(projectPath, oldRelPath);
  const newFull = path.join(projectPath, newRelPath);
  fs.renameSync(oldFull, newFull);
}

export function moveFile(
  projectPath: string,
  oldRelPath: string,
  newRelPath: string
): { success: boolean; error?: string } {
  const oldFull = path.join(projectPath, oldRelPath);
  const newFull = path.join(projectPath, newRelPath);

  if (!fs.existsSync(oldFull)) {
    return { success: false, error: '원본 파일을 찾을 수 없습니다.' };
  }
  if (fs.existsSync(newFull)) {
    return { success: false, error: '같은 이름의 파일이 이미 존재합니다.' };
  }

  // 대상 디렉토리 없으면 생성
  const newDir = path.dirname(newFull);
  fs.mkdirSync(newDir, { recursive: true });
  fs.renameSync(oldFull, newFull);
  return { success: true };
}

// ─── File Order ───
const FILE_ORDER_NAME = '.file-order.json';

export function getFileOrder(projectPath: string): Record<string, string[]> {
  try {
    const content = fs.readFileSync(path.join(projectPath, FILE_ORDER_NAME), 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export function setFileOrder(projectPath: string, order: Record<string, string[]>): void {
  fs.writeFileSync(path.join(projectPath, FILE_ORDER_NAME), JSON.stringify(order, null, 2), 'utf-8');
}

export function deleteFile(projectPath: string, relativePath: string): void {
  const fullPath = path.join(projectPath, relativePath);
  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    fs.rmSync(fullPath, { recursive: true });
  } else {
    fs.unlinkSync(fullPath);
  }
}

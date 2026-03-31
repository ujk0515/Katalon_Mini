/**
 * Preprocessor: Extracts only WebUI.xxx() calls and comments from raw Katalon Groovy scripts.
 * Handles Katalon TestObject patterns: def varName = new TestObject(...) + addProperty(...)
 * by inlining the extracted selector directly into WebUI calls.
 * All other lines (import, def, new, Selenium API, etc.) are silently skipped.
 */

export interface PreprocessResult {
  cleanScript: string;
  skippedLines: number;
  totalLines: number;
  lineMapping: Map<number, number>; // cleanScript line → original line
  isGroovyMode: boolean;
}

/** Detect if script contains Groovy code beyond simple WebUI calls */
export function hasGroovyCode(script: string): boolean {
  const lines = script.split(/\r?\n/);
  return lines.some(l => {
    const t = l.trim();
    // Skip comment lines and empty lines
    if (t === '' || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
    return (
      /^(def |if\s*\(|for\s*\(|while\s*\(|try\s*\{|new |import )/.test(t) ||
      /^\w+\.\w+\s*=\s*/.test(t) ||
      /^\w+\s*=\s*/.test(t) ||
      /\.addProperty\s*\(/.test(t) ||
      /\.findAll\s*\{/.test(t) ||
      /\.each\s*\{/.test(t) ||
      /KeywordUtil\./.test(t) ||
      /DriverFactory\./.test(t) ||
      /WebUiCommonHelper\./.test(t) ||
      /Mobile\./.test(t) ||
      /CustomKeywords\./.test(t)
    );
  });
}

/** Strip only import lines, keep everything else (for Groovy mode) */
export function stripImports(rawScript: string): PreprocessResult {
  const lines = rawScript.split(/\r?\n/);
  const kept = lines.filter(l => !l.trim().startsWith('import '));
  const cleanScript = kept.join('\n').replace(/^\n+/, '');
  return {
    cleanScript,
    skippedLines: lines.length - kept.length,
    totalLines: lines.length,
    lineMapping: new Map(),
    isGroovyMode: true,
  };
}

/** Extract TestObject variable definitions and their selectors from script */
function extractTestObjectMap(lines: string[]): Map<string, string> {
  const varMap = new Map<string, string>(); // varName → selector

  for (const line of lines) {
    const trimmed = line.trim();

    // Match: def varName = new TestObject(...)
    // Also: TestObject varName = new TestObject(...)
    const defMatch = trimmed.match(
      /^(?:def|TestObject)\s+(\w+)\s*=\s*new\s+TestObject\s*\(/
    );
    if (defMatch) {
      varMap.set(defMatch[1], '');
    }

    // Match: varName.addProperty('xpath', ConditionType.EQUALS, "value")
    // Also: varName.addProperty("xpath", ConditionType.EQUALS, 'value')
    // Also: varName.addProperty('css', ConditionType.EQUALS, "value")
    // Also: varName.addProperty("tag", ConditionType.EQUALS, "value")
    const propMatch = trimmed.match(
      /^(\w+)\.addProperty\s*\(\s*['"](\w+)['"]\s*,\s*ConditionType\.\w+\s*,\s*(['"])(.*?)\3\s*(?:,\s*\w+)?\s*\)/
    );
    if (propMatch) {
      const [, varName, propType, , propValue] = propMatch;
      if (varMap.has(varName)) {
        const selectorType = propType.toLowerCase();
        if (selectorType === 'xpath') {
          varMap.set(varName, propValue);
        } else if (selectorType === 'css') {
          varMap.set(varName, `css=${propValue}`);
        } else if (selectorType === 'id') {
          varMap.set(varName, `#${propValue}`);
        } else if (selectorType === 'name') {
          varMap.set(varName, `[name="${propValue}"]`);
        } else if (selectorType === 'class') {
          varMap.set(varName, `.${propValue}`);
        } else {
          // fallback: use xpath-like
          varMap.set(varName, propValue);
        }
      }
    }
  }

  return varMap;
}

/** Replace bare variable references in a WebUI line with findTestObject('selector') */
function inlineTestObjects(line: string, varMap: Map<string, string>): string {
  if (varMap.size === 0) return line;

  // Replace each known variable name used as argument in WebUI calls
  // Match patterns like: WebUI.click(varName) or WebUI.setText(varName, "text")
  // We need to replace varName with findTestObject('selector')
  let result = line;

  for (const [varName, selector] of varMap) {
    if (!selector || !result.includes(varName)) continue;

    // Replace variable references that appear as function arguments
    // Match: (varName) or (varName, or , varName) or , varName,
    // But NOT inside strings or as part of longer identifiers
    const pattern = new RegExp(
      `(?<=[,(]\\s*)${escapeRegExp(varName)}(?=\\s*[,)])`,
      'g'
    );
    const escapedSelector = selector.replace(/'/g, "\\'");
    result = result.replace(pattern, `findTestObject('${escapedSelector}')`);
  }

  return result;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function preprocessScript(rawScript: string): PreprocessResult {
  const lines = rawScript.split(/\r?\n/);
  const kept: string[] = [];
  const lineMapping = new Map<number, number>();
  let skippedLines = 0;
  let cleanLineNum = 0;

  // First pass: extract TestObject variable → selector mappings
  const varMap = extractTestObjectMap(lines);

  // Track multiline WebUI calls
  let multilineBuffer: string | null = null;
  let multilineStartOriginal = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Continue multiline WebUI call
    if (multilineBuffer !== null) {
      multilineBuffer += ' ' + trimmed;
      if (hasBalancedParens(multilineBuffer)) {
        cleanLineNum++;
        lineMapping.set(cleanLineNum, multilineStartOriginal + 1);
        kept.push(inlineTestObjects(multilineBuffer, varMap));
        multilineBuffer = null;
      }
      continue;
    }

    // Empty line → keep (preserves readability)
    if (trimmed === '') {
      cleanLineNum++;
      lineMapping.set(cleanLineNum, i + 1);
      kept.push('');
      continue;
    }

    // Comment line → keep
    if (trimmed.startsWith('//')) {
      cleanLineNum++;
      lineMapping.set(cleanLineNum, i + 1);
      kept.push(line);
      continue;
    }

    // WebUI.xxx(...) line → keep (with variable inlining)
    if (/^\s*WebUI\./.test(line)) {
      if (hasBalancedParens(trimmed)) {
        cleanLineNum++;
        lineMapping.set(cleanLineNum, i + 1);
        kept.push(inlineTestObjects(line, varMap));
      } else {
        // Start multiline buffer
        multilineBuffer = trimmed;
        multilineStartOriginal = i;
      }
      continue;
    }

    // Everything else → skip
    skippedLines++;
  }

  // Flush unclosed multiline buffer (will likely cause parse error, but that's correct)
  if (multilineBuffer !== null) {
    cleanLineNum++;
    lineMapping.set(cleanLineNum, multilineStartOriginal + 1);
    kept.push(inlineTestObjects(multilineBuffer, varMap));
  }

  return {
    cleanScript: kept.join('\n'),
    skippedLines,
    totalLines: lines.length,
    lineMapping,
    isGroovyMode: false,
  };
}

/** Check if parentheses are balanced in a string */
function hasBalancedParens(s: string): boolean {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const prev = i > 0 ? s[i - 1] : '';

    if (ch === "'" && !inDoubleQuote && prev !== '\\') {
      inSingleQuote = !inSingleQuote;
    } else if (ch === '"' && !inSingleQuote && prev !== '\\') {
      inDoubleQuote = !inDoubleQuote;
    } else if (!inSingleQuote && !inDoubleQuote) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
    }
  }

  return depth <= 0;
}

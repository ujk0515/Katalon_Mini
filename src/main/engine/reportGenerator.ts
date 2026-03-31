import * as fs from 'fs';
import * as path from 'path';
import type { SuiteResult, TestCaseResult } from '../../shared/types/suite';

export async function generateReport(result: SuiteResult, projectPath: string): Promise<string> {
  const now = new Date();
  const fileName = formatDate(now) + '.html';
  const reportDir = path.join(projectPath, 'Reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, fileName);

  const html = buildReportHtml(result);
  fs.writeFileSync(reportPath, html, 'utf-8');

  return path.relative(projectPath, reportPath);
}

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function buildReportHtml(result: SuiteResult): string {
  const passRate = result.statistics.total > 0
    ? Math.round((result.statistics.passed / result.statistics.total) * 100) : 0;
  const statusLabel = result.status === 'pass' ? '성공' : '실패';
  const statusColor = result.status === 'pass' ? '#22c55e' : '#ef4444';
  const durationSec = (result.duration / 1000).toFixed(1);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>테스트 스위트 리포트 - ${escHtml(result.suiteName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', -apple-system, sans-serif; background: #1a1a2e; color: #e0e0e0; padding: 24px; }
  .container { max-width: 960px; margin: 0 auto; }
  .header { background: #16213e; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
  .header h1 { font-size: 20px; margin-bottom: 12px; }
  .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px; }
  .header-grid .label { color: #8892b0; }
  .status-badge { display: inline-block; padding: 4px 12px; border-radius: 6px; font-weight: 600; font-size: 14px; color: white; background: ${statusColor}; }
  .stats { background: #16213e; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
  .stats-row { display: flex; gap: 24px; margin-bottom: 12px; font-size: 14px; }
  .stats-num { font-size: 24px; font-weight: 700; }
  .stats-num.pass { color: #22c55e; }
  .stats-num.fail { color: #ef4444; }
  .stats-num.skip { color: #f59e0b; }
  .progress { height: 8px; background: #2d2d44; border-radius: 4px; overflow: hidden; }
  .progress-bar { height: 100%; background: #22c55e; border-radius: 4px; transition: width 0.3s; }
  .context { background: #16213e; border-radius: 12px; padding: 16px; margin-bottom: 16px; font-size: 13px; }
  .context-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .context-grid .label { color: #8892b0; font-size: 12px; }
  .tc-list { margin-top: 16px; }
  .tc-card { background: #16213e; border-radius: 8px; margin-bottom: 8px; overflow: hidden; }
  .tc-header { display: flex; align-items: center; padding: 12px 16px; cursor: pointer; gap: 12px; }
  .tc-header:hover { background: #1a2744; }
  .tc-icon { font-size: 16px; }
  .tc-name { flex: 1; font-size: 14px; font-weight: 500; }
  .tc-duration { font-size: 13px; color: #8892b0; }
  .tc-status { padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; color: white; }
  .tc-status.pass { background: #22c55e; }
  .tc-status.fail, .tc-status.error { background: #ef4444; }
  .tc-status.skipped { background: #f59e0b; color: #1a1a2e; }
  .tc-details { display: none; padding: 0 16px 12px; }
  .tc-details.open { display: block; }
  .step-table { width: 100%; font-size: 13px; border-collapse: collapse; table-layout: fixed; }
  .step-table th { text-align: left; padding: 6px 8px; color: #8892b0; border-bottom: 1px solid #2d2d44; white-space: nowrap; }
  .step-table th:nth-child(1) { width: 40px; }
  .step-table th:nth-child(2) { width: auto; }
  .step-table th:nth-child(3) { width: 50px; }
  .step-table th:nth-child(4) { width: 50px; }
  .step-table td { padding: 6px 8px; border-bottom: 1px solid #2d2d44; vertical-align: top; }
  .step-table td:nth-child(2) { word-break: break-all; overflow-wrap: anywhere; }
  .step-table td:nth-child(3), .step-table td:nth-child(4) { white-space: nowrap; }
  .step-pass { color: #22c55e; }
  .step-fail { color: #ef4444; }
  .error-box { margin-top: 8px; padding: 8px 12px; background: #2d1b1b; border-left: 3px solid #ef4444; border-radius: 4px; font-size: 13px; color: #ef4444; white-space: pre-wrap; word-break: break-all; }
  .footer { text-align: center; padding: 16px; color: #8892b0; font-size: 12px; }
  .toggle { width: 16px; transition: transform 0.2s; display: inline-block; }
  .toggle.open { transform: rotate(90deg); }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>${escHtml(result.suiteName)}</h1>
    <div class="header-grid">
      <div><span class="label">실행 결과: </span><span class="status-badge">${statusLabel}</span></div>
      <div><span class="label">소요 시간: </span>${durationSec}초</div>
      <div><span class="label">시작: </span>${formatKoreanTime(result.startedAt)}</div>
      <div><span class="label">종료: </span>${formatKoreanTime(result.completedAt)}</div>
    </div>
  </div>

  <div class="stats">
    <div class="stats-row">
      <div><div class="label">전체</div><div class="stats-num">${result.statistics.total}</div></div>
      <div><div class="label">성공</div><div class="stats-num pass">${result.statistics.passed}</div></div>
      <div><div class="label">실패</div><div class="stats-num fail">${result.statistics.failed}</div></div>
      <div><div class="label">스킵</div><div class="stats-num skip">${result.statistics.skipped}</div></div>
      <div><div class="label">성공률</div><div class="stats-num">${passRate}%</div></div>
    </div>
    <div class="progress"><div class="progress-bar" style="width:${passRate}%"></div></div>
  </div>

  <div class="context">
    <div class="context-grid">
      <div><div class="label">호스트</div>${escHtml(result.context.hostName)}</div>
      <div><div class="label">OS</div>${escHtml(result.context.os)}</div>
      ${result.context.browser ? `
      <div><div class="label">브라우저</div>${escHtml(result.context.browser)}</div>
      <div><div class="label">뷰포트</div>${escHtml(result.context.viewport || '')}</div>
      ` : `
      <div><div class="label">기기</div>${escHtml(result.context.device || '')}</div>
      <div><div class="label">Android</div>${escHtml(result.context.platformVersion || '')}</div>
      <div><div class="label">앱</div>${escHtml(result.context.appPackage || '')}</div>
      `}
    </div>
  </div>

  <div class="tc-list">
    <h2 style="font-size:16px;margin-bottom:12px">테스트케이스 상세</h2>
${result.testCaseResults.map((tc, i) => buildTcCard(tc, i)).join('\n')}
  </div>

  <div class="footer">QA Automation Tool - 테스트 스위트 리포트</div>
</div>
<script>
document.querySelectorAll('.tc-header').forEach(h => {
  h.addEventListener('click', () => {
    const details = h.nextElementSibling;
    const toggle = h.querySelector('.toggle');
    details.classList.toggle('open');
    toggle.classList.toggle('open');
  });
});
</script>
</body>
</html>`;
}

function buildTcCard(tc: TestCaseResult, _index: number): string {
  const icon = tc.status === 'pass' ? '\u2705' : tc.status === 'skipped' ? '\u23ED\uFE0F' : '\u274C';
  const durationSec = (tc.duration / 1000).toFixed(1);
  const statusText = tc.status === 'pass' ? '성공' : tc.status === 'skipped' ? '스킵' : '실패';
  const stepsHtml = tc.steps.length > 0 ? `
    <table class="step-table">
      <thead><tr><th>#</th><th>명령</th><th>상태</th><th>시간</th></tr></thead>
      <tbody>
${tc.steps.map((s, si) => `        <tr>
          <td>${si + 1}</td>
          <td>${escHtml(s.command)}</td>
          <td class="step-${s.status === 'pass' ? 'pass' : 'fail'}">${s.status === 'pass' ? '성공' : '실패'}</td>
          <td>${(s.duration / 1000).toFixed(1)}초</td>
        </tr>${s.error ? `\n        <tr><td colspan="4"><div class="error-box">${escHtml(s.error)}</div></td></tr>` : ''}`).join('\n')}
      </tbody>
    </table>` : '<div style="color:#8892b0;font-size:13px">실행된 스텝 없음</div>';

  return `    <div class="tc-card">
      <div class="tc-header">
        <span class="toggle">\u25B6</span>
        <span class="tc-icon">${icon}</span>
        <span class="tc-name">${escHtml(tc.name)}</span>
        <span class="tc-duration">${durationSec}초</span>
        <span class="tc-status ${tc.status}">${statusText}</span>
      </div>
      <div class="tc-details">${stepsHtml}${tc.error ? `<div class="error-box">${escHtml(tc.error)}</div>` : ''}</div>
    </div>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatKoreanTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

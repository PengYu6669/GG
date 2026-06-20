"use strict";

const { execFile } = require("child_process");

const WINDOWS_FOREGROUND_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class FocusPetWin32 {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", SetLastError=true)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@;
$h = [FocusPetWin32]::GetForegroundWindow();
$title = New-Object Text.StringBuilder 512;
[void][FocusPetWin32]::GetWindowText($h, $title, $title.Capacity);
$pidNum = 0;
[void][FocusPetWin32]::GetWindowThreadProcessId($h, [ref]$pidNum);
$p = Get-Process -Id $pidNum -ErrorAction SilentlyContinue;
[pscustomobject]@{
  app = if ($p) { $p.ProcessName } else { "" };
  title = $title.ToString();
  pid = $pidNum;
  path = if ($p) { $p.Path } else { "" }
} | ConvertTo-Json -Compress
`;

const WINDOWS_BROWSER_URL_SCRIPT = `
param([int]$TargetPid)
Add-Type -AssemblyName UIAutomationClient -ErrorAction SilentlyContinue | Out-Null
try {
  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $cond = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ProcessIdProperty,
    $TargetPid
  )
  $win = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)
  if (-not $win) { return "" }
  $editCond = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Edit
  )
  $edits = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, $editCond)
  foreach ($edit in $edits) {
    $name = $edit.Current.Name
    $valuePattern = $null
    if ($edit.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$valuePattern)) {
      $value = $valuePattern.Current.Value
      if ($value -match '^(https?://|chrome://|edge://|file://|localhost|127\\.0\\.0\\.1)') { return $value }
      if ($name -match 'address|地址|搜索|网址' -and $value -match '[\\w.-]+\\.[a-zA-Z]{2,}') { return $value }
    }
  }
  return ""
} catch {
  return ""
}
`;

const MAC_FOREGROUND_SCRIPT = `
use framework "Foundation"
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set appName to name of frontApp
  set winTitle to ""
  set appPid to unix id of frontApp
  try
    set winTitle to name of front window of frontApp
  end try
end tell
set currentUrl to ""
try
  if appName is "Google Chrome" then
    tell application "Google Chrome" to set currentUrl to URL of active tab of front window
  else if appName is "Microsoft Edge" then
    tell application "Microsoft Edge" to set currentUrl to URL of active tab of front window
  else if appName is "Safari" then
    tell application "Safari" to set currentUrl to URL of front document
  end if
end try
set payload to current application's NSDictionary's dictionaryWithDictionary:{app:appName, title:winTitle, pid:appPid, path:"", url:currentUrl}
set jsonData to current application's NSJSONSerialization's dataWithJSONObject:payload options:0 |error|:(missing value)
set jsonText to current application's NSString's alloc()'s initWithData:jsonData encoding:(current application's NSUTF8StringEncoding)
return jsonText as text
`;

function runCommand(command, args) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: 2500, windowsHide: true }, (error, stdout) => {
      if (error || !stdout) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        resolve(null);
      }
    });
  });
}

async function getForegroundApp() {
  const platform = process.platform;
  let raw = null;

  if (platform === "win32") {
    raw = await runCommand("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      WINDOWS_FOREGROUND_SCRIPT,
    ]);
    if (raw && isBrowserApp(raw.app)) {
      const url = await runTextCommand("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        WINDOWS_BROWSER_URL_SCRIPT,
        "-TargetPid",
        String(raw.pid || 0),
      ]);
      if (url) raw.url = url;
    }
  } else if (platform === "darwin") {
    raw = await runCommand("osascript", ["-e", MAC_FOREGROUND_SCRIPT]);
  }

  if (!raw) {
    return {
      app: "unknown",
      title: "",
      pid: 0,
      path: "",
      platform,
      timestamp: Date.now(),
    };
  }

  return {
    app: String(raw.app || "unknown"),
    title: String(raw.title || ""),
    pid: Number(raw.pid || 0),
    path: String(raw.path || ""),
    url: normalizeUrl(String(raw.url || "")),
    domain: domainFromUrl(String(raw.url || "")),
    context: inferContext({
      app: String(raw.app || "unknown"),
      title: String(raw.title || ""),
      path: String(raw.path || ""),
      url: String(raw.url || ""),
    }),
    platform,
    timestamp: Date.now(),
  };
}

function runTextCommand(command, args) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: 2500, windowsHide: true }, (error, stdout) => {
      if (error || !stdout) {
        resolve("");
        return;
      }
      resolve(String(stdout).trim());
    });
  });
}

function isBrowserApp(app) {
  const normalized = String(app || "").toLowerCase();
  return ["chrome", "msedge", "edge", "safari", "firefox", "brave"].some(name => normalized.includes(name));
}

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(https?:|chrome:|edge:|file:)/i.test(raw)) return raw;
  if (/^(localhost|127\\.0\\.0\\.1)/i.test(raw)) return `http://${raw}`;
  if (/^[\\w.-]+\\.[a-zA-Z]{2,}/.test(raw)) return `https://${raw}`;
  return "";
}

function domainFromUrl(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) return "";
  try {
    return new URL(normalized).hostname.replace(/^www\\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function inferContext(info) {
  const app = String(info.app || "").toLowerCase();
  const title = String(info.title || "").toLowerCase();
  const url = normalizeUrl(info.url || "");
  const domain = domainFromUrl(url);
  const haystack = `${app} ${title} ${url} ${domain}`;

  if (isBrowserApp(app)) {
    return { kind: "browser", active: true, summary: domain || title || "Browser" };
  }
  if (/(code|cursor|visual studio code)/.test(app)) {
    const workspace = String(info.title || "").split(" - ").pop() || "workspace";
    return { kind: "editor", active: true, summary: workspace };
  }
  if (/(claude|doubao|豆包|kimi|moonshot|chatgpt|openai)/.test(haystack)) {
    return { kind: "ai", active: true, summary: String(info.title || info.app || "AI assistant") };
  }
  if (/(powershell|terminal|iterm|cmd|bash|zsh|node)/.test(app)) {
    return { kind: "terminal", active: true, summary: String(info.title || info.app || "terminal") };
  }
  if (/(localhost|127\\.0\\.0\\.1|vite|webpack|next\\.js|electron)/.test(haystack)) {
    return { kind: "dev-server", active: true, summary: domain || "local dev" };
  }
  return { kind: "generic", active: false, summary: String(info.title || info.app || "unknown") };
}

function startAppMonitor(getWindow, intervalMs = 3000) {
  let timer = null;
  let busy = false;

  const tick = async () => {
    const win = getWindow();
    if (!win || win.isDestroyed() || busy) return;
    busy = true;
    try {
      const info = await getForegroundApp();
      const appName = String(info.app || "").toLowerCase();
      const appPath = String(info.path || "").toLowerCase();
      if (appName.includes("focuspet") || appPath.includes("focuspet-desktop")) return;
      win.webContents.send("foreground-app", info);
    } finally {
      busy = false;
    }
  };

  timer = setInterval(tick, intervalMs);
  tick();

  return () => {
    if (timer) clearInterval(timer);
  };
}

module.exports = { getForegroundApp, startAppMonitor };

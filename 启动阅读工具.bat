@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo 未检测到 Node.js，请先安装 Node.js 后再运行本工具：https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules (
  echo 首次运行，正在安装依赖，请稍候...
  call npm install
  if errorlevel 1 (
    echo 依赖安装失败，请检查网络连接。
    pause
    exit /b 1
  )
)

start "本地阅读工具 - 关闭此窗口即可停止服务" cmd /k node server\index.js
ping -n 3 127.0.0.1 >nul
start "" http://localhost:3000

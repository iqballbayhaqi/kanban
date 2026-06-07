@echo off
echo ========================================
echo   Kanban App - Starting servers...
echo ========================================

echo.
echo [1/2] Starting Backend (port 3001)...
start "Kanban Backend" cmd /k "cd /d D:\workspace\kanban\backend && npm install && npm start"

echo.
echo [2/2] Starting Frontend (port 5173)...
timeout /t 3 /nobreak >nul
start "Kanban Frontend" cmd /k "cd /d D:\workspace\kanban\frontend && npm install && npm run dev"

echo.
echo ========================================
echo   App will be available at:
echo   http://localhost:5173
echo.
echo   Login credentials:
echo   Email   : baihaqiiqbal323@gmail.com
echo   Password: iqbal110900
echo ========================================
pause

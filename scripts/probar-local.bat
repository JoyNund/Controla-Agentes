@echo off
chcp 65001 >nul
echo Deteniendo procesos en puertos 3847 y 3848...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3847') do taskkill /PID %%a /F 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3848') do taskkill /PID %%a /F 2>nul
timeout /t 2 /nobreak >nul
echo.
echo Construyendo la web (solo la primera vez)...
call npm run deploy:build
echo.
echo Iniciando servidor en http://localhost:3847
echo Usuario: admin@controla.digital  ^|  Contraseña: la de APP_PASSWORD en .env
echo.
node server/index.js

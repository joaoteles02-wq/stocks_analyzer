@echo off
title Stocks Analyzer
cd /d "%~dp0"

echo ============================================
echo      Stocks Analyzer - Iniciando...
echo ============================================
echo.

:: Start the server
start "Stocks Analyzer" cmd /k "npm run dev"
timeout /t 4 /nobreak >nul

:: Get IP
for /f %%i in ('powershell -c "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -eq 'Dhcp' } | Select-Object -First 1).IPAddress"') do set IP=%%i

echo.
echo ============================================
echo  Servidor rodando!
echo.
echo  Link unico (celular e PC):
echo  http://%IP%:3000
echo.
echo  Salve esse link como favorito!
echo ============================================
echo.

start http://%IP%:3000

echo.
echo Pressione qualquer tecla para parar...
pause >nul
taskkill /f /fi "WindowTitle eq Stocks Analyzer" >nul 2>&1

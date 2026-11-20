@echo off
REM Build the FrancMap Windows desktop app -> release\FrancMap-<version>-Windows.zip
cd /d "%~dp0"
call npm install || goto :error
call npm run desktop:win || goto :error
echo.
echo Done. The app is in the release folder:
explorer release
goto :eof
:error
echo Build failed.
pause

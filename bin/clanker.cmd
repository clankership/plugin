@echo off
setlocal
rem Forwards to the standalone Clanker CLI installed by install.ps1.
set "CLI=%LOCALAPPDATA%\Clanker\bin\clanker.cmd"
if exist "%CLI%" (
  call "%CLI%" %*
  exit /b %ERRORLEVEL%
)
set /p SITE=<"%~dp0..\site.txt"
echo The Clanker CLI isn't installed. Install it with: irm %SITE%/install.ps1 ^| iex 1>&2
exit /b 127

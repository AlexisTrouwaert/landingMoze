@echo off
rem Wrapper historique (cf. MozePlace-front) : la logique vit dans scripts\sync-remotes.mjs.
rem Usage : push-both.bat "message de commit"
node "%~dp0scripts\sync-remotes.mjs" push %*
exit /b %errorlevel%

@echo off
echo Finding your computer's IP address...
ipconfig | findstr "IPv4"
pause

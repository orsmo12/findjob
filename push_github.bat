@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==== %date% %time% ==== > push_log.txt
where git >> push_log.txt 2>&1
git remote get-url origin >nul 2>&1 || git remote add origin https://github.com/orsmo12/findjob.git
git push -u origin --all >> push_log.txt 2>&1
git push origin --tags >> push_log.txt 2>&1
echo ==== DONE ==== >> push_log.txt

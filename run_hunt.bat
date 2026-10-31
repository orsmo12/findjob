@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PYTHONIOENCODING=utf-8
echo ==== %date% %time% ==== > hunt_log.txt
where python >> hunt_log.txt 2>&1
python --version >> hunt_log.txt 2>&1
python -m pip install -q python-jobspy groq python-dotenv httpx >> hunt_log.txt 2>&1
python scripts\run_hunt.py --test >> hunt_log.txt 2>&1
echo ==== DONE ==== >> hunt_log.txt

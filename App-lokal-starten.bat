@echo off
rem Startet die Web-App "Greenprint" lokal auf diesem Rechner.
rem Dieses Fenster offen lassen, solange die App benutzt wird. Zum Beenden: Fenster schliessen.
cd /d "%~dp0app"
echo.
echo  Greenprint laeuft unter  http://localhost:8765
echo  Dieses Fenster offen lassen. Zum Beenden einfach schliessen.
echo.
start "" http://localhost:8765
python -m http.server 8765 --bind 127.0.0.1
pause

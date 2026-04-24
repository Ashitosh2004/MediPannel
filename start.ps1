# ─── MedPanel Pro — Start All Services ───────────────────────────────────────
# Run this from the project root: .\start.ps1

Write-Host "`n🚀 Starting MedPanel Pro..." -ForegroundColor Cyan

# Start backend in new PowerShell window
Write-Host "▶  Starting Backend (FastAPI + Uvicorn)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\backend'; python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload"

# Give backend a moment to boot
Start-Sleep -Seconds 2

# Start frontend in new PowerShell window
Write-Host "▶  Starting Frontend (Vite)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot'; npm run dev"

Write-Host "`n✅ Both services started in separate windows." -ForegroundColor Cyan
Write-Host "   Backend : http://localhost:8000" -ForegroundColor White
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "   Ngrok   : https://catnap-employed-causal.ngrok-free.dev`n" -ForegroundColor White

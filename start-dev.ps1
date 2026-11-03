param($NoExit = $true)
Write-Host "Starting TUSOME dev server..."
& cmd /c "cd C:\Users\brian\Videos\TUSOME && npm run dev" 2>&1 | Write-Host
if ($NoExit) { Start-Sleep -Seconds 3600 }
# Kill node processes and remove .next
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Remove-Item -Recurse -Force "D:\Shared\New folder\Pharma_DNA_saga_2025\.next" -ErrorAction SilentlyContinue
Write-Host "Done"

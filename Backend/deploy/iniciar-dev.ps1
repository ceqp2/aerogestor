# Inicia o ambiente de desenvolvimento do AEROGEST GSD (Windows / PowerShell).
# Uso: powershell -ExecutionPolicy Bypass -File Backend\deploy\iniciar-dev.ps1
$ErrorActionPreference = 'Stop'
$backend = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path (Split-Path -Parent $backend) 'Frontend'

if (-not (Test-Path (Join-Path $backend '.env'))) { throw "Crie Backend\.env a partir de .env.example antes de iniciar." }

Write-Host '1/4 Banco PostgreSQL (Docker)...'
docker compose -f (Join-Path $backend 'deploy\docker-compose.dev.yml') --env-file (Join-Path $backend '.env') up -d

Write-Host '2/4 Migrations...'
Push-Location $backend
if (-not (Test-Path 'node_modules')) { npm ci }
npx prisma migrate deploy
if (-not (Test-Path 'dist\main.js')) { npx nest build }
Pop-Location

Write-Host '3/4 API em http://localhost:3000 ...'
Start-Process -WorkingDirectory $backend -FilePath 'node' -ArgumentList 'dist\main.js' -WindowStyle Minimized

Write-Host '4/4 Interface em http://localhost:5173 ...'
Push-Location $frontend
if (-not (Test-Path 'node_modules')) { npm ci }
Pop-Location
Start-Process -WorkingDirectory $frontend -FilePath 'npx.cmd' -ArgumentList 'vite' -WindowStyle Minimized

Write-Host ''
Write-Host 'Pronto. Acesse http://localhost:5173'
Write-Host "Credenciais demonstrativas: $backend\.local\credenciais-demo.txt (gere com: npm run db:seed)"

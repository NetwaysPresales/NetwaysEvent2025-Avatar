param(
    [string]$ResourceGroup = "rg-netways-avatar-dev",
    [string]$AppName = "app-ntw-avatar-ade1b8"
)

$ErrorActionPreference = "Stop"

Write-Host "Starting deployment to Azure Web App..." -ForegroundColor Cyan

Write-Host "Building standalone Next.js artifact..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    throw "Next.js build failed."
}

$stagingPath = ".deployment"
if (Test-Path $stagingPath) {
    Remove-Item $stagingPath -Recurse -Force
}

New-Item -ItemType Directory -Path $stagingPath | Out-Null
Copy-Item ".next/standalone/*" $stagingPath -Recurse -Force
New-Item -ItemType Directory -Path "$stagingPath/.next" -Force | Out-Null
Copy-Item ".next/static" "$stagingPath/.next/static" -Recurse -Force
Copy-Item "public" "$stagingPath/public" -Recurse -Force

# Remove existing zip if present
if (Test-Path "deploy.zip") {
    Remove-Item "deploy.zip" -Force
}

# Create zip (PowerShell 5.1+)
Compress-Archive -Path "$stagingPath/*" -DestinationPath deploy.zip -Force
Remove-Item $stagingPath -Recurse -Force

Write-Host "Deployment package created" -ForegroundColor Green

# Step 3: Deploy to Azure
Write-Host "Deploying to Azure..." -ForegroundColor Yellow
az webapp deploy `
    --resource-group $ResourceGroup `
    --name $AppName `
    --src-path deploy.zip `
    --type zip `
    --async true

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment accepted. App Service will restart when extraction completes." -ForegroundColor Green
    Write-Host "Application URL: https://$AppName.azurewebsites.net" -ForegroundColor Cyan
} else {
    Write-Host "Deployment failed." -ForegroundColor Red
    exit 1
}


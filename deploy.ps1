# Azure Web App Deployment Script
# Replace the variables below with your actual values

$resourceGroup = "Avatar-RG"  # Replace with your resource group
$appName = "avatar-web-app"                    # Replace with your app name

Write-Host "🚀 Starting deployment to Azure Web App..." -ForegroundColor Cyan

# Step 1: Create deployment package (source + config only)
Write-Host "📦 Creating deployment package (source only, no node_modules)..." -ForegroundColor Yellow

# Include only app source and config. App Service startup command will run npm install/build.
$filesToInclude = @(
    "src",
    "public",
    "prisma",
    "prisma.config.js",
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "tsconfig.json",
    "postcss.config.mjs",
    "eslint.config.mjs",
    "middleware.ts"
)

# Remove existing zip if present
if (Test-Path "deploy.zip") {
    Remove-Item "deploy.zip" -Force
}

# Create zip (PowerShell 5.1+)
Compress-Archive -Path $filesToInclude -DestinationPath deploy.zip -Force

Write-Host "✅ Deployment package created" -ForegroundColor Green

# Step 3: Deploy to Azure
Write-Host "🚀 Deploying to Azure..." -ForegroundColor Yellow
az webapp deployment source config-zip `
    --resource-group $resourceGroup `
    --name $appName `
    --src deploy.zip

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host "🌐 Your app should be available at: https://$appName.azurewebsites.net" -ForegroundColor Cyan
    
    Write-Host "`n⚠️  IMPORTANT: Don't forget to:" -ForegroundColor Yellow
    Write-Host "   1. Set all environment variables in Azure Portal" -ForegroundColor Yellow
    Write-Host "   2. Run database migrations: az webapp ssh --resource-group $resourceGroup --name $appName" -ForegroundColor Yellow
    Write-Host "   3. Enable 'Always On' and 'Web Sockets' in Configuration" -ForegroundColor Yellow
} else {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    exit 1
}


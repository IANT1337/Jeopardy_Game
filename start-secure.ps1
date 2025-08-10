# Security-Enhanced Startup Script for Jeopardy Game
# This script provides security options when starting the server

param(
    [switch]$LocalOnly,
    [switch]$External,
    [string]$Password
)

Write-Host "=== Jeopardy Game - Secure Startup ===" -ForegroundColor Green
Write-Host ""

# Check if Node.js dependencies are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Generate or use provided password
if (-not $Password) {
    $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
    $Password = ""
    for ($i = 1; $i -le 16; $i++) {
        $Password += $chars[(Get-Random -Maximum $chars.Length)]
    }
    Write-Host "Generated secure password: $Password" -ForegroundColor Cyan
} else {
    Write-Host "Using provided password" -ForegroundColor Cyan
}

# Set security level
if ($LocalOnly) {
    Write-Host "🔒 SECURITY LEVEL: LOCAL NETWORK ONLY" -ForegroundColor Green
    $env:HOST = "0.0.0.0"
    
    # Ensure restrictive firewall rule
    $localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -eq "Dhcp" }).IPAddress
    $subnet = $localIP.Substring(0, $localIP.LastIndexOf('.')) + ".0/24"
    
    try {
        Remove-NetFirewallRule -DisplayName "Jeopardy Game*" -ErrorAction SilentlyContinue
        New-NetFirewallRule -DisplayName "Jeopardy Game - Local Only" -Direction Inbound -Protocol TCP -LocalPort 3000 -RemoteAddress $subnet -Action Allow | Out-Null
        Write-Host "✓ Firewall configured for local network only" -ForegroundColor Green
    } catch {
        Write-Host "⚠ Could not configure firewall (run as Administrator for firewall control)" -ForegroundColor Yellow
    }
    
} elseif ($External) {
    Write-Host "🔶 SECURITY LEVEL: EXTERNAL ACCESS ALLOWED" -ForegroundColor Yellow
    Write-Host "⚠ WARNING: Server will be accessible from the internet!" -ForegroundColor Red
    $env:HOST = "0.0.0.0"
    
    try {
        Remove-NetFirewallRule -DisplayName "Jeopardy Game*" -ErrorAction SilentlyContinue
        New-NetFirewallRule -DisplayName "Jeopardy Game - External" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow | Out-Null
        Write-Host "✓ Firewall configured for external access" -ForegroundColor Yellow
    } catch {
        Write-Host "⚠ Could not configure firewall (run as Administrator for firewall control)" -ForegroundColor Yellow
    }
} else {
    Write-Host "🔒 SECURITY LEVEL: LOCALHOST ONLY" -ForegroundColor Green
    $env:HOST = "127.0.0.1"
}

# Set environment variables
$env:HOST_PASSWORD = $Password
$env:PORT = "3000"

Write-Host ""
Write-Host "Starting Jeopardy Game Server..." -ForegroundColor Yellow
Write-Host "Host Password: $Password" -ForegroundColor Cyan
Write-Host ""

# Show security reminders
Write-Host "🛡️ SECURITY REMINDERS:" -ForegroundColor Yellow
Write-Host "• Monitor console for connection logs" -ForegroundColor White
Write-Host "• Stop server immediately after games" -ForegroundColor White
Write-Host "• Share session IDs only with trusted players" -ForegroundColor White
Write-Host "• Use Ctrl+C to stop the server" -ForegroundColor White
Write-Host ""

# Start the server
try {
    npm start
} catch {
    Write-Host "Error starting server: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    # Cleanup firewall rules when server stops
    if ($External) {
        Write-Host ""
        Write-Host "Cleaning up external firewall rule..." -ForegroundColor Yellow
        try {
            Remove-NetFirewallRule -DisplayName "Jeopardy Game - External" -ErrorAction SilentlyContinue
            Write-Host "✓ External firewall rule removed" -ForegroundColor Green
        } catch {
            Write-Host "⚠ Could not remove firewall rule" -ForegroundColor Yellow
        }
    }
}

# Jeopardy Game - External Access Setup Script
# Run this script as Administrator to configure Windows Firewall

Write-Host "=== Jeopardy Game External Access Setup ===" -ForegroundColor Green
Write-Host ""

# Check if running as administrator
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    pause
    exit 1
}

$port = 3000

Write-Host "1. Configuring Windows Firewall..." -ForegroundColor Yellow

# Remove existing rules if they exist
try {
    Remove-NetFirewallRule -DisplayName "Jeopardy Game Inbound" -ErrorAction SilentlyContinue
    Remove-NetFirewallRule -DisplayName "Jeopardy Game Outbound" -ErrorAction SilentlyContinue
} catch {
    # Ignore errors if rules don't exist
}

# Create new firewall rules
try {
    New-NetFirewallRule -DisplayName "Jeopardy Game Inbound" -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow
    New-NetFirewallRule -DisplayName "Jeopardy Game Outbound" -Direction Outbound -Protocol TCP -LocalPort $port -Action Allow
    Write-Host "   ✓ Firewall rules created successfully" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Failed to create firewall rules: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "2. Network Information:" -ForegroundColor Yellow

# Get local IP address
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -eq "Dhcp" }).IPAddress
Write-Host "   Local IP Address: $localIP" -ForegroundColor Cyan

# Get public IP
try {
    $publicIP = (Invoke-RestMethod -Uri "https://api.ipify.org" -TimeoutSec 10).Trim()
    Write-Host "   Public IP Address: $publicIP" -ForegroundColor Cyan
} catch {
    Write-Host "   Public IP Address: Unable to determine (check https://whatismyipaddress.com/)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "3. Next Steps:" -ForegroundColor Yellow
Write-Host "   a) Configure your router to port forward port $port to $localIP" -ForegroundColor White
Write-Host "   b) Start your Jeopardy server: npm start" -ForegroundColor White
Write-Host "   c) Local users can connect to: http://$localIP`:$port" -ForegroundColor White
if ($publicIP) {
    Write-Host "   d) External users can connect to: http://$publicIP`:$port" -ForegroundColor White
}
Write-Host ""

Write-Host "4. Router Port Forwarding Instructions:" -ForegroundColor Yellow
Write-Host "   - Access your router admin panel (usually http://192.168.1.1 or http://192.168.0.1)" -ForegroundColor White
Write-Host "   - Look for 'Port Forwarding' or 'Virtual Servers' section" -ForegroundColor White
Write-Host "   - Create a new rule:" -ForegroundColor White
Write-Host "     * External Port: $port" -ForegroundColor White
Write-Host "     * Internal Port: $port" -ForegroundColor White
Write-Host "     * Internal IP: $localIP" -ForegroundColor White
Write-Host "     * Protocol: TCP" -ForegroundColor White
Write-Host ""

Write-Host "Setup complete! Press any key to exit..." -ForegroundColor Green
pause

# Test Network Connectivity for Jeopardy Game
# Run this script to test if external access is working

param(
    [string]$Port = "3000"
)

Write-Host "=== Jeopardy Game Network Test ===" -ForegroundColor Green
Write-Host ""

# Get local IP
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -eq "Dhcp" }).IPAddress

Write-Host "Testing network connectivity..." -ForegroundColor Yellow
Write-Host "Local IP: $localIP" -ForegroundColor Cyan
Write-Host "Port: $Port" -ForegroundColor Cyan
Write-Host ""

# Test if port is listening
$listening = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($listening) {
    Write-Host "✓ Server is listening on port $Port" -ForegroundColor Green
} else {
    Write-Host "✗ Server is NOT listening on port $Port" -ForegroundColor Red
    Write-Host "  Make sure to start your server with: npm start" -ForegroundColor Yellow
}

# Test firewall rules
$firewallRules = Get-NetFirewallRule -DisplayName "*Jeopardy*" -ErrorAction SilentlyContinue
if ($firewallRules) {
    Write-Host "✓ Firewall rules are configured" -ForegroundColor Green
} else {
    Write-Host "✗ Firewall rules not found" -ForegroundColor Red
    Write-Host "  Run setup-external-access.ps1 as Administrator" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Connection URLs:" -ForegroundColor Yellow
Write-Host "  Local: http://localhost:$Port" -ForegroundColor Cyan
Write-Host "  LAN: http://$localIP`:$Port" -ForegroundColor Cyan

# Get public IP
try {
    $publicIP = (Invoke-RestMethod -Uri "https://api.ipify.org" -TimeoutSec 5).Trim()
    Write-Host "  External: http://$publicIP`:$Port" -ForegroundColor Cyan
    Write-Host "    (Requires router port forwarding)" -ForegroundColor Yellow
} catch {
    Write-Host "  External: Unable to determine public IP" -ForegroundColor Yellow
}

Write-Host ""

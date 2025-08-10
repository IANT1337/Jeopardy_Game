# Jeopardy Game Security Enhancement Script
# Run this script as Administrator to improve security

Write-Host "=== Jeopardy Game Security Enhancement ===" -ForegroundColor Green
Write-Host ""

# Function to generate a strong password
function Generate-StrongPassword {
    $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
    $password = ""
    for ($i = 1; $i -le 16; $i++) {
        $password += $chars[(Get-Random -Maximum $chars.Length)]
    }
    return $password
}

Write-Host "1. Security Recommendations:" -ForegroundColor Yellow
Write-Host "   a) Use a strong host password (generated below)" -ForegroundColor White
Write-Host "   b) Only run the server when actively hosting games" -ForegroundColor White
Write-Host "   c) Monitor console logs for suspicious activity" -ForegroundColor White
Write-Host "   d) Consider using a VPN for external access" -ForegroundColor White
Write-Host "   e) Regularly check for unauthorized sessions" -ForegroundColor White
Write-Host ""

Write-Host "2. Generated Strong Password:" -ForegroundColor Yellow
$strongPassword = Generate-StrongPassword
Write-Host "   HOST_PASSWORD=$strongPassword" -ForegroundColor Cyan
Write-Host ""
Write-Host "   To use this password:" -ForegroundColor White
Write-Host "   • Set environment variable: `$env:HOST_PASSWORD='$strongPassword'" -ForegroundColor White
Write-Host "   • Or start server with: `$env:HOST_PASSWORD='$strongPassword'; npm start" -ForegroundColor White
Write-Host ""

Write-Host "3. Windows Firewall - Restricted Rule (Recommended):" -ForegroundColor Yellow
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -eq "Dhcp" }).IPAddress

Write-Host "   Creating restrictive firewall rule for local network only..." -ForegroundColor White
try {
    # Remove existing rules
    Remove-NetFirewallRule -DisplayName "Jeopardy Game*" -ErrorAction SilentlyContinue
    
    # Create restricted rule (local subnet only)
    $subnet = $localIP.Substring(0, $localIP.LastIndexOf('.')) + ".0/24"
    New-NetFirewallRule -DisplayName "Jeopardy Game - Local Only" -Direction Inbound -Protocol TCP -LocalPort 3000 -RemoteAddress $subnet -Action Allow
    Write-Host "   ✓ Local network firewall rule created: $subnet" -ForegroundColor Green
    
    Write-Host "   For external access, create additional rule:" -ForegroundColor Yellow
    Write-Host "     New-NetFirewallRule -DisplayName 'Jeopardy Game - External' -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow" -ForegroundColor White
} catch {
    Write-Host "   ✗ Failed to create firewall rule: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "4. Security Monitoring Commands:" -ForegroundColor Yellow
Write-Host "   Check active connections:" -ForegroundColor White
Write-Host "     Get-NetTCPConnection -LocalPort 3000 | Select-Object RemoteAddress,State" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Monitor firewall logs:" -ForegroundColor White
Write-Host "     Get-WinEvent -FilterHashtable @{LogName='Security';ID=5156} | Select-Object -First 10" -ForegroundColor Cyan
Write-Host ""

Write-Host "5. Risk Assessment:" -ForegroundColor Yellow
Write-Host "   🟡 MODERATE RISK when properly configured" -ForegroundColor Yellow
Write-Host "   🔴 HIGH RISK with default settings" -ForegroundColor Red
Write-Host "   🟢 LOW RISK for local network only" -ForegroundColor Green
Write-Host ""

Write-Host "6. Best Practices:" -ForegroundColor Yellow
Write-Host "   • Use the generated strong password above" -ForegroundColor White
Write-Host "   • Only allow external access when needed" -ForegroundColor White
Write-Host "   • Monitor the game console for connections" -ForegroundColor White
Write-Host "   • Stop the server immediately after games" -ForegroundColor White
Write-Host "   • Consider port forwarding only during games" -ForegroundColor White
Write-Host ""

Write-Host "Setup complete! Press any key to exit..." -ForegroundColor Green
pause

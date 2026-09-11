# EcoTrace Windows agent launcher — run on the real Windows host.
$env:ECOTRACE_SERVER = 'https://127.0.0.1'
$env:ECOTRACE_INSECURE_TLS = 'true'
$env:BOOTSTRAP_TOKEN = '8c08b5f86085ba7b55469ae22458d792611f6a683868c4db042a9a1aa30c01c2'
$env:DEVICE_CLASS = 'windows'

# Stop any previous EcoTrace agent instance (match by path to stay safe).
Get-Process -Name 'agent' -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -like 'D:\EcoTrace\*' } |
  Stop-Process -Force -ErrorAction SilentlyContinue

Start-Process -FilePath 'D:\EcoTrace\agent\agent.exe' `
  -WorkingDirectory 'D:\EcoTrace\agent' `
  -WindowStyle Hidden `
  -RedirectStandardOutput 'D:\EcoTrace\agent\agent-windows.log' `
  -RedirectStandardError 'D:\EcoTrace\agent\agent-windows-err.log'

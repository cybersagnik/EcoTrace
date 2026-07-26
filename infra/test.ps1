curl -s -X POST http://localhost:3002/register \
  -H "Content-Type: application/json" \
  -d '{
    "bootstrap_token": "dev-bootstrap-token",
    "device_class": "linux",
    "hostname": "dev-machine",
    "os": "Ubuntu 22.04",
    "public_key": "placeholder"
  }' | jq .
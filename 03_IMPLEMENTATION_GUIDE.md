# Implementation Guide

## Phase 1: Quick Start (30 minutes)

Get the phone working fast, refactor later.

### Step 1: Create index.php (Entry Point)

Create `/home/abdulrauf/Desktop/saraphone/index.php`:

```php
<?php
/**
 * SaraPhone Standalone Entry Point
 * Handles authentication and routes to phone
 */

session_start();

// Get authentication token from URL or POST
$token = $_GET['token'] ?? $_POST['token'] ?? null;

if (!$token) {
    http_response_code(401);
    die(json_encode(['error' => 'No authentication token provided']));
}

// TODO: Replace with your actual token verification
// For now, accept any token longer than 5 characters
if (strlen($token) < 5) {
    http_response_code(403);
    die(json_encode(['error' => 'Invalid token']));
}

// Set session variables
// TODO: Replace with actual user data from your system
$_SESSION['user_id'] = 'user_' . hash('sha256', $token);
$_SESSION['extension'] = $_GET['ext'] ?? '2020';
$_SESSION['username'] = $_GET['name'] ?? 'User';
$_SESSION['domain_name'] = $_ENV['SIP_DOMAIN'] ?? 'example.com';

// Load the phone interface
require_once 'phone.php';
?>
```

### Step 2: Rename saraphone.php → phone.php

```bash
mv /home/abdulrauf/Desktop/saraphone/saraphone.php \
   /home/abdulrauf/Desktop/saraphone/phone.php
```

### Step 3: Clean Up phone.php

Remove FusionPBX code from phone.php:

```php
<?php
// At the top of phone.php, REMOVE these lines (37-42):
// require_once "root.php";
// require_once "resources/require.php";
// require_once "resources/header.php";
// require_once "resources/check_auth.php";
// permission checks...

// REPLACE with simple session check:
if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo "access denied";
    exit;
}

// REMOVE lines 50-57 (language and DB query)
// and REPLACE with:

$text = [
    'head_description' => 'A WebRTC client for SIP',
    'choose_phone' => 'Choose which Phone',
    'back_to_dashboard' => 'Back to Dashboard',
    'wait_please' => 'Wait please...',
    'your_account_login' => 'Your Account Login (eg: 2020)',
    'your_account_password' => 'Your Account Password (eg: 12345)',
    'your_display_name' => 'Your Display Name',
    'advanced_set_server_and_blfs' => 'Advanced: set Server and BLFs',
    'label' => 'Label',
    'placeholder_number_to_dial' => 'number to dial (eg: 0549123456)',
    'answer' => 'Answer',
    'reject' => 'Reject',
    'dial' => 'Dial',
    'cancel' => 'Canc',
    'redial' => 'ReDial',
    'dnd' => 'DND',
    'voicemail' => 'VoiceMail',
    'contacts' => 'Contacts',
    'mute_ring' => 'MUTE RING',
    'autoanswer' => 'AUTOANSWER',
];

// Get user's devices (hardcoded for now)
$rows3 = [
    [
        'device_address' => '001122334455',
        'extension' => $_SESSION['extension'] ?? '2020',
        'device_template' => 'WebPhone',
        'display_name' => $_SESSION['username'] ?? 'Web Phone',
        'effective_caller_id_name' => $_SESSION['extension'] ?? '2020',
        'outbound_caller_id_number' => $_SESSION['extension'] ?? '2020'
    ]
];

// Continue with rest of phone.php...
// REMOVE lines 154-170 (the SQL queries for $sql5 and $sql4)
// and REPLACE with:

$device_info = [
    'device_address' => $_GET['wanted_device'] ?? $rows3[0]['device_address'],
    'extension' => $_SESSION['extension'] ?? '2020',
    'device_template' => 'WebPhone',
    'display_name' => $_SESSION['username'] ?? 'Web Phone',
    'password' => 'sipPassword123',  // TODO: Get from your config/API
    'effective_caller_id_name' => $_SESSION['extension'] ?? '2020',
    'outbound_caller_id_number' => $_SESSION['extension'] ?? '2020',
    'register_expires' => '3600',
    'sip_transport' => 'wss',
    'sip_port' => '7443',
    'server_address' => $_ENV['WSS_PROXY'] ?? 'freeswitch.example.com',
    'outbound_proxy_primary' => $_ENV['WSS_PROXY'] ?? 'freeswitch.example.com'
];

$rows5 = [$device_info];
$rows = []; // BLF buttons (empty for now)
?>
```

### Step 4: Create .env File

Create `/home/abdulrauf/Desktop/saraphone/.env`:

```bash
# FreeSwitch/SIP Configuration
WSS_PROXY=freeswitch.example.com
WSS_PORT=7443
SIP_DOMAIN=example.com
SIP_PORT=5060

# Debug
DEBUG=false
LOG_LEVEL=info
```

### Step 5: Test It!

```bash
# Using built-in PHP server
cd /home/abdulrauf/Desktop/saraphone
php -S localhost:8080

# In browser, visit:
# http://localhost:8080/index.php?token=testtoken123&ext=2020&name=John
```

**Phone should load!** Check browser console (F12) for errors.

---

## Phase 2: Clean Architecture (4-8 hours)

Proper separation of concerns with API endpoints.

### Step 1: Create auth.php

Create `/home/abdulrauf/Desktop/saraphone/auth.php`:

```php
<?php
/**
 * Authentication Functions
 * Replace these with your actual authentication system
 */

function userIsLoggedIn() {
    return isset($_SESSION['user_id']);
}

function getCurrentUserId() {
    return $_SESSION['user_id'] ?? null;
}

function getCurrentExtension() {
    return $_SESSION['extension'] ?? null;
}

function getUserDevices($user_id) {
    // TODO: Query your database or call your API
    // For now, return test data
    
    // Example: Call your API
    // $response = file_get_contents("https://api.example.com/users/$user_id/devices");
    // return json_decode($response, true);
    
    // For testing:
    return [
        [
            'device_address' => '001122334455',
            'extension' => $_SESSION['extension'] ?? '2020',
            'device_template' => 'WebPhone',
            'display_name' => 'Office Phone',
            'effective_caller_id_name' => $_SESSION['username'] ?? 'User',
            'outbound_caller_id_number' => $_SESSION['extension'] ?? '2020'
        ]
    ];
}

function getDeviceConfig($device_address, $user_id) {
    // TODO: Get SIP credentials from your system
    // For now, return hardcoded test data
    
    return [
        'device_address' => $device_address,
        'extension' => $_SESSION['extension'] ?? '2020',
        'password' => getenv('SIP_PASSWORD') ?? 'sipPassword123',
        'display_name' => $_SESSION['username'] ?? 'Web Phone',
        'effective_caller_id_name' => $_SESSION['extension'] ?? '2020',
        'outbound_caller_id_number' => $_SESSION['extension'] ?? '2020',
        'register_expires' => 3600,
        'sip_transport' => 'wss',
        'sip_port' => getenv('WSS_PORT') ?? 7443,
        'server_address' => getenv('WSS_PROXY') ?? 'freeswitch.example.com',
        'outbound_proxy_primary' => getenv('WSS_PROXY') ?? 'freeswitch.example.com'
    ];
}
?>
```

### Step 2: Create API Endpoints

Create `/home/abdulrauf/Desktop/saraphone/api/config.php`:

```php
<?php
/**
 * API Endpoint: Get SIP Server Configuration
 */

header('Content-Type: application/json');
session_start();

// Check authentication
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    die(json_encode(['error' => 'Not authenticated']));
}

// Load environment variables
require_once __DIR__ . '/../.env.php';

$config = [
    'wss_proxy' => getenv('WSS_PROXY') ?? 'freeswitch.example.com',
    'wss_port' => (int)(getenv('WSS_PORT') ?? 7443),
    'sip_domain' => getenv('SIP_DOMAIN') ?? 'example.com',
    'sip_port' => (int)(getenv('SIP_PORT') ?? 5060),
    'debug' => getenv('DEBUG') === 'true',
    'ice_servers' => [
        ['urls' => ['stun:stun.l.google.com:19302']]
    ]
];

echo json_encode($config);
?>
```

Create `/home/abdulrauf/Desktop/saraphone/api/credentials.php`:

```php
<?php
/**
 * API Endpoint: Get SIP Credentials
 */

header('Content-Type: application/json');
session_start();

require_once __DIR__ . '/../auth.php';

if (!userIsLoggedIn()) {
    http_response_code(401);
    die(json_encode(['error' => 'Not authenticated']));
}

$device = $_GET['device'] ?? $_POST['device'] ?? null;

if (!$device) {
    http_response_code(400);
    die(json_encode(['error' => 'Device not specified']));
}

$credentials = getDeviceConfig($device, getCurrentUserId());

echo json_encode($credentials);
?>
```

### Step 3: Create .env Loader

Create `/home/abdulrauf/Desktop/saraphone/.env.php`:

```php
<?php
/**
 * Load environment variables from .env file
 */

$env_file = __DIR__ . '/.env';

if (file_exists($env_file)) {
    $lines = file($env_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    
    foreach ($lines as $line) {
        // Skip comments
        if (strpos($line, '#') === 0) continue;
        
        // Parse KEY=VALUE
        if (strpos($line, '=') !== false) {
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            
            // Remove quotes if present
            if ((strpos($value, '"') === 0) && (strrpos($value, '"') === strlen($value) - 1)) {
                $value = substr($value, 1, -1);
            }
            
            putenv("$key=$value");
        }
    }
}
?>
```

### Step 4: Update phone.php to Use API

In `phone.php`, modify the JavaScript configuration section to fetch from API:

Look for where `wss_proxy`, `wss_port`, etc. are used in JavaScript, and change:

```javascript
// OLD: Configuration from HTML injection
var ua = new SIP.UA({
    uri: ...,
    transportConnectors: [new SIP.WebSocketInterface(wss_proxy)],
    ...
});

// NEW: Fetch configuration from API
async function initializePhone() {
    try {
        // Get server config
        const configResp = await fetch('api/config.php');
        if (!configResp.ok) throw new Error('Failed to get config');
        const config = await configResp.json();
        
        // Get credentials
        const credsResp = await fetch('api/credentials.php?device=' + getCurrentDevice());
        if (!credsResp.ok) throw new Error('Failed to get credentials');
        const creds = await credsResp.json();
        
        // Initialize SIP User Agent
        var ua = new SIP.UA({
            uri: SIP.UserAgent.parseNameAddr(creds.extension + '@' + config.sip_domain).uri,
            transportConnectors: [
                new SIP.WebSocketInterface('wss://' + config.wss_proxy + ':' + config.wss_port)
            ],
            authorizationUser: creds.extension,
            password: creds.password,
            registerer_expires: creds.register_expires,
            register: true,
            logBuiltinEnabled: config.debug,
            userAgentString: 'SaraPhone/1.0',
            ...
        });
        
        return ua;
    } catch (error) {
        console.error('Phone initialization failed:', error);
        alert('Failed to initialize phone: ' + error.message);
    }
}

// Initialize on page load
window.addEventListener('load', initializePhone);
```

### Step 5: Remove FusionPBX Files

```bash
rm /home/abdulrauf/Desktop/saraphone/contacts.php
rm -rf /home/abdulrauf/Desktop/saraphone/resources/require.php
rm -rf /home/abdulrauf/Desktop/saraphone/resources/check_auth.php
rm -rf /home/abdulrauf/Desktop/saraphone/resources/header.php
rm -rf /home/abdulrauf/Desktop/saraphone/resources/paging.php
rm /home/abdulrauf/Desktop/saraphone/app_menu.php
rm -rf /home/abdulrauf/Desktop/saraphone/resources/switch/
```

### Step 6: Test Everything

```bash
# Test 1: Phone loads
curl http://localhost:8080/index.php?token=test

# Test 2: API endpoints
curl http://localhost:8080/api/config.php --cookie "PHPSESSID=..."

# Test 3: Make calls in browser
# Open http://localhost:8080/index.php?token=test
# Check browser console (F12) for SIP registration
```

---

## Troubleshooting

### WebSocket Connection Failed
```bash
# Check FreeSwitch is running
systemctl status freeswitch

# Check port 7443 is listening
netstat -tlnp | grep 7443

# Check SSL certificate exists
ls -la /etc/freeswitch/tls/wss.pem
```

### SIP Registration Failed
- Check username/password in credentials
- Check domain name matches SIP config
- Check FreeSwitch logs: `tail -f /var/log/freeswitch/freeswitch.log`

### No Audio After Connection
- Check RTP ports are open (16384-32768)
- Check firewall configuration
- Check audio settings in browser

### Phone Won't Load
```bash
# Check PHP errors
tail -f /var/log/apache2/error.log

# Check browser console (F12)
# Check browser network tab (F12)

# Verify session is being set
php -r 'session_start(); var_dump($_SESSION);'
```

---

## Docker Setup (Optional)

Create `Dockerfile`:

```dockerfile
FROM php:8.0-apache

RUN a2enmod rewrite
RUN apt-get update && apt-get install -y git curl

WORKDIR /var/www/html
COPY . /var/www/html/
RUN chown -R www-data:www-data /var/www/html

EXPOSE 80
CMD ["apache2-foreground"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  saraphone:
    build: .
    ports:
      - "8080:80"
    environment:
      - WSS_PROXY=freeswitch.example.com
      - WSS_PORT=7443
      - SIP_DOMAIN=example.com
      - DEBUG=false
    volumes:
      - ./:/var/www/html

  freeswitch:
    image: freeswitch/freeswitch:latest
    ports:
      - "7443:7443"
    volumes:
      - freeswitch_config:/etc/freeswitch

volumes:
  freeswitch_config:
```

Run:
```bash
docker-compose up -d
```

Access: `http://localhost:8080/index.php?token=test`

---

## Testing Checklist

- [ ] Phone loads in browser
- [ ] No JavaScript errors in console
- [ ] SIP registration appears in browser console
- [ ] Can dial numbers
- [ ] Can receive calls
- [ ] Audio works both ways
- [ ] Hold/Resume works
- [ ] Transfer works
- [ ] Works on mobile browser
- [ ] Works with different networks

# Cleanup & Removal Guide

## Files to Remove (Delete These)

### Priority 1 - Remove Immediately
- `contacts.php` (387 lines) - You have external database
- `resources/require.php` (~500 lines) - FusionPBX functions
- `resources/check_auth.php` (~100 lines) - FusionPBX authentication
- `resources/header.php` (~200 lines) - FusionPBX UI framework
- `resources/paging.php` (~100 lines) - FusionPBX pagination
- `app_menu.php` (~50 lines) - FusionPBX menu

### Priority 2 - Remove After Testing
- `app_defaults.php` - Currently empty
- `resources/switch/conf/dialplan/` - Use your own FreeSwitch dialplan

### Priority 3 - Simplify
- `app_config.php` - Remove FusionPBX references
- `root.php` - Keep only path setup logic

---

## Code Changes in saraphone.php

### REMOVE: Lines 37-42 (FusionPBX Includes)

**BEFORE:**
```php
//includes
require_once "root.php";
require_once "resources/require.php";
require_once "resources/header.php";

//check permissions
require_once "resources/check_auth.php";
if (permission_exists('saraphone_call')) {
    //access granted
} else {
    echo "access denied";
    exit;
}
```

**AFTER:**
```php
// Check authentication (your method)
if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo "access denied";
    exit;
}
```

---

### REMOVE: Lines 50-57 (FusionPBX DB & Language)

**BEFORE:**
```php
//add multi-lingual support
$language = new text;
$text = $language->get();

$sql3 = "SELECT distinct d.device_address, extension,d.device_template,display_name...";
$database3 = new database;
$rows3 = $database3->select($sql3, NULL, 'all');
```

**AFTER:**
```php
// Language strings (from app_languages.php)
$text = [
    'head_description' => 'A WebRTC client for SIP',
    'choose_phone' => 'Choose which Phone',
    'wait_please' => 'Wait please...',
    'dial' => 'Dial',
    'answer' => 'Answer',
    'reject' => 'Reject',
    'dnd' => 'DND',
    'contacts' => 'Contacts',
    // ... add more as needed
];

// Get user's devices (from your API or config)
$rows3 = getUserDevices($_SESSION['user_id']);
```

---

### REMOVE: Lines 154-170 (More FusionPBX DB Queries)

**BEFORE:**
```php
$sql5 = "SELECT d.device_address, extension,d.device_template,display_name,v_extensions.password,effective_caller_id_name,outbound_caller_id_number,register_expires, sip_transport, sip_port, server_address, outbound_proxy_primary FROM v_extension_users, v_extensions, v_users,v_device_lines AS l, v_devices AS d WHERE ...";
$database5 = new database;
$rows5 = $database5->select($sql5, NULL, 'all');

$user_extension = $rows5[0]['extension'];
$user_password = $rows5[0]['password'];
$effective_caller_id_name = $rows5[0]['effective_caller_id_name'];

$sql4 = "SELECT d.device_address, extension,d.device_template,display_name,v_extensions.password,effective_caller_id_name,outbound_caller_id_number,k.device_key_label, k.device_key_value, k.device_key_id, register_expires, sip_transport, sip_port, server_address, outbound_proxy_primary FROM v_extension_users, v_extensions, v_users,v_device_lines AS l, v_devices AS d, v_device_keys AS k WHERE ...";
$database4 = new database;
$rows = $database4->select($sql4, NULL, 'all');
```

**AFTER:**
```php
// Get SIP credentials (from your API or config)
$device_config = getDeviceConfig($wanted_device, $_SESSION['user_id']);
$rows5 = [$device_config];

$user_extension = $device_config['extension'];
$user_password = $device_config['password'];
$effective_caller_id_name = $device_config['effective_caller_id_name'];

// Get BLF buttons (if needed)
$rows = getBLFButtons($_SESSION['user_id'], $wanted_device);
```

---

## Functions to Create

### Create auth.php

```php
<?php
function userIsLoggedIn() {
    return isset($_SESSION['user_id']);
}

function getCurrentUserId() {
    return $_SESSION['user_id'] ?? null;
}

function getCurrentExtension() {
    return $_SESSION['extension'] ?? null;
}

function getCurrentDomain() {
    return $_SESSION['domain_name'] ?? 'example.com';
}

function getUserDevices($user_id) {
    // TODO: Replace with your API call or database query
    // For now, return dummy data
    return [
        [
            'device_address' => '001122334455',
            'extension' => $_SESSION['extension'] ?? '2020',
            'device_template' => 'WebPhone',
            'display_name' => 'Web Phone',
            'effective_caller_id_name' => $_SESSION['extension'] ?? '2020',
            'outbound_caller_id_number' => $_SESSION['extension'] ?? '2020'
        ]
    ];
}

function getDeviceConfig($device_address, $user_id) {
    // TODO: Replace with your API call or database query
    return [
        'device_address' => $device_address,
        'extension' => $_SESSION['extension'] ?? '2020',
        'password' => 'sipPassword123',  // Get from secure config
        'display_name' => 'Web Phone',
        'effective_caller_id_name' => $_SESSION['extension'] ?? '2020',
        'outbound_caller_id_number' => $_SESSION['extension'] ?? '2020',
        'sip_transport' => 'wss',
        'sip_port' => '7443',
        'server_address' => $_ENV['WSS_PROXY'] ?? 'freeswitch.example.com',
        'register_expires' => '3600'
    ];
}

function getBLFButtons($user_id, $device_address) {
    // TODO: Return device key configurations if needed
    // For now, return empty array
    return [];
}
?>
```

---

## FusionPBX Tables Reference

If you need to adapt existing code to your database, replace these tables:

| FusionPBX Table | Purpose | Your Table |
|---|---|---|
| v_extensions | SIP accounts & credentials | your_extensions |
| v_devices | Phone devices | your_devices |
| v_device_lines | User-device associations | your_device_lines |
| v_device_keys | BLF button configurations | your_device_keys |
| v_users | User accounts | your_users |
| v_extension_users | User-extension associations | your_extension_users |
| v_contacts | Phonebook contacts | your_contacts |
| v_contact_phones | Contact phone numbers | your_contact_phones |
| v_contact_settings | Contact metadata | your_contact_settings |
| v_contact_groups | Contact group assignments | your_contact_groups |

---

## Session Variables Mapping

Replace FusionPBX session variables with your own:

| FusionPBX | Your System |
|---|---|
| `$_SESSION['domain_uuid']` | `$_SESSION['company_id']` |
| `$_SESSION['user_uuid']` | `$_SESSION['user_id']` |
| `$_SESSION['domain_name']` | `$_SESSION['domain_name']` |
| `$_SESSION['saraphone']['wss_proxy']` | `$_ENV['WSS_PROXY']` |
| `$_SESSION['groups']` | `$_SESSION['user_groups']` |

---

## Estimated Code Removal

- **Before cleanup:** ~4,000 lines total
- **After cleanup:** ~2,500 lines total
- **Reduction:** ~40% less code
- **Result:** Cleaner, more maintainable codebase

---

## Step-by-Step Removal Plan

1. **Backup first:**
   ```bash
   git checkout -b saraphone-standalone
   ```

2. **Remove files:**
   ```bash
   rm contacts.php
   rm -rf resources/require.php
   rm -rf resources/check_auth.php
   rm -rf resources/header.php
   rm -rf resources/paging.php
   rm app_menu.php
   ```

3. **Create auth.php:**
   - Copy code from section above
   - Replace dummy functions with your implementation

4. **Modify saraphone.php:**
   - Remove lines 37-42 (includes)
   - Remove lines 50-57 (language & DB query)
   - Remove lines 154-170 (more DB queries)
   - Call new functions instead

5. **Test:**
   - Load phone in browser
   - Check browser console (F12) for errors
   - Verify SIP registration

6. **Deploy:**
   - Push to production
   - Monitor for issues

---

## Checklist

- [ ] Created auth.php
- [ ] Removed FusionPBX requires from saraphone.php
- [ ] Removed FusionPBX DB queries
- [ ] Updated language strings
- [ ] Deleted contacts.php
- [ ] Deleted resources/require.php
- [ ] Deleted resources/check_auth.php
- [ ] Deleted resources/header.php
- [ ] Deleted app_menu.php
- [ ] Tested phone loads
- [ ] Tested SIP registration
- [ ] Tested making calls
- [ ] Tested receiving calls

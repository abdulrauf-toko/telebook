# SaraPhone - How It Works (Core Functionality)

## Overview
SaraPhone is a WebRTC SIP softphone built with **SIP.js** library. It runs entirely in the browser using WebSocket Secure (WSS) to communicate with a SIP server. All core logic is in **saraphone.js** (1,147 lines).

**Key Architecture:**
- **saraphone.html** - UI layout (buttons, forms, audio elements)
- **saraphone.js** - All SIP logic and call management
- **SIP.js library** - Handles SIP protocol over WebRTC

---

## 1. Application Startup Flow

### 1.1 Page Load (saraphone.html)
```
Browser loads saraphone.html
   ↓
Audio elements preloaded (DTMF tones from wav/ folder)
   ↓
User sees login screen with fields:
   - Login (extension number)
   - Password
   - Display Name (optional)
   - Advanced settings: Domain, WSS Proxy, Port, BLF numbers
```

### 1.2 Login Button Clicked → `init()` Function (Line ~860 in saraphone.js)

The `init()` function:

```javascript
function init() {
    // 1. Collect credentials from form
    login = $("#login").val();           // e.g., "1010"
    password = $("#passwd").val();       // User's SIP password
    yourname = $("#yourname").val();     // Display name
    nameDomain = $("#domain").val();     // e.g., "your-domain.com"
    nameProxy = $("#proxy").val();       // WSS server hostname
    wssport = $("#port").val();          // Port 7443 (default)
    
    // 2. Build SIP URI
    uri = login + "@" + nameDomain;      // e.g., "1010@your-domain.com"
    
    // 3. Build WebSocket connection string
    which_server = "wss://" + nameProxy + ":" + wssport;
    // Result: "wss://your-server.com:7443"
    
    // 4. Create SIP User Agent (UA)
    ua = new SIP.UA({
        wsServers: which_server,         // WebSocket connection
        uri: uri,                         // SIP address
        password: password,               // SIP auth
        displayName: yourname,            // Caller ID display
        registerExpires: 120,             // Registration timeout
        // ... other config
    });
    
    // 5. Register for events
    ua.on('invite', handleInvite);       // Incoming calls
    ua.on('notify', handleNotify);       // Presence/BLF notifications
    ua.on('disconnected', ...);          // Connection lost
    ua.once('registered', onRegistered); // Registration success
}
```

---

## 2. Registration Status

### 2.1 When UA Successfully Registers: `onRegistered()` (Line ~225)

```javascript
function onRegistered() {
    isRegistered = true;
    console.log('Registered');
    $("#signin").hide();   // Hide login form
    $("#dial").show();     // Show dial pad
    
    // Load presence subscriptions for BLF (Busy Lamp Field)
    // BLF shows other extensions' busy/idle status
    for (var i = 0; i < countpres; i++) {
        var button_pres = "pres" + i;
        var pressubscription = ua.subscribe(
            ua.userAgent.configuration.uri.user + "@" +
            ua.userAgent.configuration.uri.domain,
            'presence'
        );
        presence_array[i] = pressubscription;
        
        // When status changes, update button color
        presence_array[i].on('notify', function(notification) {
            // Update button based on presence state
        });
    }
}
```

**What happens:** The phone is now ready to make and receive calls. BLF subscriptions track other extensions' availability.

---

## 3. Making an Outbound Call

### 3.1 User Enters Extension Number and Presses Call Button

```
User types "1020" in dial field
   ↓
Clicks "CALL" button
   ↓
$("#callbtn").click() triggered (Line ~557)
   ↓
Calls docall()
```

### 3.2 The `docall()` Function (Line ~472)

```javascript
function docall() {
    // Terminate any existing call
    if (cur_call) {
        cur_call.terminate();
        cur_call = null;
    }

    isIncomingCall = false;
    isOutboundCall = true;  // Flag for later (to distinguish call direction)

    // Make SIP INVITE request using SIP.js
    cur_call = ua.invite($("#ext").val(), {
        // WebRTC media constraints
        media: {
            constraints: {
                audio: {
                    deviceId: {
                        ideal: $("#selectmic").val()  // Selected microphone
                    }
                },
                video: false  // No video
            },
            render: {
                remote: document.getElementById('audio')  // Audio element for playback
            }
        }
    });

    // Register event handlers for this call
    cur_call.on('accepted', onAccepted.bind(cur_call));
    
    // If call rejected/fails
    cur_call.once('failed', function(response, cause) {
        onTerminated(cur_call);
        // Display error: "486: Busy" or other SIP code
    });
    
    // If remote hangs up (BYE)
    cur_call.once('bye', function(request) {
        onTerminated(cur_call);
    });
    
    // If remote cancels (CANCEL)
    cur_call.once('cancel', onTerminated.bind(cur_call));
}
```

### 3.3 What Happens Behind the Scenes

1. **SIP.js creates INVITE message** with your credentials
2. **Sends over WebSocket** to SIP server (wss://proxy:7443)
3. **SIP server routes** to extension 1020
4. Waiting for response...

```
INVITE sip:1020@domain.com SIP/2.0
Via: SIP/2.0/WSS wss-proxy:7443
From: <sip:1010@domain.com>
To: <sip:1020@domain.com>
...
```

---

## 4. Receiving an Incoming Call

### 4.1 Incoming INVITE Arrives

When another phone calls your extension, the SIP server sends an INVITE to your browser:

```
Server sends INVITE → Browser receives → SIP.js triggers event
   ↓
ua.on('invite', handleInvite)  // Registered at line 925
```

### 4.2 The `handleInvite()` Function (Line ~421)

```javascript
function handleInvite(s) {  // s = incoming session
    
    // Check if already on a call
    if (cur_call) {
        s.reject({statusCode: '486', reasonPhrase: 'Busy Here'});
        return;
    }
    
    // Check Do Not Disturb (DND)
    if (isDnd) {
        s.reject({statusCode: '486', reasonPhrase: 'Busy Here'});
        return;
    }
    
    // Not busy - accept the incoming session
    var span = document.getElementById('calling');
    var txt = "---";
    
    // Extract caller information
    if (s.remoteIdentity.displayName) {
        txt = s.remoteIdentity.displayName.toString();
    }
    var caller_number = s.remoteIdentity.uri.user.toString();
    
    // Display caller info
    span.innerText = "CALL FROM: " + txt + " (" + caller_number + ")";
    
    // Store incoming session
    incomingsession = s;
    isIncomingCall = true;
    isOutboundCall = false;
    
    // Show incoming call UI
    $("#isIncomingcall").show();      // Show answer/reject buttons
    $("#isNotIncomingcall").hide();   // Hide dial buttons
    
    // Play ringtone (unless Do Not Ring enabled)
    if (isNoRing == false) {
        audioElement.currentTime = 0;
        audioElement.play();
    }
    
    // Auto-answer if enabled
    if (isAutoAnswer == true) {
        $("#anscallbtn").trigger("click");
    }
    
    // Desktop notification
    notifyMe("CALL FROM: " + txt + " (" + caller_number + ")");
}
```

### 4.3 User Accepts or Rejects the Call

#### Accept: `$("#anscallbtn").click()` (Line ~370)

```javascript
$("#anscallbtn").click(function() {
    // Send SIP 200 OK response
    incomingsession.accept({
        media: {
            constraints: {
                audio: { deviceId: { ideal: $("#selectmic").val() } },
                video: false
            },
            render: { remote: document.getElementById('audio') }
        }
    });
    
    // Transfer incoming session to current call
    cur_call = incomingsession;
    
    // Hide incoming UI, show in-call UI
    $("#isIncomingcall").hide();
    $("#isNotIncomingcall").show();
    
    // Show call controls
    $("#incall").show();
});
```

#### Reject: `$("#rejcallbtn").click()` (Line ~404)

```javascript
$("#rejcallbtn").click(function() {
    // Send SIP 486 Busy response
    incomingsession.reject({
        statusCode: '486',
        reasonPhrase: 'Busy Here'
    });
    
    // Clear UI
    audioElement.pause();
    $("#isIncomingcall").hide();
    $("#isNotIncomingcall").show();
    incomingsession = null;
});
```

---

## 5. During an Active Call

### 5.1 Current Call State

When a call is active:
- `cur_call` = the active SIP session object
- `isIncomingCall` = true/false (to track call direction)
- Audio stream flows: microphone → SIP.js → server → remote party

### 5.2 Call Controls During Active Call

#### **Mute Button** (Line ~603)
```javascript
$("#mutebtn").click(function() {
    if (isOnMute) {
        cur_call.unmute();      // Resume sending audio
        isOnMute = false;
    } else {
        cur_call.mute();        // Stop sending audio
        isOnMute = true;
    }
});
```
The remote party cannot hear you, but you can still hear them.

#### **Hold Button** (Line ~619)
```javascript
$("#holdbtn").click(function() {
    if (isOnHold == false) {
        isOnHold = true;
        
        // Send DTMF code to server (depends on outbound vs inbound)
        if (isOutboundCall == true) {
            cur_call.dtmf("*299", dtmf_options);  // Outbound hold code
        } else {
            cur_call.dtmf("*399", dtmf_options);  // Inbound hold code
        }
    }
});
```
**What actually happens:** A special DTMF code is sent to the server. The server (FreeSwitch/FusionPBX) interprets this and puts the call on hold on its end. You get hold music.

#### **Transfer Button** (Line ~591)
```javascript
$("#xferbtn").click(function() {
    if (isOutboundCall == true) {
        cur_call.dtmf("*499", dtmf_options);  // Outbound transfer code
    } else {
        cur_call.dtmf("*599", dtmf_options);  // Inbound transfer code
    }
});
```
Sends DTMF code *499 or *599 to server to initiate blind transfer.

#### **Attended Transfer Button** (Line ~600)
```javascript
$("#attxbtn").click(function() {
    if (isOutboundCall == true) {
        cur_call.dtmf("*699", dtmf_options);
    } else {
        cur_call.dtmf("*799", dtmf_options);
    }
});
```
For attended transfer (speak to transfer target first).

#### **DTMF Tones** (Line ~776+)
```javascript
$("#dtmf1btn").click(function() {
    cur_call.dtmf("1", dtmf_options);  // Send RFC 2833 DTMF
});

$("#dtmf2btn").click(function() {
    cur_call.dtmf("2", dtmf_options);
});
// ... etc for 0-9, *, #

// Also: Keyboard support
// If user presses "5" on keyboard, it's converted to DTMF
```

#### **Recording Button** (Line ~651)
```javascript
$("#recordcallbtn").click(function() {
    if (isRecording) {
        cur_call.dtmf("*2", dtmf_options);  // Stop recording
        isRecording = false;
    } else {
        cur_call.dtmf("*2", dtmf_options);  // Start recording
        isRecording = true;
    }
});
```

#### **Do Not Disturb (DND)** (Line ~667)
```javascript
$("#dndbtn").click(function() {
    if (isDnd) {
        isDnd = false;  // Accept incoming calls
    } else {
        isDnd = true;   // Reject all incoming calls
    }
});
```

---

## 6. Call Termination

### 6.1 User Hangs Up: `$("#hangupbtn").click()` (Line ~578)

```javascript
$("#hangupbtn").click(function() {
    if (cur_call) {
        // Send SIP BYE message to terminate
        cur_call.terminate();
        cur_call = null;
        resetOptionsTimer();
    }
    
    // Reset UI
    $("#br").show();
    $("#ext").show();
    $("#ext").val("");
    var span = document.getElementById('calling');
    span.innerText = "...";
});
```

### 6.2 Remote Party Hangs Up: `onTerminated()` (Line ~120)

When remote party sends SIP BYE:

```javascript
function onTerminated() {
    audioElement.pause();
    console.log('Onterminated');
    
    // Hide in-call UI
    $("#signin").hide();
    $("#dial").show();
    $("#incall").hide();
    
    // Reset call state
    $("#ext").val("");
    if (cur_call) {
        cur_call.terminate();
        cur_call = null;
    }
    isOnMute = false;
    incomingsession = null;
    isIncomingCall = false;
}
```

### 6.3 Call Cancelled: `onCancelled()` (Line ~109)

When remote party cancels before you answer:

```javascript
function onCancelled() {
    audioElement.pause();
    $("#isIncomingcall").hide();
    $("#isNotIncomingcall").show();
    incomingsession = null;
}
```

---

## 7. Presence & BLF (Busy Lamp Field)

### 7.1 What is BLF?

BLF shows the status of other extensions (busy/idle/on-call) as visual indicators.

### 7.2 BLF Button Clicked

```javascript
$("#pres" + mycountpres + "btn").click(function() {
    if (cur_call) {
        // Already on a call - transfer to this person
        cur_call.dtmf(extension_number, dtmf_options);
    } else {
        // Not on call - dial this person
        $("#ext").val(blf_extension_number);
        docall();
    }
});
```

### 7.3 Presence Updates

```javascript
presence_array[i].on('notify', function(notification) {
    // notification contains presence state
    // States: "busy", "idle", "on the phone", etc.
    
    // Update button color based on state
    // Green = Available
    // Red = Busy/On Call
    // Gray = Unknown
});
```

---

## 8. Key Global Variables (State Management)

| Variable | Purpose |
|----------|---------|
| `cur_call` | Current active SIP session object |
| `ua` | SIP User Agent (handles all SIP protocol) |
| `incomingsession` | Incoming call waiting for answer |
| `isRegistered` | True if logged in and registered with server |
| `isIncomingCall` | True if current call is incoming |
| `isOutboundCall` | True if current call is outgoing |
| `isOnMute` | True if microphone is muted |
| `isOnHold` | True if call is on hold |
| `isDnd` | Do Not Disturb - reject all calls |
| `isNoRing` | Silent ring - don't play ringtone |
| `isAutoAnswer` | Automatically answer all calls |
| `isRecording` | Call recording enabled |
| `audioElement` | HTML audio element for ringtone/hold music |
| `presence_array` | Array of BLF subscription objects |

---

## 9. Event Flow Diagram

### Incoming Call Flow:
```
Incoming INVITE from SIP server
        ↓
   ua.on('invite', handleInvite)
        ↓
   Check: Already on call? → YES → Reject (486 Busy)
   Check: DND enabled? → YES → Reject (486 Busy)
        ↓
   Display "CALL FROM: John (1020)" on screen
   Play ringtone (unless NoRing enabled)
   Show Answer/Reject buttons
        ↓
   User clicks ANSWER?
        ↓
   incomingsession.accept()
   Transfer to cur_call
   Show in-call controls
```

### Outgoing Call Flow:
```
User types "1020" and clicks CALL
        ↓
   $("#callbtn").click() → docall()
        ↓
   ua.invite("1020")
        ↓
   Waiting for response from SIP server...
        ↓
   Remote phone receives INVITE
        ↓
   Remote answers?
        ↓
   cur_call.on('accepted', onAccepted)
        ↓
   Audio streams established
   Show in-call controls (Mute, Hold, Transfer, DTMF)
```

---

## 10. Key Functions Summary

| Function | Line | Purpose |
|----------|------|---------|
| `init()` | 860 | Initialize SIP.js UA and connect to server |
| `docall()` | 472 | Make outgoing call (INVITE) |
| `handleInvite(s)` | 421 | Incoming call handler |
| `onAccepted()` | 147 | Call established, show controls |
| `onTerminated()` | 120 | Call ended, show dial pad |
| `onRegistered()` | 225 | Successfully registered, load BLF |
| `handleNotify(r)` | 345 | Handle presence/BLF notifications |
| `beep()` | 62 | Generate DTMF audio tone |

---

## 11. Audio Flow

### Making DTMF (Button Presses)

```
User presses "5" button
   ↓
cur_call.dtmf("5", dtmf_options)
   ↓
SIP.js generates RFC 2833 RTP event
   ↓
Sent to remote party as in-band tone
   ↓
Remote phone receives DTMF digit
```

### Ringtone/Hold Music

```javascript
audioElement = document.createElement('audio');
// In handleInvite:
audioElement.currentTime = 0;
audioElement.play();
```

The `audioElement` is an HTML audio object that plays server-provided ringtone or hold music.

---

## 12. Keyboard Support

### During Dial (No Active Call):
```javascript
$(document).keypress(function(event) {
    var key = String.fromCharCode(event.keyCode);
    
    if (isRegistered && !cur_call) {
        if (key == "0") $("#ext0btn").click();    // Add 0 to dial
        if (key == "1") $("#ext1btn").click();    // Add 1 to dial
        // ...
    }
});
```

### During Active Call:
```javascript
if (isRegistered && cur_call) {
    if (key == "1") cur_call.dtmf("1", dtmf_options);  // Send DTMF
    if (key == "*") cur_call.dtmf("*", dtmf_options);
    if (key == "#") cur_call.dtmf("#", dtmf_options);
}
```

---

## 13. Error Handling

### Call Failed:
```javascript
cur_call.once('failed', function(response, cause) {
    // response.status_code: SIP error code
    // cause: Human-readable reason
    
    // Display to user:
    // "486: Busy" - Extension busy
    // "408: Request Timeout" - No answer
    // "404: Not Found" - Wrong extension
    onTerminated(cur_call);
});
```

### Network Disconnected:
```javascript
ua.on('disconnected', function() {
    tempAlert("NETWORK DISCONNECTED...");
    // WebSocket connection lost
    // User should try to reconnect
});
```

---

## 14. Configuration (From Form)

All settings entered in login form:

| Field | Default | Purpose |
|-------|---------|---------|
| Login | 1010 | Extension number (SIP username) |
| Password | (blank) | SIP password for authentication |
| Display Name | Giovanni Maruzzelli | What others see as caller ID |
| Domain | fusion03-pkg.opentelecom.it | SIP domain/realm |
| WSS Proxy | fusion03-pkg.opentelecom.it | WebSocket server hostname |
| Port | 7443 | WSS port (must use 7443 for secure) |
| BLF1-6 | 1011-1016 | Extension numbers to monitor |

---

## Summary: Complete Call Journey

```
1. User logs in with credentials
   ↓
2. SIP.js registers with server via WSS
   ↓
3. Dial pad appears, BLF subscriptions loaded
   ↓
4a. USER DIALS:                  4b. INCOMING CALL:
   User enters number             Remote sends INVITE
   Clicks CALL button          ← or →   UI shows "CALL FROM: John"
   docall() creates INVITE         User clicks ANSWER
   Waiting...                       incomingsession.accept()
   Remote answers?                 Audio connected
   Audio stream starts             In-call controls shown
   ↓                               ↓
5. ACTIVE CALL                  5. ACTIVE CALL
   Can: Mute, Hold, Transfer       Can: Mute, Hold, Transfer
   Can: Send DTMF, Record         Can: Send DTMF, Record
   ↓                               ↓
6. CALL ENDS                    6. CALL ENDS
   User clicks HANGUP          ← or →   Remote hangs up
   cur_call.terminate()            onTerminated() triggered
   cur_call = null                 UI resets
   Back to dial pad                Back to dial pad
```

---

## Key Takeaway

**All SIP protocol logic is handled by SIP.js library.** Your app just:
1. Initializes the UA with credentials
2. Listens for events (invite, accepted, bye, cancel, failed)
3. Updates the UI based on call state
4. Calls SIP.js methods (invite, dtmf, mute, hold, terminate)

The browser handles all WebRTC audio codec negotiation, encryption, and media streaming behind the scenes!

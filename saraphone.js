/*
   SaraPhone
   Version: MPL 1.1

   The contents of this file are subject to Mozilla Public License Version
   1.1 (the "License"); you may not use this file except in compliance with
   the License. You may obtain a copy of the License at
   http://www.mozilla.org/MPL/

   Software distributed under the License is distributed on an "AS IS" basis,
   WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
   for the specific language governing rights and limitations under the
   License.

   The Original Code is SaraPhone

   The Initial Developer of the Original Code is
   Giovanni Maruzzelli <gmaruzz@opentelecom.it>
   Portions created by the Initial Developer are Copyright (C) 2020
   the Initial Developer. All Rights Reserved.

   SaraPhone gets its name from Giovanni's wife, Sara.

   Author(s):
   Giovanni Maruzzelli <gmaruzz@opentelecom.it>
   Danilo Volpinari
   Luca Mularoni
 */
// import { loginAgent } from './api.js';

'use strict';

var cur_call = null;
var ua;
var which_server;
var isAndroid = false;
var isIOS = false;
var isOnMute = false;
var isOnHold = false;
var clicklogin = "no";
var isRecording = false;
var isDnd = false;
var isNoRing = false;
var isAutoAnswer = false;
var isRegistered = false;
var vmail_subscription = false;
var presence_array = new Array();
var incomingsession = null;
var audioElement = document.createElement('audio');
var callTimer;
var oldext = false;
var gotopanel = false;
var isIncomingCall = false;
var isOutboundCall = false;
var globalLogin = "";
var globalPassword = "";
var ringingAudio = new Audio('mp3/classical_tone.mp3');
var callStartTime = null;
var callTimerInterval = null;
var activeCampaignId = null;
var currentCampaigns = [];
var currentAgentId = null;

function stopRingingAudio() {
    ringingAudio.pause();
    ringingAudio.loop = false;
    ringingAudio.currentTime = 0;
    audioElement.pause();
    audioElement.currentTime = 0;
}

const BACKEND_URL = "http://localhost:8005" 
const WS_URL = "wss://192.168.0.25/ws/agent";

let socket = null;

function connectAgentWebSocket(agentId) {
    socket = new WebSocket(`${WS_URL}/${agentId}/`);

    socket.onopen = () => {
        console.log(`[WS] Connected as agent ${agentId}`);
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log(`[WS] Event received:`, data);
        handleAgentEvent(data);
    };

    socket.onclose = (event) => {
        console.log(`[WS] Disconnected: ${event.code}`);
        // Auto reconnect after 3 seconds
        setTimeout(() => connectAgentWebSocket(agentId), 3000);
    };

    socket.onerror = (error) => {
        console.error(`[WS] Error:`, error);
    };
}

function handleAgentEvent(data) {
    switch (data.event) {
        case "ringing":
            if (cur_call) {
                return;
            }

            console.log("Call ringing:");
            displayCallStatus("ringing");
            break;
        case "call_ended":
            console.log("Call ended:", data.data);
            if (!cur_call) {
                displayCallStatus("ended");
            }
            break;
        case "call_connected":
            console.log("Call connected:", data.data);
            hideCallStatus();
            break;
        default:
            console.log("Unknown event:", data);
    }
}

function disconnectAgentWebSocket() {
    if (socket) {
        socket.close();
        socket = null;
    }
}

function displayCallStatus(status) {
    function tryDisplay() {
        const statusHeader = document.getElementById('call_status_header');
        const statusText = document.getElementById('call_status_text');
        
        // if (!statusHeader || !statusText) {
        //     setTimeout(tryDisplay, 100);
        //     return;
        // }
        if (cur_call) {
            return;
        }
        
        if (status === 'ringing') {
            // Stop any existing audio first
            stopRingingAudio();
            ringingAudio.currentTime = 0;
            
            // Play ringing sound
            ringingAudio.loop = true;
            ringingAudio.play().catch(e => console.log('Audio play failed:', e));
        } else if (status === 'ended') {
            // Auto hide after 3 seconds
            stopRingingAudio();

            setTimeout(() => {
                hideCallStatus();
            }, 3000);
        }
    }
    
    tryDisplay();
}

function hideCallStatus() {
    function tryHide() {
        stopRingingAudio();

        const statusHeader = document.getElementById('call_status_header');
        const statusText = document.getElementById('call_status_text');
        
        if (!statusHeader || !statusText) {
            return;
        }
        
        statusHeader.style.display = 'none';
        statusText.innerText = '';
    }
    
    tryHide();
}

function populateCustomerAdminLinks(phoneNumber) {
    const linksContainer = document.getElementById('customerAdminLinks');
    const emiUserLink = document.getElementById('emiUserLink');
    const accountProfileLink = document.getElementById('accountProfileLink');
    const userDocLink = document.getElementById('userDocLink');

    if (!linksContainer || !emiUserLink || !accountProfileLink || !userDocLink) {
        return;
    }

    if (!phoneNumber) {
        linksContainer.style.display = 'none';
        return;
    }

    const encodedPhoneNumber = encodeURIComponent(phoneNumber);
    emiUserLink.href = 'https://udhaar-api.oscar.pk/admin/telecard/emicampaignuser/?q=' + encodedPhoneNumber + '&o=-9';
    accountProfileLink.href = 'https://rnp-api.oscar.pk/admin/emi/accountopening/?q=' + encodedPhoneNumber;
    userDocLink.href = 'https://udhaar-api.oscar.pk/admin/udhaar/userdocs/?q=' + encodedPhoneNumber;
    linksContainer.style.display = 'flex';
}

function startCallTimer() {
    callStartTime = new Date();
    const timerElement = document.getElementById('call_timer');
    if (timerElement) {
        timerElement.style.display = 'block';
    }
    updateCallTimer();
    callTimerInterval = setInterval(updateCallTimer, 1000);
}

function stopCallTimer() {
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }
    // Keep callStartTime so the final time remains displayed
    // callStartTime = null; // Don't reset this so timer shows final time
}

function updateCallTimer() {
    if (!callStartTime) return;
    
    const now = new Date();
    const elapsed = Math.floor((now - callStartTime) / 1000);
    
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    
    const timerElement = document.getElementById('call_timer');
    if (timerElement) {
        timerElement.textContent = 
            String(hours).padStart(2, '0') + ':' + 
            String(minutes).padStart(2, '0') + ':' + 
            String(seconds).padStart(2, '0');
    }
}

function resetCallTimer() {
    stopCallTimer();
    callStartTime = null; // Now reset it
    const timerElement = document.getElementById('call_timer');
    if (timerElement) {
        timerElement.style.display = 'none';
        timerElement.textContent = '00:00:00';
    }
}

async function loginAgent(username, password) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/dialer/agent/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json().catch(function() {
      return {};
    });

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Login failed. Please try again.'
      };
    }

    return data;
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      message: 'Network error while logging in.'
    };
  }
}

function showLoginMessage(success, message) {
    const messageEl = document.getElementById('loginMessage');

    if (!messageEl) {
        return;
    }

    messageEl.textContent = message || (success ? 'Login successful.' : 'Login failed.');
    messageEl.className = 'customer-form-message ' + (success ? 'is-success' : 'is-error');
    messageEl.style.display = 'block';
}

async function logoutAgent() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/dialer/agent/logout/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
        console.log('error logging out agent');
      return null; // Return null for HTTP errors (e.g., 401, 404)
    }
    console.log('agent logged out successfully');
    const data = await response.json();
    return data; // Return the response data
  } catch (error) {
    console.error('Logout error:', error);
    return null; // Return null for network errors
  }
}

async function activateCampaign(campaign) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/dialer/agent/campaign/activate/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: campaign.id,
        campaign_id: campaign.campaign_id,
        agent_id: currentAgentId
      }),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Campaign activation error:', error);
    return null;
  }
}

async function submitCustomerForm(formData) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/dialer/form-submission/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });
    const data = await response.json().catch(function() {
      return {};
    });

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Could not submit form. Please try again.'
      };
    }

    return data;
  } catch (error) {
    console.error('Form submission error:', error);
    return {
      success: false,
      message: 'Network error while submitting form.'
    };
  }
}

function showCustomerFormMessage(success, message) {
    const messageEl = document.getElementById('customerFormMessage');

    if (!messageEl) {
        return;
    }

    messageEl.textContent = message || (success ? 'Form submitted successfully.' : 'Could not submit form.');
    messageEl.className = 'customer-form-message ' + (success ? 'is-success' : 'is-error');
    messageEl.style.display = 'block';
}

function getCampaignKey(campaign) {
    return campaign && (campaign.id || campaign.campaign_id);
}

function getActiveCampaignKey(campaigns) {
    const activeCampaign = campaigns.find(function(campaign) {
        return campaign && campaign.active === true;
    });

    return getCampaignKey(activeCampaign);
}

function renderCampaignButtons(campaigns) {
    const switcher = document.getElementById('campaignSwitcher');
    const buttons = document.getElementById('campaignButtons');

    if (!switcher || !buttons) {
        return;
    }

    buttons.innerHTML = '';
    currentCampaigns = Array.isArray(campaigns) ? campaigns : [];
    activeCampaignId = getActiveCampaignKey(currentCampaigns);

    if (!currentCampaigns.length) {
        switcher.style.display = 'none';
        return;
    }

    currentCampaigns.forEach(function(campaign) {
        const button = document.createElement('button');
        const campaignKey = getCampaignKey(campaign);
        const title = campaign.segment || campaign.campaign_id || ('Campaign ' + campaign.id);
        const count = campaign.count !== undefined && campaign.count !== null ? campaign.count + ' leads' : '';
        const meta = [campaign.campaign_id, count].filter(Boolean).join(' / ');

        button.type = 'button';
        button.className = 'campaign-button' + (campaignKey === activeCampaignId ? ' is-active' : '');
        button.dataset.campaignKey = campaignKey;
        button.title = meta ? title + ' - ' + meta : title;
        button.innerHTML = '<span class="campaign-button-title"></span><span class="campaign-button-meta"></span>';
        button.querySelector('.campaign-button-title').textContent = title;
        button.querySelector('.campaign-button-meta').textContent = meta || 'Campaign';

        button.addEventListener('click', function() {
            setActiveCampaign(campaign, button);
        });

        buttons.appendChild(button);
    });

    switcher.style.display = 'block';
}

async function setActiveCampaign(campaign, button) {
    const campaignKey = getCampaignKey(campaign);

    if (!campaignKey || campaignKey === activeCampaignId) {
        return;
    }

    if (button) {
        button.classList.add('is-loading');
        button.disabled = true;
    }

    const result = await activateCampaign(campaign);

    if (!result) {
        if (button) {
            button.classList.remove('is-loading');
            button.disabled = false;
        }
        alert('Could not activate campaign. Please try again.');
        return;
    }

    activeCampaignId = campaignKey;
    currentCampaigns = currentCampaigns.map(function(item) {
        const isActive = getCampaignKey(item) === campaignKey;
        return Object.assign({}, item, { active: isActive });
    });

    if (Array.isArray(result.campaigns)) {
        currentCampaigns = result.campaigns.map(function(item) {
            const isClickedCampaign = getCampaignKey(item) === campaignKey;
            return Object.assign({}, item, { active: isClickedCampaign || item.active === true });
        });
    }

    renderCampaignButtons(currentCampaigns);
}

var dtmf_options = {
  'duration': 100,
  'interToneGap': 100
};

function tempAlert(msg,duration)
{
     var el = document.createElement("div");
     el.setAttribute("style","position:absolute;top:1%;left:1%;background-color:red;foreground-color:black;");
     el.innerHTML = msg;
     setTimeout(function(){
      el.parentNode.removeChild(el);
      location.reload(true);
     },duration);
     document.body.appendChild(el);
    console.error("TEMPALERT");
}



function onCancelled() {
    stopRingingAudio();
    console.log('cancelled');
    $("#isIncomingcall").hide();
    $("#isNotIncomingcall").show();
    incomingsession = null;
    var span = document.getElementById('calling');
    $("#calling_input").val("");
    span.innerText = "...";
}

function onTerminated() {
    stopRingingAudio();
    console.log('Onterminated');
    $("#signin").hide();
    $("#dial").show();
    $("#incall").hide();
    $("#ext").val("");
    if (cur_call) {
        cur_call.terminate();
        cur_call = null;
        resetOptionsTimer();
    }
    isOnMute = false;

    incomingsession = null;

    var span = document.getElementById('calling');
    $("#calling_input").val("");
    span.innerText = "...";

    // Stop the call timer
    stopCallTimer();
}

function onTerminated2() {
    stopRingingAudio();
    console.log('Onterminated2');
    cur_call = null;
    incomingsession = null;
    stopCallTimer();
}

function onAccepted() {
    stopRingingAudio();

    $("#signin").hide();
    $("#dial").hide();
    $("#incall").show();

    isOnMute = false;
    $("#mutebtn").removeClass('btn-danger').addClass('btn-warning');

    // Start the call timer
    startCallTimer();
}

$("#asknotificationpermission").click(function() {
    if (isIOS) {
        //do nothing
    } else {
        // Let's check if the browser supports notifications
        if (!("Notification" in window)) {
            alert("This browser does not support desktop notification");
        }

        // Otherwise, we need to ask the user for permission
        // Note, Chrome does not implement the permission static property
        // So we have to check for NOT 'denied' instead of 'default'
        else if (Notification.permission !== 'denied') {
            Notification.requestPermission(function(permission) {

                // Whatever the user answers, we make sure we store the information
                if (!('permission' in Notification)) {
                    Notification.permission = permission;
                }

                // If the user is okay, let's create a notification
                if (permission === "granted") {
                    console.log("Notification Permission Granted!");
                    var notification = new Notification("Notification Permission Granted!");
                    $("#asknotificationpermission").hide();
                }
            });
        } else {
            alert(`Permission is ${Notification.permission}`);
        }

    }
});


function notifyMe(msg) {
    if (isIOS) {
        //do nothing
    } else {
        if (Notification.permission === "granted") {
            console.log(msg);
            let img = 'img/notification.png';
            let notification = new Notification('WebPhone', {
                body: msg,
                icon: img
            });
            notification.onclick = function() {
                parent.focus();
                window.focus();
                this.close();
            };
            notification.onclose = function() {
                parent.focus();
                window.focus();
                this.close();
            };
            notification.onerror = function() {
                parent.focus();
                window.focus();
                this.close();
            };
        }
    }
}


function onRegistered() {
    if (isIOS) {
        //do nothing
    } else {
        if (Notification.permission === "granted") {
            $("#asknotificationpermission").hide();
        }
    }

    $("#signin").hide();
    $("#dial").show();
    $("#incall").hide();
    $("#ext").val("");
    var span = document.getElementById('calling');
    $("#calling_input").val("");
    span.innerText = "...";

    var span = document.getElementById('whoami');
    var txt = document.createTextNode($("#login").val());
    span.innerText = txt.textContent + " (" + $("#yourname").val() + ")";

    isRegistered = true;


    var countpres = 1;

    while (countpres < 61) {
        if ($("#pres" + countpres).val()) {
            presence_array[countpres] = ua.subscribe($("#pres" + countpres).val(), 'presence', {
                expires: 120
            });

            const mycountpres = countpres;
            presence_array[countpres].on('notify', function(notification) {
                //console.log(notification.request.body);

                var presence = notification.request.body.match(/<dm:note>(.*)<\/dm:note>/i);
                if (presence) {
                    var ispresent = presence[1];

                    if (ispresent.match(/unregistered/i)) {
                        $("#pres" + mycountpres + "btn").removeClass('btn-success btn-warning btn-default btn-danger').addClass('btn-danger');
                    } else {
                        if (ispresent.match(/available/i) || ispresent.match(/closed/i)) {
                            $("#pres" + mycountpres + "btn").removeClass('btn-success btn-warning btn-default btn-danger').addClass('btn-success');

                        } else {
                            $("#pres" + mycountpres + "btn").removeClass('btn-success btn-warning btn-default btn-danger').addClass('btn-warning');
                        }
                    }

                    var span = document.getElementById('ispresent' + mycountpres);
                    $("#pres" + mycountpres + "_label").val($("#pres" + mycountpres + "_label").val().substr(0, 10));
                    if (ispresent.match(/available/i) || ispresent.match(/closed/i)) {
                        span.innerText = $("#pres" + mycountpres + "_label").val();
                    } else {
                        span.innerText = $("#pres" + mycountpres + "_label").val() + ": " + ispresent;
                    }
                }

            });



            $("#pres" + mycountpres + "btn").click(function() {
                $("#ext").val($("#pres" + mycountpres).val());
		oldext=$("#ext").val();
                docall();
            });



        } else {

            $("#pres" + countpres + "btn").remove();

        }
        countpres++;
    }

    $("#webphone_blf").show();


    // Once subscribed, receive notifications and handle
    vmail_subscription = ua.subscribe($("#login").val() + '@' + $("#domain").val(), 'message-summary', {
        extraHeaders: ['Accept: application/simple-message-summary'],
        expires: 120
    });
    vmail_subscription.on('notify', handleNotify);

    if (isAndroid || isIOS) {
        $("#calling_input").hide();
    }
}

$("#checkvmailbtn").click(function() {
    $("#extstarbtn").click();
    $("#ext9btn").click();
    $("#ext8btn").click();
    $("#callbtn").click();
});

$("#gotopanel1").click(async function() {
    await logoutAgent()
    gotopanel = true;
    console.error("GOTOPANEL1");
    window.location.assign('/');
});

$("#gotopanel2").click(async function() {
    await logoutAgent()
    gotopanel = true;
    console.error("GOTOPANEL2");
    window.location.assign('/');
});

$("#gotopanel3").click(async function() {
    await logoutAgent()
    gotopanel = true;
    console.error("GOTOPANEL3");
    window.location.assign('/');
});

function handleNotify(r) {
    //console.log(r.request.method);
    //console.log(r.request.body);

    var newMessages = 0;
    var oldMessages = 0;
    var span = document.getElementById('vmailcount');
    var gotmsg = r.request.body.match(/voice-message:\s*(\d+)\/(\d+)/i);
    if (gotmsg) {
        newMessages = parseInt(gotmsg[1]);
        oldMessages = parseInt(gotmsg[2]);
        if (newMessages) {
            $("#checkvmailbtn").removeClass('btn-info').addClass('btn-warning');

        } else {
            $("#checkvmailbtn").removeClass('btn-warning').addClass('btn-info');

        }
        span.innerText = newMessages + "/" + oldMessages;
    }


}


$("#anscallbtn").click(function() {
    stopRingingAudio();
    cur_call = incomingsession;
    incomingsession.accept({
        media: {
            constraints: {
                audio: {
                    deviceId: {
                        ideal: $("#selectmic").val()
                    }
                },
                video: false
            },
            render: {
                remote: document.getElementById('audio')
            }
        }
    });
    console.log('All Headers:', incomingsession.request.headers);
    console.log('answered');

    $("#isIncomingcall").hide();
    $("#isNotIncomingcall").show();
    var span = document.getElementById('speakingwith');
    var txt = document.createTextNode(cur_call.remoteIdentity.displayName.toString());
    span.innerText = txt.textContent + " (" + cur_call.remoteIdentity.uri.user.toString() + ")";
    // var txt = document.createTextNode(callTimerInterval.toString());
    // span.innerText = txt.textContent;

    cur_call.on('accepted', onAccepted.bind(cur_call));
    cur_call.once('bye', onTerminated.bind(cur_call));
    cur_call.once('failed', onTerminated.bind(cur_call));
    cur_call.once('cancel', onTerminated.bind(cur_call));
    cur_call.once('terminated', onTerminated2.bind(cur_call));
});


$("#rejcallbtn").click(function() {
    stopRingingAudio();
    incomingsession.reject({
        statusCode: '486',
        reasonPhrase: 'Busy Here 1'
    });
    console.log('rejected');
    $("#isIncomingcall").hide();
    $("#isNotIncomingcall").show();
    var span = document.getElementById('calling');
    $("#calling_input").val("");
    span.innerText = "...";
    incomingsession = null;
    document.getElementById("customerDataForm").reset();
});



function handleInvite(s) {
    // Reset the call timer display when a new invite is received
    resetCallTimer();
    stopRingingAudio();
    
    if (cur_call) {
        s.reject({
            statusCode: '486',
            reasonPhrase: 'Busy Here 2'
        });
    }
    if (isDnd) {
        s.reject({
            statusCode: '486',
            reasonPhrase: 'Busy Here 3'
        });
    } else {
        if (!cur_call) {
            var span = document.getElementById('calling');
            var txt = "---";
            isIncomingCall = true;
            isOutboundCall = false;
	    if(s.remoteIdentity.displayName && s.remoteIdentity.displayName.toString()) {
            	txt = document.createTextNode(s.remoteIdentity.displayName.toString());
	    }
            span.innerText = "CALL FROM: " + txt.textContent + " (" + s.remoteIdentity.uri.user.toString() + ")";
            incomingsession = s;
            const rawHeaders = incomingsession.request.headers;
            const callData = {};
                
            // 2. Loop through and extract values
            Object.keys(rawHeaders).forEach(key => {
                // We take the first element [0] and its 'raw' property
                if (rawHeaders[key] && rawHeaders[key].length > 0) {
                    callData[key] = rawHeaders[key][0].raw;
                }
            });
            $("#customerDataCard").show()

            $("#isIncomingcall").show();
            $("#isNotIncomingcall").hide();
            incomingsession.once('cancel', onCancelled.bind(incomingsession));
            const fieldMapping = {
                'X-Phone-Number': 'phone_number',
                'X-Customer-Name': 'customer_name',
                'X-City': 'city',
                'X-Campaign-Segment': 'customer_segment',
                'X-Month-Gmv': 'month_gmv',
                'X-Overall-Gmv': 'overall_gmv',
                'X-Last-Call-Date': 'last_call_date',
                'X-Last-Order-Item': 'last_order_item',
                'X-Last-Order-Amount': 'last_order_amount'
            };
        
            // 3. Fill the fields automatically
            Object.keys(fieldMapping).forEach(headerName => {
                const inputId = fieldMapping[headerName];
                const value = callData[headerName] || ""; // Default to empty string

                $(`#${inputId}`).val(value);
            });
            $("#followup_phone_number").val(callData['X-Phone-Number'] || "");
            populateCustomerAdminLinks(callData['X-Phone-Number'] || "");

            if (isIOS) {
                //do nothing
            } else {
                notifyMe("CALL FROM: " + txt.textContent + " (" + s.remoteIdentity.uri.user.toString() + ")");
            }
            
            $("#anscallbtn").trigger("click");

            // if (isNoRing == false) {
            //     audioElement.currentTime = 0;
            //     audioElement.play();
            // }
            // if (isAutoAnswer == true) {
            //     $("#anscallbtn").trigger("click");
            // }
        }
    }
}


function docall() {

    if (cur_call) {
        cur_call.terminate();
        cur_call = null;
        resetOptionsTimer();
    }

    isIncomingCall = false;
    isOutboundCall = true;

    cur_call = ua.invite($("#ext").val(), {
        media: {
            constraints: {
                audio: {
                    deviceId: {
                        ideal: $("#selectmic").val()
                    }
                },
                video: false
            },
            render: {
                remote: document.getElementById('audio')
            }
        }
    });

    cur_call.on('accepted', onAccepted.bind(cur_call));
    cur_call.once('failed', function(response, cause) {
        if (cause != "null") {
            console.log(cause);
        } else {
            cause = "N/A";
        }
        var span = document.getElementById('calling');
        onTerminated(cur_call);
        var txt = document.createTextNode(response.status_code + ": " + cause);
        span.innerText = txt.textContent;
    })

    cur_call.once('bye', function(request) {
        if (request.headers.Reason && !(request.headers.Reason["0"].raw.toString().match(/cause=16/)) && !(request.headers.Reason["0"].raw.toString().match(/cause=31/))) {
            console.log(request);
            var span = document.getElementById('calling');
            onTerminated(cur_call);
            var regex = /.*text="(.*)".*/;
            var txt = document.createTextNode(request.headers.Reason["0"].raw.toString().replace(regex, "$1"));
            span.innerText = txt.textContent;
        } else {
            onTerminated(cur_call);
        }
    })
    cur_call.once('cancel', onTerminated.bind(cur_call));

    var span = document.getElementById('speakingwith');
    var txt = document.createTextNode($("#ext").val());
    span.innerText = txt.textContent;
}


$("#dialctrlbtn").click(function() {
    var x = document.getElementById('dialadv1');
    if (x.style.display === 'none') {
        x.style.display = 'block';
    } else {
        x.style.display = 'none';
    }
    x = document.getElementById('dialadv2');
    if (x.style.display === 'none') {
        x.style.display = 'block';
    } else {
        x.style.display = 'none';
    }


});

$("#signinctrlbtn").click(function() {
    var x = document.getElementById('signinadv1');
    if (x.style.display === 'none') {
        x.style.display = 'block';
    } else {
        x.style.display = 'none';
    }
});



$("#callbtn").click(function() {
    if ($("#ext").val()) {
        var regex1 = /#/g;
        var new_ext = $("#ext").val().replace(regex1, "_");
        $("#ext").val(new_ext);
	oldext=$("#ext").val();
        docall();
    }
});

$("#delcallbtn").click(function() {
    $("#ext").val("");
    $("#calling_input").val("");
    var span = document.getElementById('calling');
    span.innerText = "...";

    $("#hangupbtn").trigger("click");
});


$("#hangupbtn").click(function() {
    if (cur_call) {
        cur_call.terminate();
        cur_call = null;
        resetOptionsTimer();
    }
    $("#br").show();
    $("#ext").show();
    $("#calling_input").val("");
    var span = document.getElementById('calling');
    span.innerText = "...";
});


$("#loginbtn").click(function() {
    init();
});

$("#xferbtn").click(function() {
   if(isOutboundCall==true){
        cur_call.dtmf("*499", dtmf_options);
    }else{
        cur_call.dtmf("*599", dtmf_options);
    }
});

$("#attxbtn").click(function() {
   if(isOutboundCall==true){
        cur_call.dtmf("*699", dtmf_options);
    }else{
        cur_call.dtmf("*799", dtmf_options);
    }
});

$("#mutebtn").click(function() {
    if (isOnMute) {
        cur_call.unmute();
        isOnMute = false;
        $(this).removeClass('btn-danger').addClass('btn-warning');
    } else {
        cur_call.mute();
        isOnMute = true;

        $(this).removeClass('btn-warning').addClass('btn-danger');
    }
});

$("#holdbtn").click(function() {
    if (isOnHold==false){
        isOnHold = true;
        if(isOutboundCall==true){
            cur_call.dtmf("*299", dtmf_options);
        }else{
            cur_call.dtmf("*399", dtmf_options);
        }
        $("#unholdbtn").show();
        console.error("HOLD begins");
    }
});

$("#unholdbtn").click(function() {
    if (isOnHold == true){
        isOnHold = false;
        $("#extstarbtn").click();
        $("#ext6btn").click();
        $("#ext5btn").click();
        $("#ext5btn").click();
        $("#callbtn").click();
        $("#unholdbtn").hide();
        console.error("HOLD ends");
    }
});

$("#redialbtn").click(function() {
    audioElement.pause();
    $("#ext").val(oldext);
    $("#callbtn").click();
});

$("#callbackbtn").click(function() {
    audioElement.pause();
    $("#extstarbtn").click();
    $("#ext6btn").click();
    $("#ext9btn").click();
    $("#callbtn").click();
});

$("#recordcallbtn").click(function() {
    if (isRecording) {
        cur_call.dtmf("*");
        cur_call.dtmf("2");
        isRecording = false;
        $(this).removeClass('btn-danger').addClass('btn-warning');
    } else {
        cur_call.dtmf("*");
        cur_call.dtmf("2");
        isRecording = true;

        $(this).removeClass('btn-warning').addClass('btn-danger');
    }
});

$("#dndbtn").click(function() {
    if (isDnd) {
        isDnd = false;
        $(this).removeClass('btn-danger').addClass('btn-warning');
    } else {
        isDnd = true;
        $(this).removeClass('btn-warning').addClass('btn-danger');
    }
});

$("#ringbtn").click(function() {
    if (isNoRing) {
        isNoRing = false;
        $(this).removeClass('btn-danger').addClass('btn-warning');
    } else {
        isNoRing = true;
        $(this).removeClass('btn-warning').addClass('btn-danger');
    }
});

$("#autoanswerbtn").click(function() {
    if (isAutoAnswer) {
        isAutoAnswer = false;
        $(this).removeClass('btn-danger').addClass('btn-warning');
    } else {
        isAutoAnswer = true;
        $(this).removeClass('btn-warning').addClass('btn-danger');
    }
});



$("#ext1btn").click(function() {
    $("#ext").val($("#ext").val() + "1");
    var span = document.getElementById('calling');
    var txt = document.createTextNode($("#ext").val());
    span.innerText = "DIALING: " + txt.textContent;
});

$("#ext2btn").click(function() {
    $("#ext").val($("#ext").val() + "2");
    var span = document.getElementById('calling');
    var txt = document.createTextNode($("#ext").val());
    span.innerText = "DIALING: " + txt.textContent;
});

$("#ext3btn").click(function() {
    $("#ext").val($("#ext").val() + "3");
    var span = document.getElementById('calling');
    var txt = document.createTextNode($("#ext").val());
    span.innerText = "DIALING: " + txt.textContent;
});

$("#ext4btn").click(function() {
    $("#ext").val($("#ext").val() + "4");
    var span = document.getElementById('calling');
    var txt = document.createTextNode($("#ext").val());
    span.innerText = "DIALING: " + txt.textContent;
});

$("#ext5btn").click(function() {
    $("#ext").val($("#ext").val() + "5");
    var span = document.getElementById('calling');
    var txt = document.createTextNode($("#ext").val());
    span.innerText = "DIALING: " + txt.textContent;
});

$("#ext6btn").click(function() {
    $("#ext").val($("#ext").val() + "6");
    var span = document.getElementById('calling');
    var txt = document.createTextNode($("#ext").val());
    span.innerText = "DIALING: " + txt.textContent;
});

$("#ext7btn").click(function() {
    $("#ext").val($("#ext").val() + "7");
    var span = document.getElementById('calling');
    var txt = document.createTextNode($("#ext").val());
    span.innerText = "DIALING: " + txt.textContent;
});

$("#ext8btn").click(function() {
    $("#ext").val($("#ext").val() + "8");
    var span = document.getElementById('calling');
    var txt = document.createTextNode($("#ext").val());
    span.innerText = "DIALING: " + txt.textContent;
});

$("#ext9btn").click(function() {
    $("#ext").val($("#ext").val() + "9");
    var span = document.getElementById('calling');
    var txt = document.createTextNode($("#ext").val());
    span.innerText = "DIALING: " + txt.textContent;
});

$("#ext0btn").click(function() {
    $("#ext").val($("#ext").val() + "0");
    var span = document.getElementById('calling');
    var txt = document.createTextNode($("#ext").val());
    span.innerText = "DIALING: " + txt.textContent;
});

$("#extstarbtn").click(function() {
    $("#ext").val($("#ext").val() + "*");
    var span = document.getElementById('calling');
    var txt = document.createTextNode($("#ext").val());
    span.innerText = "DIALING: " + txt.textContent;
});

$("#extpoundbtn").click(function() {
    $("#ext").val($("#ext").val() + "#");
    var span = document.getElementById('calling');
    var txt = document.createTextNode($("#ext").val());
    span.innerText = "DIALING: " + txt.textContent;
});

$("#dtmf1btn").click(function() {
    cur_call.dtmf("1", dtmf_options);
});

$("#dtmf2btn").click(function() {
    cur_call.dtmf("2", dtmf_options);
});

$("#dtmf3btn").click(function() {
    cur_call.dtmf("3", dtmf_options);
});

$("#dtmf4btn").click(function() {
    cur_call.dtmf("4", dtmf_options);
});

$("#dtmf5btn").click(function() {
    cur_call.dtmf("5", dtmf_options);
});

$("#dtmf6btn").click(function() {
    cur_call.dtmf("6", dtmf_options);
});

$("#dtmf7btn").click(function() {
    cur_call.dtmf("7", dtmf_options);
});

$("#dtmf8btn").click(function() {
    cur_call.dtmf("8", dtmf_options);
});

$("#dtmf9btn").click(function() {
    cur_call.dtmf("9", dtmf_options);
});

$("#dtmf0btn").click(function() {
    cur_call.dtmf("0", dtmf_options);
});

$("#dtmfstarbtn").click(function() {
    cur_call.dtmf("*", dtmf_options);
});

$("#dtmfpoundbtn").click(function() {
    cur_call.dtmf("#", dtmf_options);
});


function resetOptionsTimer() {
/*
    window.clearTimeout(callTimer);

    callTimer = window.setTimeout(function() {
        console.error("NETWORK DISCONNECT, NO OPTIONS SINCE 25000 msec");
        beep(1000, 2);
        if (cur_call) {
            alert("NETWORK DISCONNECT, CLICK OK TO PROCEED");
        }
        $("#hangupbtn").trigger("click");
        if (gotopanel == false){
            location.reload();
        }
    }, 25000);
*/
}

function populateUserRows(data) {
    const table = document.getElementById('config');
    let count = 1;
    data.forEach(user => {
        // Template for the new rows
        const rows = `
            <tr> 
                <td><input style="background-color: black;" size=25 id="pres${count}" value="${user.extension}" /></td><td>&nbsp;BLF${count}&nbsp;</td>
            </tr> 
            <tr> 
                <td><input style="background-color: black;" size=25 id="pres${count}_label" value="${user.user__username}" /></td><td>&nbsp;BLF${count}&nbsp;Label</td>
            </tr>
            `;
        count += 1;
        // Append the rows to the end of the table
        //// <tr><td colspan="2"><hr style="border-color: #333;"></td></tr>
        table.insertAdjacentHTML('beforeend', rows);
    });
}

function populatePresenceSpans(data) {
    let count = 1;
    data.forEach(user => {
        // Find the span with id="ispresent1", "ispresent2", etc.
        const span = document.getElementById(`ispresent${count}`);
        
        if (span) {
            // Set the content. You can change 'Available' to 
            // whatever status value you have (e.g., user.status)
            span.textContent = user.user__username
            
            // Optional: Add a class for styling (green for online, red for offline)
            // span.style.color = user.is_online ? "#00FF00" : "#FF0000";
        }
        
        count += 1;
    });
}

async function init() {
    
    var nameDomain;
    var nameProxy;
    var uri;
    var password;
    var login;
    var yourname;
    var wssport;

    cur_call = null;
    resetOptionsTimer();
    yourname = $("#yourname").val();
    nameDomain = $("#domain").val();
    nameProxy = $("#proxy").val();
    wssport = $("#port").val();
    which_server = "wss://" + nameProxy + ":" + wssport;

    if (yourname === "") {
        yourname = $("#login").val();
    }

    login = $("#login").val();
    password = $("#passwd").val();
    var extension;
    var fs_password;
    var agent_id;
    var userData;
    var campaigns;

    $("#loginMessage").hide();
    const result = await loginAgent(login, password);
    if (result && result.success === true) {
      showLoginMessage(true, result.message);
      extension = result.extension;
    //   var uri = extension + "@" + nameDomain;
      fs_password = result.password;
      agent_id = result.id;  
      currentAgentId = agent_id;
      userData = result.agents_info;
      campaigns = result.campaigns;
    } else {
      showLoginMessage(false, result && result.message);
      return
    }

    connectAgentWebSocket(agent_id);

    renderCampaignButtons(campaigns);

    populateUserRows(userData);
    populatePresenceSpans(userData)

    console.log(extension, fs_password, agent_id);
    uri = extension + "@" + nameDomain;

    console.error("uri: " + uri);
    

    ua = new SIP.UA({
        wsServers: which_server,
        uri: uri,
        password: fs_password,
        userAgentString: 'SIP.js/0.7.8 SaraPhone 04',
        traceSip: true,
        displayName: yourname,
        iceCheckingTimeout: 1000,
        registerExpires: 120,
        allowLegacyNotifications: true,
        hackWssInTransport: true,
        wsServerMaxReconnection: 5000,
        wsServerReconnectionTimeout: 1,
        connectionRecoveryMaxInterval: 3,
        connectionRecoveryMinInterval: 2,
        log: {
            level: 2,
            connector: function(level, category, label, content) {
                var str = content;
                var patt2 = new RegExp("WebSocket abrupt disconnection");
                var res2 = patt2.exec(str);
/*
                var patt = new RegExp("OPTIONS sip");
                var res = patt.exec(str);

                if (res) {
                    resetOptionsTimer();
                }
*/
                if (res2) {
                    if (gotopanel == false){
                        console.error('WebSocket ABRUPT DISCONNECTION');
			tempAlert("- WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - ",10000);
                    }
                }
            },
        }
    });

    ua.on('notify', handleNotify);
    ua.on('invite', handleInvite);
    ua.on('disconnected', function() {
        console.error('DISCONNECTED');
        //alert("DO YOU HAVE AUTHORIZED SSL CERTS FOR PORT 7443 ???? - READ THE README! :) - NETWORK DISCONNECT, CLICK OK TO PROCEED");
        if (gotopanel == false){
		tempAlert("- NETWORK DISCONNECTED - NETWORK DISCONNECTED - NETWORK DISCONNECTED - NETWORK DISCONNECTED - DO YOU HAVE WSS PORT OPEN ON FIREWALL? DO YOU HAVE AUTHORIZED SSL CERTS? AND YOUR WSS CERTS, ARE AUTHORIZED? - READ THE README! :) - NETWORK DISCONNECTED - NETWORK DISCONNECTED - NETWORK DISCONNECTED - NETWORK DISCONNECTED - ",60000);
        }
    });

    $("#isIncomingcall").hide();

    $(document).keyup(function(event) {
        if (event.keyCode == 13 && !event.shiftKey) {
            if (isRegistered) {
                if (cur_call) {} else {
                    $("#callbtn").trigger("click");
                }
            }
        }
    });

    $(document).keypress(function(event) {
        var key = String.fromCharCode(event.keyCode || event.charCode);
        var i = parseInt(key);
        var tag = event.target.tagName.toLowerCase();
        if (isRegistered) {
            if (cur_call) {
                if (key === "#" || key === "*" || key === "0" || (i > 0 && i <= 9)) {
                    cur_call.dtmf(key, dtmf_options);
                }
            } else {

                if (key === "#" || key === "*" || key === "0" || (i > 0 && i <= 9)) {

                    if (key === "0") $("#ext0btn").click();
                    if (key === "1") $("#ext1btn").click();
                    if (key === "2") $("#ext2btn").click();
                    if (key === "3") $("#ext3btn").click();
                    if (key === "4") $("#ext4btn").click();
                    if (key === "5") $("#ext5btn").click();
                    if (key === "6") $("#ext6btn").click();
                    if (key === "7") $("#ext7btn").click();
                    if (key === "8") $("#ext8btn").click();
                    if (key === "9") $("#ext9btn").click();
                    if (key === "*") $("#extstarbtn").click();
                    if (key === "#") $("#extpoundbtn").click();
                }
            }
        }
    });

    ua.once('registered', onRegistered.bind(cur_call));
    ua.on('unregistered', async function() {
        // Call logout API
        await logoutAgent();
        console.error('UNREGISTERED');
        if (gotopanel == false){
		tempAlert("- UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - ",3000);
        }
    });
}

$("#calling_input").keyup(function(event) {
    if (event.keyCode == 13 && !event.shiftKey) {
        $("#ext").val($("#calling_input").val());
        $("#callbtn").trigger("click");
    }
});

/*
window.onbeforeunload = function(e) {
    e = e || window.event;

    console.log("closing window");

    // For IE and Firefox prior to version 4
    if (e) {
        e.returnValue = "Sure?";
    }

    return "Sure?";
};
*/

$(window).load(function() {
    cur_call = null;
    resetOptionsTimer();
    isAndroid = (navigator.userAgent.toLowerCase().indexOf('android') > -1);
    isIOS = /(iPad|iPhone|iPod)/g.test(navigator.userAgent);

    console.log("The doctor is in");
    console.log("Is something troubling you?");


    var url_string = window.location.href; //window.location.href
    var url = new URL(url_string);

    clicklogin = url.searchParams.get("clicklogin");

    $("#signin").hide();
    $("#dial").hide();
    $("#incall").hide();

    $("#controls").hide();
    $("#dialadv1").hide();
    $("#dialadv2").hide();
    $("#unholdbtn").hide();

    $("#yourname").keyup(function(event) {
        if (event.keyCode == 13 && !event.shiftKey) {
            $("#loginbtn").trigger("click");
        }
    });

    $("#passwd").keyup(function(event) {
        if (event.keyCode == 13 && !event.shiftKey) {
            $("#loginbtn").trigger("click");
        }
    });
    $("#login").keyup(function(event) {
        if (event.keyCode == 13 && !event.shiftKey) {
            $("#loginbtn").trigger("click");
        }
    });
    $("#ext").keyup(function(event) {
        if (event.keyCode == 13 && !event.shiftKey) {
            $("#callbtn").trigger("click");
        }
    });


    // Safari requires the user to grant device access before providing
    // all necessary device info, so do that first.
    var constraints = {
        audio: true,
        video: false,
    };
    navigator.mediaDevices.getUserMedia(constraints);

    navigator.mediaDevices.enumerateDevices()
        .then(function(devices) {
            var i = 1;
            var div = document.querySelector("#listmic"),
                frag = document.createDocumentFragment(),
                selectmic = document.createElement("select");

            while (div.firstChild) {
                div.removeChild(div.firstChild);
            }
            i = 1;
            selectmic.id = "selectmic";
            selectmic.style = "background-color: black;";

            devices.forEach(function(device) {


                if (device.kind === 'audioinput') {

                    selectmic.options.add(new Option('Microphone: ' + (device.label ? device.label : (i)), device.deviceId));
                    i++;

                }
            });

            frag.appendChild(selectmic);

            div.appendChild(frag);

        })
        .catch(function(err) {
            console.log(err.name + ": " + err.message);
        });

    document.getElementById("hideAll").style.display = "none";
    $("#signin").show();
    $("#signinadv1").hide();

    $("#webphone_blf").hide();

    if (clicklogin === "yes") {
        $("#loginbtn").trigger("click");
    }
});


$(document).ready(function() {
    audioElement.setAttribute('src', 'mp3/ring.mp3');
    setupCacheHandler();
});

$("#phonebookbtn").click(function() {
    var x = document.getElementById('phonebook');
    if (x.style.display === 'none') {
        x.style.display = 'block';
    } else {
        x.style.display = 'none';
    }
});

var cacheItems = ['login', 'passwd', 'yourname', 'domain', 'proxy', 'port',
    'pres1', 'pres1_label',
    'pres2', 'pres2_label',
    'pres3', 'pres3_label',
    'pres4', 'pres4_label',
    'pres5', 'pres5_label',
    'pres6', 'pres6_label',
    'pres7', 'pres7_label',
    'pres8', 'pres8_label',
    'pres9', 'pres9_label',
    'pres10', 'pres10_label',

];

function setupCacheHandler() {
    for(var i = 0; i < cacheItems.length; i++) {
        var key = cacheItems[i];
        var value = localStorage.getItem("saraphone." + key);
        if (value) document.getElementById(key).value = value;
        $("#" + key).change(function(e) {localStorage.setItem("saraphone." + e.target.id, e.target.value);});
    }
}
// Customer Data Card handlers
$("#customerDataForm").submit(async function(e) {
	e.preventDefault();
	const submitButton = document.getElementById("customerDataSubmitBtn");
	const messageEl = document.getElementById("customerFormMessage");
	var formData = {
		phone_number: document.getElementById("phone_number").value,
		customer_name: document.getElementById("customer_name").value,
		city: document.getElementById("city").value,
		customer_segment: document.getElementById("customer_segment").value,
		month_gmv: document.getElementById("month_gmv").value,
		overall_gmv: document.getElementById("overall_gmv").value,
		last_call_date: document.getElementById("last_call_date").value,
		last_order_date: document.getElementById("last_order_date").value,
		last_order_item: document.getElementById("last_order_item").value,
		last_order_amount: document.getElementById("last_order_amount").value,
		followup_phone_number: document.getElementById("followup_phone_number").value,
		followup_date: document.getElementById("followup_date").value,
		followup_time: document.getElementById("followup_time").value,
		followup_comments: document.getElementById("followup_comments").value
	};

	if (messageEl) {
		messageEl.style.display = 'none';
	}
	if (submitButton) {
		submitButton.disabled = true;
		submitButton.textContent = 'Saving...';
	}

	const result = await submitCustomerForm(formData);
	const success = result && result.success === true;

	showCustomerFormMessage(success, result && result.message);
	if (success) {
		document.getElementById("customerDataForm").reset();
	}

	if (submitButton) {
		submitButton.disabled = false;
		submitButton.textContent = 'Submit';
	}
});

$("#closeCustomerDataBtn").click(function() {
    // Reset form when close is clicked
    document.getElementById("customerDataForm").reset();
});

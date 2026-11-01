# SMS Gateway Companion App Specification

## Overview

TUSOME's messaging system queues SMS messages in the database. A companion Android app
polls the queue and sends messages via the device's SIM card using Android's `SmsManager` API,
exactly as the "Multi SMS Sender (MSS)" app does. This avoids per-message gateway fees.

## Reverse Engineering: Multi SMS Sender (MSS)

**App**: Multi SMS Sender (MSS) v71.0 by crazy.pradeep
**Package**: `crazy.pradeep.multismssender`
**APK**: `Multi+SMS+Sender+(MSS)_71.0_APKPure.xapk`

### How MSS Sends SMS

1. **Android SmsManager API**: Uses `android.telephony.SmsManager.sendTextMessage()` to send
   SMS directly through the device's SIM card. No third-party gateway.

2. **Permissions Required**:
   - `android.permission.SEND_SMS` — to send SMS
   - `android.permission.READ_SMS` — to read SMS for thread resolution

3. **Dual SIM Support**: Uses `getSmsManagerForSubscriptionId()` to select which SIM to use.

4. **Delivery Tracking**: Uses broadcast receivers for `SMS_SENT` and `SMS_DELIVERED` intents
   to track delivery status.

5. **Sent Folder**: Writes sent messages to the device's SMS sent folder via `Telephony.Sms.Sent`
   content provider.

6. **Batch Processing**: Supports batch sending with progress tracking. Uses WorkManager
   (`SaveSMSWork`) for background persistence.

7. **Thread Resolution**: Resolves SMS thread IDs for conversation grouping.

8. **Key Components**:
   - `SendMessageService` — IntentService that handles sending in background
   - `InboxSendReceiver` — BroadcastReceiver for sent/delivered status
   - `SaveSMSWork` — WorkManager worker for saving to local DB
   - `MessageSendResultReceiver` — handles send results

### Key Strings from DEX

- `sendSmsUtils: Phone: ` — phone number logging
- `sendTextMessage` — SmsManager method
- `smsManager` / `smsmanager` — SmsManager instance
- `getSmsManagerForSubscriptionId` — dual SIM selection
- `SMS_SENT` / `SMS_DELIVERED` — broadcast actions
- `InboxSendReceiver` — sent status receiver
- `SendMessageService: onHandleIntent` — background service entry
- `prepareSendSMSProgress` — batch progress tracking
- `Permission required to set SIM for sending message.` — SIM selection permission
- `SMS_SENT_CONTENT_URI is null, skipping Sent-folder write` — sent folder write

## Companion App Architecture

### Polling Loop

```
while (true) {
    // 1. Fetch pending messages from TUSOME
    val pending = supabase.rpc("get_pending_sms")

    // 2. Send each via SmsManager (like MSS)
    for (msg in pending) {
        for (phone in msg.phone_numbers) {
            smsManager.sendTextMessage(phone, null, msg.message_body, sentPI, deliveredPI)
        }
        // 3. Update status
        supabase.rpc("update_sms_status", { p_message_id: msg.message_id, p_status: "sent" })
    }

    // 4. Wait before next poll
    delay(30_000) // 30 seconds
}
```

### Kotlin Implementation (based on MSS)

```kotlin
import android.telephony.SmsManager
import android.app.PendingIntent
import android.content.Intent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.IntentFilter

class SmsGatewayService : Service() {
    private val smsManager = SmsManager.getDefault()

    fun sendSms(phoneNumber: String, message: String) {
        val sentIntent = PendingIntent.getBroadcast(
            this, 0, Intent("SMS_SENT"), PendingIntent.FLAG_IMMUTABLE
        )
        val deliveredIntent = PendingIntent.getBroadcast(
            this, 0, Intent("SMS_DELIVERED"), PendingIntent.FLAG_IMMUTABLE
        )

        // Register receivers (like MSS)
        registerReceiver(object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                when (resultCode) {
                    Activity.RESULT_OK -> updateStatus("sent")
                    else -> updateStatus("failed")
                }
            }
        }, IntentFilter("SMS_SENT"))

        // Send (like MSS)
        smsManager.sendTextMessage(phoneNumber, null, message, sentIntent, deliveredIntent)
    }

    // Dual SIM support (like MSS)
    fun getSmsManagerForSim(simSlot: Int): SmsManager {
        val subscriptionId = SubscriptionManager.getSubscriptionId(simSlot)
        return SmsManager.getSmsManagerForSubscriptionId(subscriptionId)
    }
}
```

### Required Permissions (AndroidManifest.xml)

```xml
<uses-permission android:name="android.permission.SEND_SMS" />
<uses-permission android:name="android.permission.READ_SMS" />
<uses-permission android:name="android.permission.RECEIVE_SMS" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

## TUSOME SMS Gateway RPCs

| RPC | Purpose |
|-----|---------|
| `get_pending_sms()` | Returns queued messages for the companion app to send |
| `update_sms_status(id, status)` | Updates delivery status (queued/sent/delivered/failed/partial) |
| `get_sms_gateway_config()` | Returns gateway configuration and companion app info |
| `log_message(...)` | Logs a sent message |
| `get_message_history(limit)` | Returns message history |
| `get_message_recipients()` | Returns students/teachers/classes for recipient selection |

## Setup

1. Install the companion app on an Android device with a SIM card
2. Configure the app with your TUSOME Supabase URL and anon key
3. The app polls `get_pending_sms()` every 30 seconds
4. Messages are sent via the device's SIM card
5. Status is reported back via `update_sms_status()`

## Cost

- **No per-message gateway fees** — uses the device's SMS plan
- Cost is the device's SIM card SMS rate (often unlimited on many plans)
- For schools with unlimited SMS plans, this is effectively free

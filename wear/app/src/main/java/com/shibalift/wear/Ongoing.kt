package com.shibalift.wear

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.wear.ongoing.OngoingActivity
import androidx.wear.ongoing.Status
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService

// While the phone has a workout going, a Wear OS Ongoing Activity puts Shiba Lift one tap away on the watch face.
fun showOngoing(ctx: Context, w: Workout?) {
    val nm = ctx.getSystemService(NotificationManager::class.java)
    if (w == null) return nm.cancel(ONGOING_ID)
    nm.createNotificationChannel(NotificationChannel("workout", "Workout in progress", NotificationManager.IMPORTANCE_LOW))
    val open = PendingIntent.getActivity(ctx, 0, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
    val n = NotificationCompat.Builder(ctx, "workout")
        .setSmallIcon(R.drawable.ic_ongoing)
        .setContentTitle(w.name)
        .setContentText("Workout in progress")
        .setContentIntent(open)
        .setCategory(NotificationCompat.CATEGORY_WORKOUT)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
    val sinceStart = SystemClock.elapsedRealtime() - (System.currentTimeMillis() - w.startedAt)
    OngoingActivity.Builder(ctx, ONGOING_ID, n)
        .setStaticIcon(R.drawable.ic_ongoing)
        .setTouchIntent(open)
        .setStatus(Status.Builder().addTemplate("#name# · #time#")
            .addPart("name", Status.TextPart(w.name)).addPart("time", Status.StopwatchPart(sinceStart)).build())
        .build()
        .apply(ctx)
    try { nm.notify(ONGOING_ID, n.build()) } catch (_: SecurityException) {} // notifications not allowed: no shortcut
}

const val ONGOING_ID = 1

// Hears the phone's state even while the watch app is closed, so the shortcut appears/disappears with the workout.
class StateListener : WearableListenerService() {
    override fun onDataChanged(events: DataEventBuffer) {
        events.lastOrNull { it.type == DataEvent.TYPE_CHANGED }?.let { e ->
            DataMapItem.fromDataItem(e.dataItem).dataMap.getString("json")?.let { showOngoing(this, parseState(it).workout) }
        }
    }
}

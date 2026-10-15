package expo.modules.shibawear

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat

// Runs while a workout draft exists, so Samsung's battery saver doesn't kill the backgrounded app mid-workout and
// watch taps keep reaching the JS side live. Started/stopped from JS via ShibaWear.setWorkoutActive.
class WorkoutService : Service() {
  override fun onBind(intent: Intent?) = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val nm = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel(CHANNEL, "Workout in progress", NotificationManager.IMPORTANCE_LOW))
    val open = PendingIntent.getActivity(this, 0, packageManager.getLaunchIntentForPackage(packageName), PendingIntent.FLAG_IMMUTABLE)
    val icon = resources.getIdentifier("notification_icon", "drawable", packageName).takeIf { it != 0 } ?: applicationInfo.icon
    val n = NotificationCompat.Builder(this, CHANNEL)
      .setSmallIcon(icon)
      .setContentTitle("Workout in progress")
      .setContentText("Keeping your watch in sync")
      .setContentIntent(open)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .build()
    if (Build.VERSION.SDK_INT >= 29) startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE) else startForeground(1, n)
    return START_NOT_STICKY // a restart without the JS app wouldn't sync anything
  }

  override fun onDestroy() {
    running = false
    super.onDestroy()
  }

  companion object {
    const val CHANNEL = "workout"
    @Volatile var running = false // what was last asked for; reset when the system stops the service
  }
}

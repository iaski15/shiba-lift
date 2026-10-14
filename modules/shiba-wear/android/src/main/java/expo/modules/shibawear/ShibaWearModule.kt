package expo.modules.shibawear

import android.net.Uri
import android.os.Bundle
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Phone side of the watch link (Wear OS Data Layer; the watch app has the same package and signing key).
// Phone -> watch: one data item "/state" holding the workout as JSON.
// Watch -> phone: every tap is its own data item "/action/<id>". Wear OS keeps them until the watch deletes them
// (after the phone's state says it handled them), so taps made while this app was closed still arrive.
class ShibaWearModule : Module() {
  private val data: DataClient
    get() = Wearable.getDataClient(appContext.reactContext ?: throw Exceptions.ReactContextLost())

  private val listener = DataClient.OnDataChangedListener { events ->
    if (events.any { it.type == DataEvent.TYPE_CHANGED }) sendEvent("onAction", Bundle())
  }

  override fun definition() = ModuleDefinition {
    Name("ShibaWear")
    Events("onAction")

    OnStartObserving("onAction") {
      data.addListener(listener, Uri.parse("wear://*$ACTIONS"), DataClient.FILTER_PREFIX)
    }
    OnStopObserving("onAction") {
      data.removeListener(listener)
    }

    AsyncFunction("publish") { json: String, promise: Promise ->
      val req = PutDataMapRequest.create(STATE).apply { dataMap.putString("json", json) }.asPutDataRequest().setUrgent()
      data.putDataItem(req)
        .addOnSuccessListener { promise.resolve(null) }
        .addOnFailureListener { promise.reject(CodedException(it.message ?: "publish failed", it)) }
    }

    AsyncFunction("pendingActions") { promise: Promise ->
      data.getDataItems(Uri.parse("wear://*$ACTIONS"), DataClient.FILTER_PREFIX)
        .addOnSuccessListener { items ->
          val out = items.mapNotNull { DataMapItem.fromDataItem(it).dataMap.getString("json") }
          items.release()
          promise.resolve(out)
        }
        .addOnFailureListener { promise.reject(CodedException(it.message ?: "read failed", it)) }
    }
  }

  companion object {
    const val STATE = "/state"
    const val ACTIONS = "/action/"
  }
}

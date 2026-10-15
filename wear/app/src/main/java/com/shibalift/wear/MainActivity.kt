package com.shibalift.wear

import android.Manifest
import android.content.pm.ApplicationInfo
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataItem
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import org.json.JSONObject

// What the phone publishes (src/lib/watch.ts watchState). The phone owns the workout; the watch shows it and sends taps.
data class WSet(val w: Double, val r: Int, val done: Boolean, val warmup: Boolean)
data class WBlock(val ex: String, val name: String, val inc: Double, val linked: Boolean, val sets: List<WSet>)
data class Workout(val name: String, val startedAt: Long, val restEnd: Long, val blocks: List<WBlock>)
data class Routine(val id: Int, val name: String)
data class PhoneState(val ack: Long, val routines: List<Routine>, val workout: Workout?)

fun parseState(json: String): PhoneState {
    val o = JSONObject(json)
    val rs = o.getJSONArray("routines")
    val w = o.optJSONObject("workout")
    return PhoneState(
        ack = o.getLong("ack"),
        routines = (0 until rs.length()).map { rs.getJSONObject(it).let { r -> Routine(r.getInt("id"), r.getString("name")) } },
        workout = w?.let {
            val bs = it.getJSONArray("blocks")
            Workout(it.getString("name"), it.getLong("startedAt"), it.getLong("restEnd"), (0 until bs.length()).map { i ->
                val b = bs.getJSONObject(i)
                val ss = b.getJSONArray("sets")
                WBlock(b.getString("ex"), b.getString("name"), b.getDouble("inc"), b.getBoolean("linked"), (0 until ss.length()).map { j ->
                    val s = ss.getJSONObject(j)
                    WSet(s.getDouble("w"), s.getInt("r"), s.getBoolean("done"), s.getBoolean("warmup"))
                })
            })
        },
    )
}

const val REST_MS = 120_000L // same as the phone's REST_SECONDS; only used to show the rest right away

class MainActivity : ComponentActivity(), DataClient.OnDataChangedListener {
    private val data by lazy { Wearable.getDataClient(this) }
    private var state by mutableStateOf<PhoneState?>(null)
    private var lastId = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Debug builds only: `adb shell am start -n com.shibalift.app/com.shibalift.wear.MainActivity --es demo '<state json>'`
        // shows a workout without a paired phone (taps still update the screen locally), for trying the UI on an emulator.
        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) intent.getStringExtra("demo")?.let { state = parseState(it).also { s -> showOngoing(this, s.workout) } }
        setContent { ShibaWatch(state, ::act) }
        // For the watch-face shortcut during a workout (Ongoing.kt).
        if (Build.VERSION.SDK_INT >= 33) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 0)
    }

    override fun onResume() {
        super.onResume()
        data.addListener(this, Uri.parse("wear://*$STATE"), DataClient.FILTER_LITERAL)
        data.getDataItems(Uri.parse("wear://*$STATE")).addOnSuccessListener { items ->
            items.lastOrNull()?.let(::read)
            items.release()
        }
    }

    override fun onPause() {
        super.onPause()
        data.removeListener(this)
    }

    override fun onDataChanged(events: DataEventBuffer) {
        events.filter { it.type == DataEvent.TYPE_CHANGED }.forEach { read(it.dataItem) }
    }

    private fun read(item: DataItem) {
        val json = DataMapItem.fromDataItem(item).dataMap.getString("json") ?: return
        state = parseState(json).also { deleteHandled(it.ack); showOngoing(this, it.workout) }
    }

    // The phone has handled every tap up to `ack`: drop those data items so they don't pile up.
    private fun deleteHandled(ack: Long) {
        data.getDataItems(Uri.parse("wear://*$ACTIONS"), DataClient.FILTER_PREFIX).addOnSuccessListener { items ->
            val done = items.map { it.uri }.filter { (it.lastPathSegment?.toLongOrNull() ?: Long.MAX_VALUE) <= ack }
            items.release()
            done.forEach { data.deleteDataItems(it) }
        }
    }

    // Sends a tap to the phone and shows its expected result right away (`local`); the phone's next state replaces it.
    private fun act(action: JSONObject, local: (Workout) -> Workout?) {
        val id = maxOf(System.currentTimeMillis(), lastId + 1).also { lastId = it }
        action.put("id", id)
        state = state?.let { s -> s.copy(workout = s.workout?.let(local)) }
        val req = PutDataMapRequest.create("$ACTIONS$id").apply { dataMap.putString("json", action.toString()) }
        data.putDataItem(req.asPutDataRequest().setUrgent())
    }

    companion object {
        const val STATE = "/state"
        const val ACTIONS = "/action/"
    }
}

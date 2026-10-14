package com.shibalift.wear

import android.content.Context
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.ScalingLazyListScope
import androidx.wear.compose.foundation.lazy.ScalingLazyListState
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.CircularProgressIndicator
import androidx.wear.compose.material3.ColorScheme
import androidx.wear.compose.material3.CompactButton
import androidx.wear.compose.material3.FilledTonalButton
import androidx.wear.compose.material3.FilledTonalIconButton
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.OutlinedButton
import androidx.wear.compose.material3.Text
import androidx.wear.compose.material3.TimeText
import kotlinx.coroutines.delay
import org.json.JSONObject
import java.util.Locale

typealias Act = (JSONObject, (Workout) -> Workout?) -> Unit

private val Orange = Color(0xFFE8A35A)
private val Cream = Color(0xFFFFF4E6)
private val Shiba = ColorScheme(
    primary = Orange, onPrimary = Color(0xFF2B2B2B),
    primaryContainer = Color(0xFF5A3D20), onPrimaryContainer = Cream,
    surfaceContainer = Color(0xFF2B2622), onSurface = Cream, onSurfaceVariant = Color(0xFFB8A898),
)

@Composable
fun ShibaWatch(s: PhoneState?, act: Act) {
    MaterialTheme(colorScheme = Shiba) {
        var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
        LaunchedEffect(Unit) { while (true) { now = System.currentTimeMillis(); delay(500) } }
        val w = s?.workout
        val ctx = LocalContext.current
        // Buzz when the rest is over. Keyed on the end time, so skip / ±15 s restart it.
        LaunchedEffect(w?.restEnd) {
            val left = (w?.restEnd ?: 0L) - System.currentTimeMillis()
            if (left > 0) { delay(left); buzz(ctx) }
        }
        when {
            s == null -> Message("Open Shiba Lift on your phone 🐾")
            w == null -> Idle(s.routines, act)
            w.restEnd > now -> Rest(w, now, act)
            else -> Lift(w, now, act)
        }
    }
}

@Composable
private fun Screen(state: ScalingLazyListState = rememberScalingLazyListState(), content: ScalingLazyListScope.() -> Unit) {
    Box(Modifier.fillMaxSize().background(Color.Black)) {
        ScalingLazyColumn(
            modifier = Modifier.fillMaxSize(),
            state = state,
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 32.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
            content = content,
        )
        TimeText()
    }
}

@Composable
private fun Message(text: String) {
    Box(Modifier.fillMaxSize().background(Color.Black).padding(24.dp), Alignment.Center) {
        Text(text, textAlign = TextAlign.Center)
    }
}

@Composable
private fun Idle(routines: List<Routine>, act: Act) = Screen {
    item { Text("Shiba Lift 🐾", style = MaterialTheme.typography.titleMedium, color = Orange) }
    item {
        Button(onClick = { act(JSONObject().put("type", "start")) { it } }, Modifier.fillMaxWidth()) { Text("Empty workout") }
    }
    items(routines) { r ->
        FilledTonalButton(onClick = { act(JSONObject().put("type", "start").put("routineId", r.id)) { it } }, Modifier.fillMaxWidth()) {
            Text(r.name, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun Lift(w: Workout, now: Long, act: Act) {
    // The set shown big: the one tapped in the list, else the first one not done yet.
    var sel by remember(w.startedAt) { mutableStateOf<Pair<Int, Int>?>(null) }
    val adj = remember(w.startedAt) { mutableStateMapOf<Pair<Int, Int>, Pair<Double, Int>>() } // −/+ before Done
    var confirmFinish by remember { mutableStateOf(false) }
    val all = w.blocks.flatMapIndexed { bi, b -> b.sets.indices.map { bi to it } }
    val cur = sel?.takeIf { it in all } ?: all.firstOrNull { (bi, si) -> !w.blocks[bi].sets[si].done }

    val elapsed = clock(now - w.startedAt)
    // Opens (and returns, when a set is picked from the list) with exercise, weight, reps and Done all in view.
    val list = rememberScalingLazyListState(initialCenterItemIndex = 2, initialCenterItemScrollOffset = 45)
    LaunchedEffect(sel) { if (sel != null) list.animateScrollToItem(2, 45) }
    Screen(list) {
        if (cur == null) {
            item { Text(elapsed, style = MaterialTheme.typography.labelMedium, color = Orange) }
            item { Text(if (w.blocks.isEmpty()) "Add exercises on your phone" else "All sets done 🎉", textAlign = TextAlign.Center) }
        } else {
            val (bi, si) = cur
            val b = w.blocks[bi]
            val s = b.sets[si]
            val (wt, reps) = adj[cur] ?: (s.w to s.r)
            item {
                Text(b.name, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            item { Text("${setLabel(b, si)} · $elapsed", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            if (s.done) {
                item { Text("✓ ${kg(s.w)} kg × ${s.r}", style = MaterialTheme.typography.titleLarge) }
                item {
                    FilledTonalButton(onClick = {
                        act(JSONObject().put("type", "undo").put("bi", bi).put("si", si).put("ex", b.ex)) { it.withSet(bi, si) { x -> x.copy(done = false) } }
                    }, Modifier.fillMaxWidth()) { Text("Undo set") }
                }
            } else {
                item { Stepper("${kg(wt)} kg", { adj[cur] = maxOf(0.0, round2(wt - b.inc)) to reps }, { adj[cur] = round2(wt + b.inc) to reps }) }
                item { Stepper("$reps reps", { adj[cur] = wt to maxOf(1, reps - 1) }, { adj[cur] = wt to reps + 1 }) }
                item {
                    Button(onClick = {
                        val json = JSONObject().put("type", "set").put("bi", bi).put("si", si).put("ex", b.ex).put("w", wt).put("r", reps)
                        act(json) { x ->
                            val y = x.withSet(bi, si) { it.copy(w = wt, r = reps, done = true) }
                            if (b.linked && bi < x.blocks.size - 1) y else y.copy(restEnd = System.currentTimeMillis() + REST_MS) // mid-superset: no rest
                        }
                        adj.remove(cur)
                        sel = null
                    }, Modifier.fillMaxWidth()) { Text("✓ Done") }
                }
            }
        }
        w.blocks.forEachIndexed { bi, b ->
            item { Text(b.name, style = MaterialTheme.typography.labelMedium, color = Orange, maxLines = 1, overflow = TextOverflow.Ellipsis) }
            b.sets.forEachIndexed { si, s ->
                item {
                    val label = "${setLabel(b, si, short = true)}   ${kg(s.w)} × ${s.r}${if (s.done) "  ✓" else ""}"
                    val pick = { sel = bi to si }
                    when {
                        cur == bi to si -> Button(onClick = pick, Modifier.fillMaxWidth()) { Text(label) }
                        s.done -> FilledTonalButton(onClick = pick, Modifier.fillMaxWidth()) { Text(label) }
                        else -> OutlinedButton(onClick = pick, Modifier.fillMaxWidth()) { Text(label) }
                    }
                }
            }
        }
        if (w.blocks.any { b -> b.sets.any { it.done } }) {
            item {
                Button(onClick = {
                    if (confirmFinish) act(JSONObject().put("type", "finish")) { it } else confirmFinish = true
                }, Modifier.fillMaxWidth()) { Text(if (confirmFinish) "Tap again to finish" else "Finish workout") }
            }
        }
    }
}

@Composable
private fun Rest(w: Workout, now: Long, act: Act) {
    val left = w.restEnd - now
    val rest = { add: Long ->
        act(JSONObject().put("type", "rest").put("add", add)) { it.copy(restEnd = if (add == 0L) 0L else it.restEnd + add) }
    }
    val next = w.blocks.flatMap { b -> b.sets.filter { !it.done }.map { b to it } }.firstOrNull()
    Box(Modifier.fillMaxSize().background(Color.Black), Alignment.Center) {
        CircularProgressIndicator(progress = { (left.toFloat() / maxOf(left, REST_MS)).coerceIn(0f, 1f) }, modifier = Modifier.fillMaxSize().padding(4.dp))
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Rest", style = MaterialTheme.typography.labelMedium, color = Orange)
            Text(clock(left), style = MaterialTheme.typography.displaySmall)
            next?.let { (b, s) ->
                Text("Next: ${b.name}", style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(horizontal = 32.dp))
                Text("${kg(s.w)} kg × ${s.r}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CompactButton(onClick = { rest(-15_000) }) { Text("−15") }
                CompactButton(onClick = { rest(15_000) }) { Text("+15") }
            }
            CompactButton(onClick = { rest(0) }) { Text("Skip") }
        }
    }
}

@Composable
private fun Stepper(label: String, minus: () -> Unit, plus: () -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        FilledTonalIconButton(onClick = minus, Modifier.size(44.dp)) { Text("−", style = MaterialTheme.typography.titleLarge) }
        Text(label, style = MaterialTheme.typography.titleMedium)
        FilledTonalIconButton(onClick = plus, Modifier.size(44.dp)) { Text("+", style = MaterialTheme.typography.titleLarge) }
    }
}

// "W" for a warm-up, else the working-set number (warm-ups don't count), like the phone.
private fun setLabel(b: WBlock, si: Int, short: Boolean = false): String {
    if (b.sets[si].warmup) return if (short) "W" else "Warm-up"
    val n = b.sets.take(si + 1).count { !it.warmup }
    return if (short) "$n" else "Set $n of ${b.sets.count { !it.warmup }}"
}

fun Workout.withSet(bi: Int, si: Int, f: (WSet) -> WSet) =
    copy(blocks = blocks.mapIndexed { i, b -> if (i != bi) b else b.copy(sets = b.sets.mapIndexed { j, s -> if (j == si) f(s) else s }) })

private fun round2(d: Double) = Math.round(d * 100) / 100.0
private fun kg(d: Double) = String.format(Locale.US, "%.2f", d).trimEnd('0').trimEnd('.')
private fun clock(ms: Long): String {
    val s = maxOf(0L, (ms + 999) / 1000)
    return if (s >= 3600) String.format(Locale.US, "%d:%02d:%02d", s / 3600, s / 60 % 60, s % 60)
    else String.format(Locale.US, "%d:%02d", s / 60, s % 60)
}

private fun buzz(ctx: Context) {
    @Suppress("DEPRECATION")
    ctx.getSystemService(Vibrator::class.java)?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 300, 150, 300), -1))
}

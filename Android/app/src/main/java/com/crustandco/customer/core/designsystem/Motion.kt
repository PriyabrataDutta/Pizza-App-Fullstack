package com.crustandco.customer.core.designsystem

import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay

/**
 * Motion tokens. Every animation in the app uses these so timing feels like one hand made it.
 * Short for feedback, medium for things appearing, long only for a single hero moment per screen.
 */
object Motion {
    const val Fast = 100
    const val Medium = 240
    const val Slow = 380

    /** Things entering: quick start, smooth deceleration. */
    val Enter = CubicBezierEasing(0.05f, 0.7f, 0.1f, 1f)

    /** Things leaving: swift acceleration away. */
    val Exit = CubicBezierEasing(0.3f, 0f, 0.8f, 0.15f)

    val Standard = FastOutSlowInEasing
}

/** True when the user has turned system animations off. Decorative motion is skipped; state changes still happen instantly. */
@Composable
fun rememberReducedMotion(): Boolean {
    val resolver = LocalContext.current.contentResolver
    return remember {
        runCatching { Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f }.getOrDefault(false)
    }
}

/** Soft scale-down while pressed, so every tappable thing feels physical. */
fun Modifier.pressScale(source: MutableInteractionSource, pressed: Float = 0.97f): Modifier = composed {
    val isPressed by source.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (isPressed) pressed else 1f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = Spring.StiffnessMediumLow),
        label = "press",
    )
    this.scale(scale)
}

/**
 * Fades and lifts an item in once, with a small delay per [index] so a list arrives as a gentle wave, not all at once.
 * Only the first screenful is staggered; later items (index above [maxStaggered]) appear without delay.
 */
fun Modifier.staggeredEntrance(index: Int, maxStaggered: Int = 8, stepMs: Long = 25L): Modifier =
    // Rows past the first screenful just appear: animating every row that scrolls into view makes the list look late and blank.
    if (index >= maxStaggered) this else entranceAnimation(index, stepMs)

private fun Modifier.entranceAnimation(index: Int, stepMs: Long): Modifier = composed {
    val reduced = rememberReducedMotion()
    val progress = remember { Animatable(if (reduced) 1f else 0f) }
    LaunchedEffect(Unit) {
        if (!reduced) {
            delay(index * stepMs)
            progress.animateTo(1f, tween(Motion.Medium, easing = Motion.Enter))
        }
    }
    this.graphicsLayer {
        alpha = progress.value
        translationY = (1f - progress.value) * 16.dp.toPx()
    }
}

/** Moving highlight for skeleton placeholders. */
@Composable
fun shimmerBrush(): Brush {
    val reduced = rememberReducedMotion()
    val base = Color(0xFFEFE6DB)
    val highlight = Color(0xFFF9F3EB)
    if (reduced) return Brush.linearGradient(listOf(base, base))
    val transition = rememberInfiniteTransition(label = "shimmer")
    val x by transition.animateFloat(
        initialValue = -400f,
        targetValue = 1200f,
        animationSpec = infiniteRepeatable(tween(1300, easing = LinearEasing), RepeatMode.Restart),
        label = "shimmerX",
    )
    return Brush.linearGradient(listOf(base, highlight, base), start = Offset(x, 0f), end = Offset(x + 400f, 200f))
}

package com.crustandco.customer.core.designsystem

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// Layer 2 (semantic): names by purpose. Screens use MaterialTheme.* and CrustTheme.status, never Palette directly.

private val CrustColorScheme = lightColorScheme(
    primary = Palette.Red600,
    onPrimary = Palette.White,
    primaryContainer = Palette.Red100,
    onPrimaryContainer = Palette.Red700,
    secondary = Palette.Amber400,
    onSecondary = Palette.Brown900,
    background = Palette.Cream50,          // canvas
    onBackground = Palette.Brown900,
    surface = Palette.White,
    onSurface = Palette.Brown900,
    surfaceVariant = Palette.Cream100,     // surface-subtle
    onSurfaceVariant = Palette.Brown500,   // text-secondary
    outline = Palette.Cream300,            // border
    outlineVariant = Palette.Cream300,
    error = Palette.Red800,
    onError = Palette.White,
    errorContainer = Palette.Red50,
    onErrorContainer = Palette.Red800,
    // Material 3 draws dialogs, sheets and menus from these slots. Left at their defaults they come out lavender.
    surfaceTint = Color.Transparent,
    surfaceContainerLowest = Palette.White,
    surfaceContainerLow = Palette.White,
    surfaceContainer = Palette.Cream50,
    surfaceContainerHigh = Palette.White,
    surfaceContainerHighest = Palette.Cream100,
    // Snackbars use the inverse colors: warm dark brown with cream text, not Material's grey.
    inverseSurface = Palette.Brown900,
    inverseOnSurface = Palette.Cream50,
    inversePrimary = Palette.Amber400,
)

// design.md section 5: small 8, inputs/buttons 10-12, product cards 16, feature cards 20.
private val CrustShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(20.dp),
)

/** Foreground + soft background pair for a status tone. Always pair with text or an icon, never color alone. */
@Immutable
data class Tone(val foreground: Color, val background: Color)

@Immutable
data class StatusColors(
    val success: Tone = Tone(Palette.Green700, Palette.Green100),
    val warning: Tone = Tone(Palette.Amber800, Palette.Amber100),
    val error: Tone = Tone(Palette.Red800, Palette.Red50),
    val info: Tone = Tone(Palette.Blue700, Palette.Blue50),
)

private val LocalStatusColors = staticCompositionLocalOf { StatusColors() }

object CrustTheme {
    val status: StatusColors
        @Composable @ReadOnlyComposable get() = LocalStatusColors.current
}

@Composable
fun CrustTheme(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalStatusColors provides StatusColors()) {
        MaterialTheme(
            colorScheme = CrustColorScheme,
            typography = CrustTypography,
            shapes = CrustShapes,
            content = content,
        )
    }
}

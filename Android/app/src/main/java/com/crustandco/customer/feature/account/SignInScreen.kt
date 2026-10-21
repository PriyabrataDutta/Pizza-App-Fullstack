package com.crustandco.customer.feature.account

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.crustandco.customer.LocalAppContainer
import com.crustandco.customer.core.designsystem.Motion
import com.crustandco.customer.core.designsystem.Palette
import com.crustandco.customer.core.designsystem.Ph
import com.crustandco.customer.core.designsystem.PhIcon
import com.crustandco.customer.core.designsystem.components.PizzaArt
import com.crustandco.customer.core.designsystem.components.PrimaryButton
import com.crustandco.customer.core.designsystem.components.SecondaryButton
import com.crustandco.customer.core.designsystem.rememberReducedMotion
import com.crustandco.customer.core.rememberNotifier

/**
 * Sign-in. "Continue with Google" is real UI but honest: until a Google OAuth client is configured it explains what is missing
 * instead of pretending to sign in. The demo account is clearly labelled and works with no setup.
 */
@Composable
fun SignInScreen(contentPadding: PaddingValues, onBack: () -> Unit, onContinueAsGuest: () -> Unit, onSignedIn: () -> Unit) {
    val container = LocalAppContainer.current
    val viewModel: AccountViewModel = viewModel(factory = viewModelFactory { initializer { AccountViewModel(container.authRepository) } })
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val notify = rememberNotifier()
    val reduced = rememberReducedMotion()

    // One orchestrated entrance: the pizza spins in, then the sheet rises.
    val spin = remember { Animatable(if (reduced) 0f else -50f) }
    val pizzaAlpha = remember { Animatable(if (reduced) 1f else 0f) }
    var sheetVisible by remember { mutableStateOf(reduced) }
    LaunchedEffect(Unit) {
        if (!reduced) {
            pizzaAlpha.animateTo(1f, tween(Motion.Slow))
        }
    }
    LaunchedEffect(Unit) {
        if (!reduced) spin.animateTo(0f, tween(900, easing = Motion.Enter))
    }
    LaunchedEffect(Unit) {
        if (!reduced) kotlinx.coroutines.delay(250)
        sheetVisible = true
    }
    // A slow, almost subliminal turn keeps the hero alive without competing with the buttons.
    val idle = rememberInfiniteTransition(label = "idle")
    val drift by idle.animateFloat(0f, if (reduced) 0f else 360f, infiniteRepeatable(tween(90_000, easing = LinearEasing), RepeatMode.Restart), label = "drift")

    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Palette.Brown800, Palette.Brown950)))) {
        PizzaArt(
            Modifier
                .align(Alignment.TopCenter)
                .padding(top = contentPadding.calculateTopPadding() + 64.dp)
                .size(300.dp)
                .alpha(pizzaAlpha.value)
                .scale(0.9f + 0.1f * pizzaAlpha.value)
                .rotate(spin.value + drift),
        )

        Surface(
            onClick = onBack,
            shape = CircleShape,
            color = MaterialTheme.colorScheme.surface,
            modifier = Modifier.padding(start = 16.dp, top = contentPadding.calculateTopPadding() + 8.dp).size(44.dp),
        ) {
            Box(contentAlignment = Alignment.Center) { PhIcon(Ph.ArrowLeft, contentDescription = "Back") }
        }

        AnimatedVisibility(
            visible = sheetVisible,
            modifier = Modifier.align(Alignment.BottomCenter),
            enter = slideInVertically(tween(Motion.Slow, easing = Motion.Enter)) { it / 2 } + fadeIn(tween(Motion.Slow)),
        ) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp),
                color = MaterialTheme.colorScheme.background,
            ) {
                Column(
                    Modifier.padding(start = 24.dp, end = 24.dp, top = 28.dp, bottom = 20.dp + contentPadding.calculateBottomPadding()),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text("Welcome to Crust & Co.", style = MaterialTheme.typography.headlineLarge)
                    Text(
                        "Sign in to save your addresses and follow your orders.",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )

                    Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        SecondaryButton(
                            text = if (ui.busy == AccountUiState.Busy.Google) "Opening Google…" else "Continue with Google",
                            leadingIcon = Ph.GoogleLogo,
                            enabled = ui.busy == null,
                            onClick = { viewModel.signInWithGoogle { onSignedIn() } },
                            modifier = Modifier.fillMaxWidth(),
                        )
                        PrimaryButton(
                            text = "Use demo account",
                            loading = ui.busy == AccountUiState.Busy.Demo,
                            enabled = ui.busy == null,
                            onClick = { viewModel.signInDemo { onSignedIn() } },
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }

                    ui.error?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error) }

                    Text(
                        "Continue as guest",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable(onClick = onContinueAsGuest).padding(top = 12.dp),
                    )
                    Text(
                        "The demo account is a made-up profile saved on this phone. No real account is created.",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }
    }

    if (ui.googleUnavailable) {
        AlertDialog(
            onDismissRequest = viewModel::dismissGoogleHelp,
            title = { Text("Google sign-in isn’t set up yet") },
            text = {
                Text(
                    "It needs a Google sign-in client created for this app, which hasn’t been done yet. " +
                        "You can explore everything with the demo account in the meantime.",
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.dismissGoogleHelp()
                    viewModel.signInDemo {
                        notify("Signed in with the demo account")
                        onSignedIn()
                    }
                }) { Text("Use demo account") }
            },
            dismissButton = { TextButton(onClick = viewModel::dismissGoogleHelp) { Text("Not now") } },
        )
    }
}

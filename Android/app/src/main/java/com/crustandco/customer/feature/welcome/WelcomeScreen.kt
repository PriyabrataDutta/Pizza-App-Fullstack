package com.crustandco.customer.feature.welcome

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.crustandco.customer.core.designsystem.Motion
import com.crustandco.customer.core.designsystem.Palette
import com.crustandco.customer.core.designsystem.ScriptStyle
import com.crustandco.customer.core.designsystem.components.PizzaArt
import com.crustandco.customer.core.designsystem.components.PrimaryButton
import com.crustandco.customer.core.designsystem.components.SecondaryButton
import com.crustandco.customer.core.designsystem.components.rememberPhotoId
import com.crustandco.customer.core.designsystem.rememberReducedMotion
import com.crustandco.customer.core.designsystem.staggeredEntrance

/**
 * First screen, styled after the reference: dark and warm, logo mark and wordmark on top, a script tagline, and the two
 * actions. The backdrop is the photo `welcome_hero` when it has been added (see docs/IMAGES.md), otherwise the illustration.
 * Things arrive one after another: the pizza turns in, then the wordmark, the tagline and the buttons.
 */
@Composable
fun WelcomeScreen(onGetStarted: () -> Unit, onSignIn: () -> Unit) {
    val white = Color.White
    val reduced = rememberReducedMotion()
    val heroId = rememberPhotoId("welcome_hero")

    val spin = remember { Animatable(if (reduced) 0f else -35f) }
    val fade = remember { Animatable(if (reduced) 1f else 0f) }
    LaunchedEffect(Unit) {
        if (!reduced) {
            spin.animateTo(0f, tween(1100, easing = Motion.Enter))
        }
    }
    LaunchedEffect(Unit) {
        if (!reduced) fade.animateTo(1f, tween(Motion.Slow))
    }

    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Palette.Brown800, Palette.Brown950)))) {
        if (heroId != 0) {
            Image(painterResource(heroId), contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            // Keeps the text readable on any photo.
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0x99000000), Color(0x22000000), Color(0xCC000000)))))
        } else {
            // Large pizza bleeding off the lower right, where the cheese-pull photo sits in the reference.
            PizzaArt(
                Modifier
                    .align(Alignment.BottomEnd)
                    .size(440.dp)
                    .offset(x = 150.dp, y = (-150).dp)
                    .alpha(fade.value)
                    .rotate(spin.value),
            )
        }

        Column(
            Modifier.fillMaxSize().safeDrawingPadding().padding(horizontal = 28.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Column(
                Modifier.fillMaxWidth().staggeredEntrance(0, stepMs = 140),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                PizzaArt(Modifier.size(72.dp))
                Text(
                    "CRUST & CO.",
                    style = MaterialTheme.typography.displayLarge.copy(fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp),
                    color = white,
                )
                Text(
                    "PIZZA HOUSE",
                    style = MaterialTheme.typography.labelLarge.copy(letterSpacing = 5.sp),
                    color = white,
                    textAlign = TextAlign.Center,
                )
            }

            // Script tagline, left aligned like the reference.
            Text(
                "Good\nPizza\nBrighter\nDays",
                style = ScriptStyle,
                color = white,
                modifier = Modifier.staggeredEntrance(1, stepMs = 220),
            )

            Column(Modifier.staggeredEntrance(2, stepMs = 260), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                PrimaryButton("Get Started", onClick = onGetStarted, modifier = Modifier.fillMaxWidth())
                SecondaryButton("Sign In", onClick = onSignIn, onDark = true, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}

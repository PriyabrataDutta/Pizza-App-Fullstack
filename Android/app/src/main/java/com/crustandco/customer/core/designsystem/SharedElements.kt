package com.crustandco.customer.core.designsystem

import androidx.compose.animation.AnimatedVisibilityScope
import androidx.compose.animation.ExperimentalSharedTransitionApi
import androidx.compose.animation.SharedTransitionScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.Modifier

// Lets a product's artwork glide from a list card into the detail screen's hero, instead of the screens just swapping.
// The scopes are provided by AppNavigation; outside it (previews, tests) they are null and the modifier does nothing.

@OptIn(ExperimentalSharedTransitionApi::class)
val LocalSharedTransitionScope = compositionLocalOf<SharedTransitionScope?> { null }

val LocalAnimatedScope = compositionLocalOf<AnimatedVisibilityScope?> { null }

/** Marks this as the shared element for [productId]'s artwork. Use the same id on the list card and the detail hero. */
@OptIn(ExperimentalSharedTransitionApi::class)
@Composable
fun Modifier.sharedProductArt(productId: String): Modifier {
    val transition = LocalSharedTransitionScope.current
    val visibility = LocalAnimatedScope.current
    if (transition == null || visibility == null) return this
    return with(transition) {
        this@sharedProductArt.sharedElement(rememberSharedContentState(key = "art-$productId"), visibility)
    }
}

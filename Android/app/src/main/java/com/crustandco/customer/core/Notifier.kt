package com.crustandco.customer.core

import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.staticCompositionLocalOf
import kotlinx.coroutines.launch

val LocalSnackbarHostState = staticCompositionLocalOf<SnackbarHostState> {
    error("SnackbarHostState not provided. It is created in CrustAppUi.")
}

/** Returns a function that shows a short message at the bottom of the screen, replacing any message already showing. */
@Composable
fun rememberNotifier(): (String) -> Unit {
    val host = LocalSnackbarHostState.current
    val scope = rememberCoroutineScope()
    return remember(host, scope) {
        { message: String ->
            scope.launch {
                host.currentSnackbarData?.dismiss()
                host.showSnackbar(message)
            }
            Unit
        }
    }
}

/** Standard wording for features that exist in the design but not in the product yet. */
fun comingSoon(what: String) = "$what isn’t available yet."

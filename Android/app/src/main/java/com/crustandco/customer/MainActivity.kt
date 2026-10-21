package com.crustandco.customer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.CompositionLocalProvider
import com.crustandco.customer.core.designsystem.CrustTheme
import com.crustandco.customer.navigation.CrustAppUi

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as CrustApp).container
        setContent {
            CrustTheme {
                CompositionLocalProvider(LocalAppContainer provides container) {
                    CrustAppUi()
                }
            }
        }
    }
}

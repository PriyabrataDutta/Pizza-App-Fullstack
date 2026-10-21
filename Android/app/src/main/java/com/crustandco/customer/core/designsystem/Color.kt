package com.crustandco.customer.core.designsystem

import androidx.compose.ui.graphics.Color

// Color tokens. Source of truth: /design.md section 2. Update both together.
// Layer 1 (primitive): raw values, the only place hex appears. Layer 2 (semantic): see Theme.kt and StatusColors.

internal object Palette {
    val Red600 = Color(0xFFD9362B)      // brand-primary
    val Red700 = Color(0xFFB92B23)      // brand-primary-hover / pressed
    val Red100 = Color(0xFFFCE8E5)      // brand-primary-soft
    val Amber400 = Color(0xFFF4B544)    // brand-secondary
    val Cream50 = Color(0xFFFFF9F2)     // canvas
    val White = Color(0xFFFFFFFF)       // surface
    val Cream100 = Color(0xFFF6F0E8)    // surface-subtle
    val Cream300 = Color(0xFFE8DFD5)    // border
    val Brown900 = Color(0xFF27231F)    // text-primary
    val Brown500 = Color(0xFF746D66)    // text-secondary
    val Green700 = Color(0xFF237A4B)    // success
    val Green100 = Color(0xFFE4F4E9)    // success-soft
    val Amber800 = Color(0xFF9A6100)    // warning
    val Amber100 = Color(0xFFFFF1D3)    // warning-soft
    val Red800 = Color(0xFFB42318)      // error
    val Red50 = Color(0xFFFDE8E7)       // error-soft
    val Blue700 = Color(0xFF245DA8)     // information
    val Blue50 = Color(0xFFE6EEFA)      // information-soft (dashboard parity)
    val Crust400 = Color(0xFFE2A64B)    // pizza illustration only
    val Crust600 = Color(0xFFB9772A)
    val Cheese200 = Color(0xFFF8D680)
    val Brown950 = Color(0xFF1B1310)    // welcome screen backdrop
    val Brown800 = Color(0xFF3A2218)
}

package com.crustandco.customer.core.designsystem

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.crustandco.customer.R

// Type system. Sizes are sp so Android font scaling works (design.md section 3).
//  - Fraunces: warm, soft serif for headings and prices. The "premium restaurant" voice.
//  - Plus Jakarta Sans: clean modern sans for everything you read or tap.
//  - Pacifico: script, used only for the Welcome tagline.
// All three are bundled in res/font (SIL Open Font Licence), so there is no download at runtime.
// Fraunces and Plus Jakarta Sans are variable fonts; each weight below selects an axis value from the same file.

private fun variable(resId: Int, weight: FontWeight) =
    Font(resId, weight = weight, variationSettings = FontVariation.Settings(FontVariation.weight(weight.weight)))

val Fraunces = FontFamily(
    listOf(FontWeight.Medium, FontWeight.SemiBold, FontWeight.Bold, FontWeight.ExtraBold).map { variable(R.font.fraunces_variable, it) },
)

val JakartaSans = FontFamily(
    listOf(FontWeight.Normal, FontWeight.Medium, FontWeight.SemiBold, FontWeight.Bold, FontWeight.ExtraBold)
        .map { variable(R.font.plus_jakarta_sans_variable, it) },
)

val Pacifico = FontFamily(Font(R.font.pacifico_regular))

// Sized for a phone held in one hand, in the compact range food-delivery apps use: 13sp body, 14 to 16sp titles,
// 17 to 20sp headings, nothing under 11sp. Users who raise the system font size still get larger text, because everything is sp.
val CrustTypography = Typography(
    displayLarge = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.Bold, fontSize = 26.sp, lineHeight = 32.sp, letterSpacing = (-0.4).sp),
    displayMedium = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.Bold, fontSize = 24.sp, lineHeight = 30.sp, letterSpacing = (-0.3).sp),
    displaySmall = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.Bold, fontSize = 22.sp, lineHeight = 28.sp, letterSpacing = (-0.2).sp),
    headlineLarge = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.Bold, fontSize = 20.sp, lineHeight = 26.sp, letterSpacing = (-0.2).sp),
    headlineMedium = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.SemiBold, fontSize = 17.sp, lineHeight = 22.sp, letterSpacing = (-0.1).sp),
    headlineSmall = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 22.sp), // dialog titles
    titleLarge = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, lineHeight = 20.sp),
    titleMedium = TextStyle(fontFamily = JakartaSans, fontWeight = FontWeight.Bold, fontSize = 14.sp, lineHeight = 19.sp),
    titleSmall = TextStyle(fontFamily = JakartaSans, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, lineHeight = 17.sp),
    bodyLarge = TextStyle(fontFamily = JakartaSans, fontWeight = FontWeight.Normal, fontSize = 13.sp, lineHeight = 18.sp),
    bodyMedium = TextStyle(fontFamily = JakartaSans, fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 17.sp),
    bodySmall = TextStyle(fontFamily = JakartaSans, fontWeight = FontWeight.Normal, fontSize = 11.sp, lineHeight = 15.sp),
    labelLarge = TextStyle(fontFamily = JakartaSans, fontWeight = FontWeight.Bold, fontSize = 12.sp, lineHeight = 17.sp, letterSpacing = 0.1.sp),
    labelMedium = TextStyle(fontFamily = JakartaSans, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, lineHeight = 15.sp, letterSpacing = 0.2.sp),
    labelSmall = TextStyle(fontFamily = JakartaSans, fontWeight = FontWeight.Medium, fontSize = 11.sp, lineHeight = 14.sp),
)

/** Tabular numerals so prices and order numbers line up. Apply with `style = MaterialTheme.typography.x.merge(Tabular)`. */
val Tabular = TextStyle(fontFeatureSettings = "tnum")

/** Prices in the serif, so money reads as a considered detail, not as UI chrome. */

/** The running total on the product sheet: sized so the sheet fits without crowding. */
val PriceDetail = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.Bold, fontSize = 18.sp, lineHeight = 24.sp, fontFeatureSettings = "tnum")
val PriceMedium = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, lineHeight = 17.sp, fontFeatureSettings = "tnum")

/** The Welcome screen's handwritten tagline. */
val ScriptStyle = TextStyle(fontFamily = Pacifico, fontWeight = FontWeight.Normal, fontSize = 34.sp, lineHeight = 42.sp)

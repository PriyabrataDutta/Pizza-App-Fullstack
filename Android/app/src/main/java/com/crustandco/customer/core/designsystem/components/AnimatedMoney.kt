package com.crustandco.customer.core.designsystem.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import com.crustandco.customer.core.Money
import com.crustandco.customer.core.designsystem.Motion
import com.crustandco.customer.core.designsystem.rememberReducedMotion

/** A price that counts up or down to its new value, so a change in size or toppings is felt as well as read. */
@Composable
fun AnimatedMoney(money: Money, style: TextStyle, modifier: Modifier = Modifier, color: Color = Color.Unspecified) {
    val reduced = rememberReducedMotion()
    val shown by animateFloatAsState(
        targetValue = money.minor.toFloat(),
        animationSpec = tween(if (reduced) 0 else 450, easing = Motion.Standard),
        label = "money",
    )
    // The last frame always shows the exact amount.
    val text = if (shown.toLong() == money.minor) money.format() else Money(shown.toLong(), money.currency).format()
    Text(text, style = style, color = color, modifier = modifier)
}

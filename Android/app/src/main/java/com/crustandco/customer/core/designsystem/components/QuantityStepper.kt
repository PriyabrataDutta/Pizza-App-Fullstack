package com.crustandco.customer.core.designsystem.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.crustandco.customer.core.designsystem.Motion
import com.crustandco.customer.core.designsystem.Ph
import com.crustandco.customer.core.designsystem.PhIcon
import com.crustandco.customer.core.designsystem.Tabular

/**
 * − 2 + in a rounded outline, with the red square "+" from the reference.
 * The number rolls up or down as it changes. Both buttons are 48dp touch targets and announce which item they change.
 */
@Composable
fun QuantityStepper(
    quantity: Int,
    itemName: String,
    onDecrease: () -> Unit,
    onIncrease: () -> Unit,
    modifier: Modifier = Modifier,
    minQuantity: Int = 1,
    maxQuantity: Int = Int.MAX_VALUE,
) {
    Surface(modifier, shape = MaterialTheme.shapes.medium, color = MaterialTheme.colorScheme.surface, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {
        Row(Modifier.padding(start = 2.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onDecrease, enabled = quantity > minQuantity) {
                PhIcon(
                    Ph.Minus,
                    contentDescription = "Decrease quantity of $itemName",
                    tint = if (quantity > minQuantity) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.outline,
                    size = 20.dp,
                )
            }
            AnimatedContent(
                targetState = quantity,
                transitionSpec = {
                    val up = targetState > initialState
                    (slideInVertically(tween(Motion.Medium, easing = Motion.Enter)) { if (up) it else -it } + fadeIn(tween(Motion.Medium)))
                        .togetherWith(slideOutVertically(tween(Motion.Medium, easing = Motion.Exit)) { if (up) -it else it } + fadeOut(tween(Motion.Fast)))
                        .using(SizeTransform(clip = true))
                },
                modifier = Modifier.widthIn(min = 28.dp),
                label = "quantity",
            ) { value ->
                Box(Modifier.widthIn(min = 28.dp).semantics { contentDescription = "Quantity $value" }, contentAlignment = Alignment.Center) {
                    Text(value.toString(), style = MaterialTheme.typography.titleMedium.merge(Tabular), textAlign = TextAlign.Center)
                }
            }
            AddButton(onClick = onIncrease, contentDescription = "Increase quantity of $itemName", enabled = quantity < maxQuantity)
        }
    }
}

package com.crustandco.customer.core.designsystem.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.crustandco.customer.core.designsystem.Motion
import com.crustandco.customer.core.designsystem.Palette
import com.crustandco.customer.core.designsystem.Ph
import com.crustandco.customer.core.designsystem.PhIcon
import com.crustandco.customer.core.designsystem.pressScale

data class BarItem(val label: String, val icon: Ph, val badge: Int = 0)

/**
 * Bottom navigation. Each icon is a light outline when idle and turns solid when selected, so the active tab is clear from
 * shape and not only color. A soft red highlight springs in behind it, and the cart badge bounces when the count changes.
 */
@Composable
fun CrustBottomBar(items: List<BarItem>, selectedIndex: Int, onSelect: (Int) -> Unit, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)
    Surface(
        modifier = modifier.shadow(16.dp, shape, ambientColor = Palette.Brown900.copy(alpha = 0.12f), spotColor = Palette.Brown900.copy(alpha = 0.18f)),
        shape = shape,
        color = MaterialTheme.colorScheme.surface,
    ) {
        Row(
            Modifier.fillMaxWidth().navigationBarsPadding().padding(top = 6.dp, bottom = 4.dp, start = 4.dp, end = 4.dp),
            horizontalArrangement = Arrangement.SpaceAround,
        ) {
            items.forEachIndexed { index, item ->
                BarButton(item, selected = index == selectedIndex, onClick = { onSelect(index) }, modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun BarButton(item: BarItem, selected: Boolean, onClick: () -> Unit, modifier: Modifier) {
    val colors = MaterialTheme.colorScheme
    val tint by animateColorAsState(if (selected) colors.primary else colors.onSurfaceVariant, tween(Motion.Medium), label = "barTint")
    val highlight by animateFloatAsState(
        targetValue = if (selected) 1f else 0f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = Spring.StiffnessMediumLow),
        label = "barHighlight",
    )
    val interaction = remember { MutableInteractionSource() }

    Column(
        modifier
            .pressScale(interaction, pressed = 0.92f)
            .heightIn(min = 52.dp)
            .selectable(selected = selected, interactionSource = interaction, indication = null, role = Role.Tab, onClick = onClick)
            .semantics { if (item.badge > 0) contentDescription = "${item.label}, ${item.badge} items" },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(Modifier.size(width = 48.dp, height = 28.dp), contentAlignment = Alignment.Center) {
            Box(
                Modifier
                    .size(width = 48.dp, height = 28.dp)
                    .scale(scaleX = 0.4f + 0.6f * highlight, scaleY = 0.6f + 0.4f * highlight)
                    .background(colors.primaryContainer.copy(alpha = highlight), RoundedCornerShape(percent = 50)),
            )
            PhIcon(item.icon, contentDescription = null, tint = tint, filled = selected, size = 22.dp)
            if (item.badge > 0) CountBadge(item.badge, Modifier.align(Alignment.TopEnd).offset(x = (-2).dp, y = (-2).dp))
        }
        Text(
            item.label,
            style = MaterialTheme.typography.labelMedium.copy(fontSize = 10.sp),
            color = tint,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}

/** Small red count bubble that gives a quick bounce whenever [count] changes. */
@Composable
fun CountBadge(count: Int, modifier: Modifier = Modifier) {
    val bump = remember { Animatable(1f) }
    LaunchedEffect(count) {
        bump.snapTo(1.35f)
        bump.animateTo(1f, spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = Spring.StiffnessMediumLow))
    }
    Box(
        modifier
            .scale(bump.value)
            .heightIn(min = 18.dp)
            .background(MaterialTheme.colorScheme.primary, CircleShape)
            .padding(horizontal = 5.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            if (count > 9) "9+" else count.toString(),
            style = MaterialTheme.typography.labelMedium.copy(fontSize = 10.sp, lineHeight = 12.sp),
            color = MaterialTheme.colorScheme.onPrimary,
        )
    }
}

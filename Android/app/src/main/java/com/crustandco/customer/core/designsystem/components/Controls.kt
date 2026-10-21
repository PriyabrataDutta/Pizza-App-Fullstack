package com.crustandco.customer.core.designsystem.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.crustandco.customer.core.designsystem.Motion
import com.crustandco.customer.core.designsystem.Ph
import com.crustandco.customer.core.designsystem.PhIcon
import com.crustandco.customer.core.designsystem.pressScale

/**
 * Back arrow, centered title, optional trailing action. Used by every screen except Home and Welcome.
 * The side slots are both 48dp wide so the title stays truly centered.
 */
@Composable
fun CrustTopBar(
    title: String,
    onBack: (() -> Unit)?,
    modifier: Modifier = Modifier,
    trailing: @Composable (() -> Unit)? = null,
) {
    Row(modifier.fillMaxWidth().heightIn(min = 56.dp).padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(48.dp), contentAlignment = Alignment.Center) {
            if (onBack != null) {
                IconButton(onClick = onBack) { PhIcon(Ph.ArrowLeft, contentDescription = "Back") }
            }
        }
        Text(title, style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center, modifier = Modifier.weight(1f))
        Box(Modifier.size(48.dp), contentAlignment = Alignment.Center) { trailing?.invoke() }
    }
}

/** The red rounded-square "+" from the reference. 48dp touch target around a 36dp visual that presses in. */
@Composable
fun AddButton(onClick: () -> Unit, contentDescription: String, modifier: Modifier = Modifier, enabled: Boolean = true) {
    val colors = MaterialTheme.colorScheme
    val interaction = remember { MutableInteractionSource() }
    val shape = RoundedCornerShape(12.dp)
    Box(
        modifier
            .size(48.dp)
            .clip(CircleShape)
            .clickable(interactionSource = interaction, indication = null, enabled = enabled, role = Role.Button, onClick = onClick)
            .semantics { this.contentDescription = contentDescription },
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier
                .pressScale(interaction, pressed = 0.88f)
                .size(36.dp)
                .shadow(if (enabled) 4.dp else 0.dp, shape, ambientColor = colors.primary.copy(alpha = 0.3f), spotColor = colors.primary.copy(alpha = 0.4f))
                .background(if (enabled) colors.primary else colors.outline, shape),
            contentAlignment = Alignment.Center,
        ) {
            PhIcon(Ph.Plus, contentDescription = null, tint = colors.onPrimary, size = 20.dp)
        }
    }
}

/** Filter pill: solid brand red when selected, outlined cream otherwise. Color eases between the two. */
@Composable
fun PillTab(text: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val colors = MaterialTheme.colorScheme
    val container by animateColorAsState(if (selected) colors.primary else colors.surface, tween(Motion.Medium), label = "pillBg")
    val content by animateColorAsState(if (selected) colors.onPrimary else colors.onSurface, tween(Motion.Medium), label = "pillFg")
    val border by animateColorAsState(if (selected) colors.primary else colors.outline, tween(Motion.Medium), label = "pillBorder")
    val interaction = remember { MutableInteractionSource() }
    Surface(
        modifier = modifier
            .pressScale(interaction)
            .heightIn(min = 40.dp)
            .selectable(selected = selected, interactionSource = interaction, indication = ripple(), role = Role.Tab, onClick = onClick),
        shape = RoundedCornerShape(percent = 50),
        color = container,
        border = BorderStroke(1.dp, border),
    ) {
        Box(Modifier.padding(horizontal = 18.dp, vertical = 8.dp), contentAlignment = Alignment.Center) {
            Text(text, style = MaterialTheme.typography.labelLarge, color = content)
        }
    }
}

/**
 * A smaller, quieter filter than [PillTab]: tinted when on, outlined when off. [marker] is an optional dot drawn
 * before the label (green for veg, red for non-veg), so the meaning never rests on color alone: the label stays.
 */
@Composable
fun FilterChip(text: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier, marker: Color? = null) {
    val colors = MaterialTheme.colorScheme
    val container by animateColorAsState(if (selected) colors.primaryContainer else colors.surface, tween(Motion.Medium), label = "chipBg")
    val content by animateColorAsState(if (selected) colors.onPrimaryContainer else colors.onSurfaceVariant, tween(Motion.Medium), label = "chipFg")
    val border by animateColorAsState(if (selected) colors.primary else colors.outline, tween(Motion.Medium), label = "chipBorder")
    val interaction = remember { MutableInteractionSource() }
    Surface(
        modifier = modifier
            .pressScale(interaction)
            .heightIn(min = 36.dp)
            .selectable(selected = selected, interactionSource = interaction, indication = ripple(), role = Role.Checkbox, onClick = onClick),
        shape = RoundedCornerShape(percent = 50),
        color = container,
        border = BorderStroke(1.dp, border),
    ) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            if (marker != null) {
                Box(Modifier.size(8.dp).clip(CircleShape).background(marker))
                Spacer(Modifier.width(7.dp))
            }
            Text(text, style = MaterialTheme.typography.labelMedium, color = content)
        }
    }
}

/** Equal-width options in one rounded outline. A red pill slides to the chosen one, like Active / Past Orders in the reference. */
@Composable
fun SegmentedTabs(options: List<String>, selectedIndex: Int, onSelect: (Int) -> Unit, modifier: Modifier = Modifier) {
    val colors = MaterialTheme.colorScheme
    Surface(modifier.fillMaxWidth(), shape = RoundedCornerShape(percent = 50), color = colors.surface, border = BorderStroke(1.dp, colors.outline)) {
        BoxWithConstraints(Modifier.padding(4.dp)) {
            val segment = maxWidth / options.size
            val offset by animateDpAsState(
                targetValue = segment * selectedIndex,
                animationSpec = spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = Spring.StiffnessMediumLow),
                label = "segmentOffset",
            )
            Box(
                Modifier
                    .offset(x = offset)
                    .width(segment)
                    .height(44.dp)
                    .shadow(4.dp, RoundedCornerShape(percent = 50), ambientColor = colors.primary.copy(alpha = 0.25f), spotColor = colors.primary.copy(alpha = 0.35f))
                    .background(colors.primary, RoundedCornerShape(percent = 50)),
            )
            Row {
                options.forEachIndexed { index, label ->
                    val selected = index == selectedIndex
                    val textColor by animateColorAsState(if (selected) colors.onPrimary else colors.onSurface, tween(Motion.Medium), label = "segmentText")
                    Box(
                        Modifier
                            .weight(1f)
                            .height(44.dp)
                            .clip(RoundedCornerShape(percent = 50))
                            .selectable(selected = selected, role = Role.Tab, onClick = { onSelect(index) }),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(label, style = MaterialTheme.typography.labelLarge, color = textColor)
                    }
                }
            }
        }
    }
}

/** Selected: red outline and soft red fill. Used for sizes, crusts and payment choices. */
@Composable
fun ChoiceTile(
    title: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    enabled: Boolean = true,
) {
    val colors = MaterialTheme.colorScheme
    val container by animateColorAsState(if (selected) colors.primaryContainer else colors.surface, tween(Motion.Medium), label = "tileBg")
    val border by animateColorAsState(if (selected) colors.primary else colors.outline, tween(Motion.Medium), label = "tileBorder")
    val interaction = remember { MutableInteractionSource() }
    Surface(
        modifier = modifier
            .pressScale(interaction)
            .heightIn(min = 56.dp)
            .widthIn(min = 88.dp)
            .selectable(selected = selected, enabled = enabled, interactionSource = interaction, indication = ripple(), role = Role.RadioButton, onClick = onClick),
        shape = MaterialTheme.shapes.medium,
        color = container,
        border = BorderStroke(if (selected) 1.5.dp else 1.dp, border),
    ) {
        Column(
            Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            val content = if (enabled) colors.onSurface else colors.onSurfaceVariant
            Text(title, style = MaterialTheme.typography.labelLarge, color = content, textAlign = TextAlign.Center)
            if (subtitle != null) {
                Text(subtitle, style = MaterialTheme.typography.labelMedium, color = colors.onSurfaceVariant, textAlign = TextAlign.Center)
            }
        }
    }
}

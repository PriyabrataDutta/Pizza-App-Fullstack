package com.crustandco.customer.core.designsystem.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SelectableChipColors
import androidx.compose.material3.Text
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.crustandco.customer.core.designsystem.Ph
import com.crustandco.customer.core.designsystem.PhIcon
import com.crustandco.customer.core.designsystem.pressScale

// Touch targets are at least 48dp (design.md section 10). Buttons are 52dp: comfortable, and clearly the main action.
private val ButtonHeight = 52.dp
private val ButtonShape = RoundedCornerShape(16.dp)

/**
 * The main action. A soft red gradient with a warm glow, and a gentle press-in. While [loading] it is inert, which also
 * prevents duplicate submissions.
 */
@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    leadingIcon: Ph? = null,
) {
    val colors = MaterialTheme.colorScheme
    val interaction = remember { MutableInteractionSource() }
    val active = enabled && !loading
    val fill = if (enabled) {
        Brush.verticalGradient(listOf(colors.primary, colors.onPrimaryContainer))
    } else {
        SolidColor(colors.outline)
    }
    Row(
        modifier
            .pressScale(interaction)
            .shadow(
                elevation = if (enabled) 8.dp else 0.dp,
                shape = ButtonShape,
                ambientColor = colors.primary.copy(alpha = 0.25f),
                spotColor = colors.primary.copy(alpha = 0.45f),
            )
            .clip(ButtonShape)
            .background(fill)
            .heightIn(min = ButtonHeight)
            .clickable(interactionSource = interaction, indication = ripple(color = Color.White), enabled = active, role = Role.Button, onClick = onClick)
            .padding(horizontal = 20.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (loading) {
            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = colors.onPrimary)
        } else {
            if (leadingIcon != null) {
                PhIcon(leadingIcon, contentDescription = null, tint = if (enabled) colors.onPrimary else colors.onSurfaceVariant, size = 20.dp)
                Spacer(Modifier.size(8.dp))
            }
            Text(text, style = MaterialTheme.typography.labelLarge.copy(fontSize = 15.sp), color = if (enabled) colors.onPrimary else colors.onSurfaceVariant)
        }
    }
}

/** Quiet outlined action that sits beside a primary one. */
@Composable
fun SecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leadingIcon: Ph? = null,
    destructive: Boolean = false,
    onDark: Boolean = false,
) {
    val colors = MaterialTheme.colorScheme
    val interaction = remember { MutableInteractionSource() }
    val content = when {
        destructive -> colors.error
        onDark -> Color.White
        else -> colors.onSurface
    }
    Row(
        modifier
            .pressScale(interaction)
            .clip(ButtonShape)
            .background(if (onDark) Color.Transparent else colors.surface)
            .border(BorderStroke(if (onDark) 1.5.dp else 1.dp, if (destructive) colors.error.copy(alpha = 0.4f) else if (onDark) Color.White else colors.outline), ButtonShape)
            .heightIn(min = ButtonHeight)
            .clickable(interactionSource = interaction, indication = ripple(), enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(horizontal = 20.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (leadingIcon != null) {
            PhIcon(leadingIcon, contentDescription = null, tint = content, size = 20.dp)
            Spacer(Modifier.size(8.dp))
        }
        Text(text, style = MaterialTheme.typography.labelLarge.copy(fontSize = 15.sp), color = if (enabled) content else colors.onSurfaceVariant)
    }
}

/** Selected chips use the brand's soft red (design.md: brand-primary-soft for selected chips), not Material's default tint. */
@Composable
fun brandFilterChipColors(): SelectableChipColors = FilterChipDefaults.filterChipColors(
    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
    selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer,
)

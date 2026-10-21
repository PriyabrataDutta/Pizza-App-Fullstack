package com.crustandco.customer.core.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.crustandco.customer.core.designsystem.Palette
import com.crustandco.customer.core.designsystem.pressScale

private val CardShape = RoundedCornerShape(20.dp)

/**
 * The app's card: white surface, a hairline border and a soft warm shadow. Shadows are tinted brown, not grey,
 * so cards sit on the cream background instead of looking pasted on. When [onClick] is set it also presses in gently.
 */
@Composable
fun CrustCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    elevation: Dp = 3.dp,
    containerColor: Color = MaterialTheme.colorScheme.surface,
    content: @Composable ColumnScope.() -> Unit,
) {
    val interaction = remember { MutableInteractionSource() }
    val base = modifier
        .then(if (onClick != null) Modifier.pressScale(interaction, pressed = 0.985f) else Modifier)
        .shadow(elevation, CardShape, ambientColor = Palette.Brown900.copy(alpha = 0.10f), spotColor = Palette.Brown900.copy(alpha = 0.14f))
        .clip(CardShape)
        .background(containerColor)
        .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.7f), CardShape)
    Column(
        if (onClick != null) {
            base.clickable(interactionSource = interaction, indication = ripple(), role = Role.Button, onClick = onClick)
        } else {
            base
        },
        content = content,
    )
}

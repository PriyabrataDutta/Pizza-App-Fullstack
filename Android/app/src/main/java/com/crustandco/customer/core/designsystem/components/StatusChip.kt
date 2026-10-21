package com.crustandco.customer.core.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.crustandco.customer.core.designsystem.CrustTheme
import com.crustandco.customer.core.designsystem.Tone
import com.crustandco.customer.domain.OrderStatus

/** Customer-facing wording for each backend status. The four tracker steps match the reference. */
val OrderStatus.customerLabel: String
    get() = when (this) {
        OrderStatus.Placed, OrderStatus.Accepted -> "Confirmed"
        OrderStatus.Preparing, OrderStatus.ReadyForDispatch -> "Preparing"
        OrderStatus.OutForDelivery -> "On the way"
        OrderStatus.Delivered -> "Delivered"
        OrderStatus.Rejected -> "Rejected"
        OrderStatus.Cancelled -> "Cancelled"
        OrderStatus.Unknown -> "Status unavailable"
    }

@Composable
private fun OrderStatus.tone(): Tone {
    val c = CrustTheme.status
    return when (this) {
        OrderStatus.Delivered -> c.success
        OrderStatus.Rejected, OrderStatus.Cancelled -> c.error
        OrderStatus.Unknown -> c.info
        // Everything still in progress uses the brand tint, like "On the way" in the reference.
        else -> Tone(MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.primaryContainer)
    }
}

/** Status pill. The words carry the meaning; color only reinforces them. */
@Composable
fun OrderStatusPill(status: OrderStatus, modifier: Modifier = Modifier) {
    val tone = status.tone()
    Text(
        status.customerLabel,
        style = MaterialTheme.typography.labelMedium,
        color = tone.foreground,
        modifier = modifier
            .background(tone.background, RoundedCornerShape(percent = 50))
            .padding(horizontal = 12.dp, vertical = 6.dp),
    )
}

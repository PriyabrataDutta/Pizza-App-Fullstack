package com.crustandco.customer.feature.tracking

import com.crustandco.customer.core.designsystem.rememberReducedMotion
import com.crustandco.customer.core.designsystem.Motion
import androidx.compose.ui.draw.scale
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.animateColorAsState
import com.crustandco.customer.core.designsystem.components.CrustCard
import com.crustandco.customer.core.designsystem.Ph
import com.crustandco.customer.core.designsystem.PhIcon
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.crustandco.customer.LocalAppContainer
import com.crustandco.customer.core.UiState
import com.crustandco.customer.core.designsystem.Tabular
import com.crustandco.customer.core.designsystem.components.CrustTopBar
import com.crustandco.customer.core.designsystem.components.ErrorState
import com.crustandco.customer.core.designsystem.components.LoadingState
import com.crustandco.customer.core.designsystem.components.customerLabel
import com.crustandco.customer.domain.Order
import com.crustandco.customer.domain.OrderStatus
import com.crustandco.customer.domain.PaymentMethod
import com.crustandco.customer.domain.trackerStep
import com.crustandco.customer.feature.cart.SummaryRow
import kotlinx.coroutines.delay

private const val REFRESH_MS = 8_000L

@Composable
fun TrackingScreen(orderId: String, contentPadding: PaddingValues, onBack: () -> Unit) {
    val container = LocalAppContainer.current
    val viewModel: TrackingViewModel = viewModel(
        key = "tracking-$orderId",
        factory = viewModelFactory { initializer { TrackingViewModel(orderId, container.orderRepository) } },
    )
    val state by viewModel.state.collectAsStateWithLifecycle()
    val order = (state as? UiState.Success)?.data

    // The page reflects the persisted status, so keep re-reading it while an order is still moving.
    LaunchedEffect(order?.isActive) {
        while (order?.isActive == true) {
            delay(REFRESH_MS)
            viewModel.refresh()
        }
    }

    Column(Modifier.fillMaxSize().padding(top = contentPadding.calculateTopPadding())) {
        CrustTopBar(title = "Order Tracking", onBack = onBack)
        when (val s = state) {
            UiState.Loading -> LoadingState(label = "Loading order")
            is UiState.Error -> ErrorState(s.error, onRetry = viewModel::retry)
            is UiState.Success -> TrackingContent(s.data, contentPadding.calculateBottomPadding())
        }
    }
}

private fun OrderStatus.headline(): String = when (this) {
    OrderStatus.Placed, OrderStatus.Accepted -> "Confirmed!"
    OrderStatus.Preparing, OrderStatus.ReadyForDispatch -> "Being prepared"
    OrderStatus.OutForDelivery -> "On the way!"
    OrderStatus.Delivered -> "Delivered!"
    OrderStatus.Rejected -> "Rejected"
    OrderStatus.Cancelled -> "Cancelled"
    OrderStatus.Unknown -> "Status unavailable"
}

@Composable
private fun TrackingContent(order: Order, bottomInset: androidx.compose.ui.unit.Dp) {
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 24.dp + bottomInset),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Your Order is", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(order.status.headline(), style = MaterialTheme.typography.displayLarge, textAlign = TextAlign.Center)
            Text("Order #${order.number}", style = MaterialTheme.typography.bodyMedium.merge(Tabular), color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (order.isActive && order.estimatedMinutes != null) {
                // The server's estimate for this delivery area. It is an estimate, not a live countdown.
                Text("Estimated delivery", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 12.dp))
                Text("About ${order.estimatedMinutes} mins", style = MaterialTheme.typography.headlineLarge.merge(Tabular), color = MaterialTheme.colorScheme.primary)
            }
        }

        val step = order.status.trackerStep
        if (step != null) Tracker(step) else NotDeliveredNote(order.status)

        if (order.isActive) {
            InfoCard("We update this page as the restaurant works on your order. Live map tracking isn’t available yet.")
        }

        OrderDetails(order)
    }
}

private data class TrackerNode(val label: String, val icon: Ph)

private val TrackerNodes = listOf(
    TrackerNode("Confirmed", Ph.Check),
    TrackerNode("Preparing", Ph.ChefHat),
    TrackerNode("On the way", Ph.Moped),
    TrackerNode("Delivered", Ph.House),
)

@Composable
private fun Tracker(currentStep: Int) {
    val colors = MaterialTheme.colorScheme
    val reduced = rememberReducedMotion()
    // The step the order is on right now breathes gently. Finished or reduced-motion: it stays still.
    val breathe by rememberInfiniteTransition(label = "breathe").animateFloat(
        initialValue = 1f,
        targetValue = if (reduced || currentStep >= 3) 1f else 1.12f,
        animationSpec = infiniteRepeatable(tween(900, easing = Motion.Standard), RepeatMode.Reverse),
        label = "breatheScale",
    )
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        TrackerNodes.forEachIndexed { index, node ->
            if (index > 0) {
                val line by animateColorAsState(if (index <= currentStep) colors.primary else colors.outline, tween(Motion.Slow), label = "trackLine")
                Box(Modifier.weight(1f).padding(top = 21.dp).height(2.dp).background(line))
            }
            val reached = index <= currentStep
            val nodeColor by animateColorAsState(if (reached) colors.primary else colors.outline, tween(Motion.Slow), label = "trackNode")
            Column(Modifier.width(68.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(
                    Modifier.size(44.dp).scale(if (index == currentStep) breathe else 1f).background(nodeColor, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    PhIcon(node.icon, contentDescription = null, tint = if (reached) colors.onPrimary else colors.onSurfaceVariant, filled = reached, size = 24.dp)
                }
                Text(
                    node.label,
                    style = MaterialTheme.typography.labelMedium,
                    color = if (reached) colors.onSurface else colors.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

@Composable
private fun NotDeliveredNote(status: OrderStatus) {
    InfoCard(
        when (status) {
            OrderStatus.Rejected -> "The restaurant couldn’t take this order. Nothing was delivered."
            OrderStatus.Cancelled -> "This order was cancelled. Nothing was delivered."
            else -> "We can’t show this order’s progress right now."
        },
    )
}

@Composable
private fun InfoCard(text: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(16.dp))
    }
}

@Composable
private fun OrderDetails(order: Order) {
    CrustCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Order details", style = MaterialTheme.typography.titleLarge)
            order.lines.forEach { line ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(Modifier.weight(1f)) {
                        Text("${line.quantity}x ${line.name} (${line.variantName})", style = MaterialTheme.typography.bodyLarge)
                        if (line.optionNames.isNotEmpty()) {
                            Text(line.optionNames.joinToString(", "), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    Text(line.lineTotal.format(), style = MaterialTheme.typography.bodyLarge.merge(Tabular))
                }
            }
            order.subtotal?.let { SummaryRow("Subtotal", it.format()) }
            order.discount?.takeIf { it.minor > 0 }?.let { SummaryRow("Discount", "− ${it.format()}") }
            order.deliveryFee?.let { SummaryRow("Delivery Fee", if (it.minor == 0L) "Free" else it.format()) }
            order.tax?.takeIf { it.minor > 0 }?.let { SummaryRow("Tax", it.format()) }
            SummaryRow("Total", order.total.format(), emphasized = true)

            order.deliveryAddress?.let {
                Text("Delivering to", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
                Text(it, style = MaterialTheme.typography.bodyMedium)
            }
            order.paymentMethod?.let {
                Text("Payment", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))
                Text(if (it == PaymentMethod.OnlineDemo) "${it.label}: no money was taken" else it.label, style = MaterialTheme.typography.bodyMedium)
            }
            Text("Status: ${order.status.customerLabel}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))
        }
    }
}

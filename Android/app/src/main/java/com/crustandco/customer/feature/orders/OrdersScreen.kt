package com.crustandco.customer.feature.orders

import com.crustandco.customer.core.designsystem.staggeredEntrance
import androidx.compose.foundation.lazy.itemsIndexed
import com.crustandco.customer.core.designsystem.components.CrustCard
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.crustandco.customer.LocalAppContainer
import com.crustandco.customer.core.UiState
import com.crustandco.customer.core.designsystem.Tabular
import com.crustandco.customer.core.designsystem.components.CrustTopBar
import com.crustandco.customer.core.designsystem.components.EmptyState
import com.crustandco.customer.core.designsystem.components.ErrorState
import com.crustandco.customer.core.designsystem.components.LoadingState
import com.crustandco.customer.core.designsystem.components.OrderStatusPill
import com.crustandco.customer.core.designsystem.components.SegmentedTabs
import com.crustandco.customer.core.formatOrderTime
import com.crustandco.customer.domain.Order
import com.crustandco.customer.domain.OrderLine

@Composable
fun OrdersScreen(contentPadding: PaddingValues, onBack: () -> Unit, onOpenOrder: (String) -> Unit) {
    val container = LocalAppContainer.current
    val viewModel: OrdersViewModel = viewModel(
        factory = viewModelFactory { initializer { OrdersViewModel(container.orderRepository) } },
    )
    val state by viewModel.state.collectAsStateWithLifecycle()
    var tab by rememberSaveable { mutableIntStateOf(0) }

    // Orders change while the app is open (a new order, or the restaurant moving one along), so reload on every visit.
    LaunchedEffect(Unit) { viewModel.refresh() }

    Column(Modifier.fillMaxSize().padding(top = contentPadding.calculateTopPadding())) {
        CrustTopBar(title = "My Orders", onBack = onBack)
        SegmentedTabs(listOf("Active", "Past Orders"), tab, { tab = it }, Modifier.padding(horizontal = 20.dp, vertical = 8.dp))

        when (val s = state) {
            UiState.Loading -> LoadingState(label = "Loading orders")
            is UiState.Error -> ErrorState(s.error, onRetry = viewModel::retry)
            is UiState.Success -> {
                val shown = s.data.filter { it.isActive == (tab == 0) }
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = contentPadding.calculateBottomPadding() + 24.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    if (shown.isEmpty()) {
                        item {
                            if (tab == 0) EmptyState("No active orders", "When you place an order, you can follow it here.")
                            else EmptyState("No past orders yet", "Delivered and cancelled orders will show up here.")
                        }
                    } else {
                        itemsIndexed(shown, key = { _, order -> order.id }) { index, order -> OrderCard(order, onClick = { onOpenOrder(order.id) }, modifier = Modifier.staggeredEntrance(index)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun OrderCard(order: Order, onClick: () -> Unit, modifier: Modifier = Modifier) {
    CrustCard(modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text("Order #${order.number}", style = MaterialTheme.typography.titleMedium.merge(Tabular))
                    Text(formatOrderTime(order.createdAt), style = MaterialTheme.typography.bodyMedium.merge(Tabular), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                OrderStatusPill(order.status)
            }
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                order.lines.forEach { Text("•  ${it.summary()}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                Text(order.total.format(), style = MaterialTheme.typography.titleLarge.merge(Tabular))
                Text(
                    "View Details",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.heightIn(min = 48.dp).clickable(onClick = onClick).padding(horizontal = 4.dp).wrapContentHeight(Alignment.CenterVertically),
                )
            }
        }
    }
}

/** "1x Pepperoni (Medium)", matching the reference's order lines. */
internal fun OrderLine.summary(): String = "${quantity}x $name ($variantName)"

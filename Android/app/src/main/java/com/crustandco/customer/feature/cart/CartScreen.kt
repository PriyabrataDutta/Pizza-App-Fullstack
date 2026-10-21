package com.crustandco.customer.feature.cart

import com.crustandco.customer.core.designsystem.components.CrustCard
import com.crustandco.customer.core.designsystem.Ph
import com.crustandco.customer.core.designsystem.PhIcon
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.crustandco.customer.LocalAppContainer
import com.crustandco.customer.core.AppError
import com.crustandco.customer.core.UiState
import com.crustandco.customer.core.designsystem.Tabular
import com.crustandco.customer.core.designsystem.components.ArtKind
import com.crustandco.customer.core.designsystem.components.CategoryGlyph
import com.crustandco.customer.core.designsystem.components.CrustTopBar
import com.crustandco.customer.core.designsystem.components.EmptyState
import com.crustandco.customer.core.designsystem.components.KindArt
import com.crustandco.customer.core.designsystem.components.PrimaryButton
import com.crustandco.customer.core.designsystem.components.QuantityStepper
import com.crustandco.customer.core.designsystem.components.artKind
import com.crustandco.customer.domain.CartItem
import com.crustandco.customer.domain.Category
import com.crustandco.customer.domain.MAX_LINE_QUANTITY
import com.crustandco.customer.domain.Quote
import com.crustandco.customer.domain.subtotal

/**
 * The cart. Every number in the summary comes from the server's quote; the device only adds up nothing.
 * (While the quote loads, the line prices above are indicative snapshots.)
 */
@Composable
fun CartScreen(
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onBrowseMenu: () -> Unit,
    onCheckout: (couponCode: String?) -> Unit,
) {
    val container = LocalAppContainer.current
    val viewModel: CartViewModel = viewModel(
        factory = viewModelFactory { initializer { CartViewModel(container.cartStore, container.pricingRepository, container.catalogRepository) } },
    )
    val state by viewModel.state.collectAsStateWithLifecycle()
    var couponSheetOpen by rememberSaveable { mutableStateOf(false) }
    val quote = (state.quote as? UiState.Success)?.data

    Column(Modifier.fillMaxSize().padding(top = contentPadding.calculateTopPadding())) {
        CrustTopBar(title = "My Cart", onBack = onBack)

        if (state.items.isEmpty()) {
            EmptyState(
                title = "Your cart is empty",
                body = "Pick something from the menu and it will show up here.",
                actionLabel = "Browse the menu",
                onAction = onBrowseMenu,
            )
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(state.items, key = { it.key }) { item ->
                    CartLine(
                        item = item,
                        kind = state.categories.kindOf(item),
                        onIncrease = { viewModel.increase(item) },
                        onDecrease = { viewModel.decrease(item) },
                        onRemove = { viewModel.remove(item) },
                    )
                }
                item {
                    CouponRow(
                        appliedCode = state.couponCode,
                        error = state.couponError,
                        onOpen = { couponSheetOpen = true },
                        onRemove = viewModel::removeCoupon,
                    )
                }
                item { Summary(state.quote, state.items, onRetry = viewModel::retryQuote) }
            }

            Surface(color = MaterialTheme.colorScheme.background, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {
                Column(Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 12.dp + contentPadding.calculateBottomPadding())) {
                    PrimaryButton(
                        text = "Proceed to Checkout",
                        onClick = { onCheckout(state.couponCode) },
                        enabled = quote != null,
                        modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
                    )
                }
            }
        }
    }

    if (couponSheetOpen) {
        CouponSheet(
            error = state.couponError,
            applying = state.applyingCoupon,
            appliedCode = state.couponCode,
            onApply = viewModel::applyCoupon,
            onDismiss = {
                couponSheetOpen = false
                viewModel.clearCouponError()
            },
        )
    }
}

private fun List<Category>.kindOf(item: CartItem): ArtKind = firstOrNull { it.id == item.categoryId }?.artKind() ?: ArtKind.Other

@Composable
private fun CartLine(item: CartItem, kind: ArtKind, onIncrease: () -> Unit, onDecrease: () -> Unit, onRemove: () -> Unit) {
    CrustCard(Modifier.fillMaxWidth()) {
        Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Surface(shape = MaterialTheme.shapes.medium, color = MaterialTheme.colorScheme.surfaceVariant, modifier = Modifier.size(78.dp)) {
                KindArt(kind, Modifier.padding(6.dp), fallbackLetter = item.productName.take(1))
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                    Column(Modifier.weight(1f)) {
                        Text(item.productName, style = MaterialTheme.typography.titleMedium)
                        // Every customization is listed so the customer sees exactly what they're ordering.
                        Text(
                            (listOf(item.variant.name) + item.options.map { it.name }).joinToString(" | "),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    IconButton(onClick = onRemove, modifier = Modifier.size(40.dp)) {
                        PhIcon(Ph.Trash, contentDescription = "Remove ${item.productName} from cart", tint = MaterialTheme.colorScheme.primary, size = 22.dp)
                    }
                }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text(item.lineTotal.format(), style = MaterialTheme.typography.titleMedium.merge(Tabular))
                        if (item.quantity > 1) {
                            Text("${item.unitPrice.format()} each", style = MaterialTheme.typography.labelMedium.merge(Tabular), color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    QuantityStepper(
                        quantity = item.quantity,
                        itemName = item.productName,
                        onDecrease = onDecrease,
                        onIncrease = onIncrease,
                        maxQuantity = MAX_LINE_QUANTITY,
                    )
                }
            }
        }
    }
}

@Composable
private fun CouponRow(appliedCode: String?, error: String?, onOpen: () -> Unit, onRemove: () -> Unit) {
    CrustCard(Modifier.fillMaxWidth()) {
        Column {
            Row(
                Modifier.fillMaxWidth().heightIn(min = 56.dp).clickable(onClick = if (appliedCode == null) onOpen else onRemove).padding(horizontal = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                CategoryGlyph(ArtKind.Deals, size = 28.dp)
                if (appliedCode == null) {
                    Text("Apply Coupon", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                    PhIcon(Ph.CaretRight, contentDescription = null, size = 20.dp)
                } else {
                    Column(Modifier.weight(1f)) {
                        Text("$appliedCode applied", style = MaterialTheme.typography.titleMedium)
                        Text("Tap to remove", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            // A coupon that stopped applying (for example after removing an item) explains itself here.
            if (error != null && appliedCode == null) {
                Text(error, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(start = 14.dp, end = 14.dp, bottom = 12.dp))
            }
        }
    }
}

@Composable
private fun Summary(quote: UiState<Quote>, items: List<CartItem>, onRetry: () -> Unit) {
    Column(Modifier.padding(horizontal = 4.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        when (quote) {
            UiState.Loading -> {
                // The server hasn't answered yet: show the item snapshots' sum, clearly marked as indicative.
                SummaryRow("Subtotal (indicative)", items.subtotal().format())
                Text("Working out delivery and tax…", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            is UiState.Error -> {
                SummaryRow("Subtotal (indicative)", items.subtotal().format())
                Text(
                    if (quote.error == AppError.NotAvailable) "Live pricing and checkout aren’t available yet." else quote.error.userMessage,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (quote.error != AppError.NotAvailable) TextButton(onClick = onRetry) { Text("Try again") }
            }
            is UiState.Success -> {
                val q = quote.data
                SummaryRow("Subtotal", q.subtotal.format())
                if (q.discount.minor > 0) SummaryRow("Discount${q.couponCode?.let { " ($it)" } ?: ""}", "− ${q.discount.format()}")
                SummaryRow("Delivery Fee", if (q.deliveryFee.minor == 0L) "Free" else q.deliveryFee.format())
                if (q.tax.minor > 0) SummaryRow("Tax", q.tax.format())
                Spacer(Modifier.size(2.dp))
                SummaryRow("Total", q.total.format(), emphasized = true)
            }
        }
    }
}

@Composable
internal fun SummaryRow(label: String, value: String, emphasized: Boolean = false) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = if (emphasized) MaterialTheme.typography.titleLarge else MaterialTheme.typography.bodyLarge, color = if (emphasized) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = (if (emphasized) MaterialTheme.typography.titleLarge else MaterialTheme.typography.bodyLarge).merge(Tabular))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CouponSheet(error: String?, applying: Boolean, appliedCode: String?, onApply: (String) -> Unit, onDismiss: () -> Unit) {
    var code by rememberSaveable { mutableStateOf("") }
    // Close once a code has been accepted.
    LaunchedEffect(appliedCode) { if (appliedCode != null) onDismiss() }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = MaterialTheme.colorScheme.background) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Apply Coupon", style = MaterialTheme.typography.headlineMedium)
            OutlinedTextField(
                value = code,
                onValueChange = { code = it.uppercase() },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                label = { Text("Coupon code") },
                isError = error != null,
                supportingText = { if (error != null) Text(error) },
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { onApply(code) }),
                shape = MaterialTheme.shapes.medium,
            )
            PrimaryButton("Apply", onClick = { onApply(code) }, loading = applying, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp))
        }
    }
}

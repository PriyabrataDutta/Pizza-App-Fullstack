package com.crustandco.customer.feature.checkout

import com.crustandco.customer.core.designsystem.Motion
import androidx.compose.ui.graphics.Color
import androidx.compose.animation.core.tween
import androidx.compose.animation.animateColorAsState
import com.crustandco.customer.core.designsystem.Ph
import com.crustandco.customer.core.designsystem.PhIcon
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
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
import com.crustandco.customer.core.designsystem.components.EmptyState
import com.crustandco.customer.core.designsystem.components.ErrorState
import com.crustandco.customer.core.designsystem.components.LoadingState
import com.crustandco.customer.core.designsystem.components.PrimaryButton
import com.crustandco.customer.core.designsystem.components.SecondaryButton
import com.crustandco.customer.domain.Address
import com.crustandco.customer.domain.Order
import com.crustandco.customer.domain.PaymentMethod
import com.crustandco.customer.domain.itemCount
import com.crustandco.customer.feature.addresses.AddressFormSheet
import com.crustandco.customer.feature.cart.SummaryRow

@Composable
fun CheckoutScreen(
    contentPadding: PaddingValues,
    couponCode: String?,
    onExit: () -> Unit,
    onTrackOrder: (orderId: String) -> Unit,
    onGoHome: () -> Unit,
) {
    val container = LocalAppContainer.current
    val viewModel: CheckoutViewModel = viewModel(
        factory = viewModelFactory {
            initializer {
                CheckoutViewModel(couponCode, container.cartStore, container.addressRepository, container.pricingRepository, container.checkoutRepository, contacts = container.contactStore)
            }
        },
    )
    val state by viewModel.state.collectAsStateWithLifecycle()
    var addressFormOpen by rememberSaveable { mutableStateOf(false) }

    // Back goes one step at a time. After the order is placed there is nothing to go back to: leave for Home.
    val goBack = {
        if (!viewModel.back()) {
            if (state.step == CheckoutStep.Done) onGoHome() else onExit()
        }
    }
    BackHandler(onBack = goBack)

    Column(Modifier.fillMaxSize().padding(top = contentPadding.calculateTopPadding())) {
        CrustTopBar(title = "Checkout", onBack = goBack)

        if (state.items.isEmpty() && state.step != CheckoutStep.Done) {
            EmptyState("Your cart is empty", "Add something from the menu to check out.", actionLabel = "Back", onAction = onExit)
            return@Column
        }

        StepIndicator(current = if (state.step == CheckoutStep.Done) 3 else state.step.ordinal)

        when (state.step) {
            CheckoutStep.Address -> AddressStep(
                state = state,
                bottomInset = contentPadding.calculateBottomPadding(),
                onSelect = viewModel::selectAddress,
                onAddNew = { addressFormOpen = true },
                onInstructions = viewModel::setInstructions,
                onName = viewModel::setContactName,
                onPhone = viewModel::setContactPhone,
                onRetry = viewModel::retryAddresses,
                onContinue = viewModel::continueToPayment,
            )
            CheckoutStep.Payment -> PaymentStep(
                state = state,
                bottomInset = contentPadding.calculateBottomPadding(),
                onSelect = viewModel::selectPayment,
                onRetryQuote = viewModel::loadQuote,
                onPay = viewModel::placeOrder,
            )
            CheckoutStep.Done -> state.placedOrder?.let { DoneStep(it, contentPadding.calculateBottomPadding(), { onTrackOrder(it.id) }, onGoHome) }
        }
    }

    if (addressFormOpen) {
        AddressFormSheet(
            saving = state.addressSaving,
            serverError = state.addressError,
            onSave = { viewModel.addAddress(it) { addressFormOpen = false } },
            onDismiss = {
                addressFormOpen = false
                viewModel.clearAddressError()
            },
        )
    }
}

/** Address, Payment, Review. Finished steps show a tick, the current one is solid red, later ones are outlined. */
@Composable
private fun StepIndicator(current: Int) {
    val colors = MaterialTheme.colorScheme
    val labels = listOf("Address", "Payment", "Review")
    Row(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 8.dp), verticalAlignment = Alignment.Top) {
        labels.forEachIndexed { index, label ->
            if (index > 0) {
                val line by animateColorAsState(if (index <= current) colors.primary else colors.outline, tween(Motion.Slow), label = "stepLine")
                Box(Modifier.weight(1f).padding(top = 14.dp).height(2.dp).background(line))
            }
            Column(Modifier.width(64.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                val reached = index <= current
                val fill by animateColorAsState(if (reached) colors.primary else Color.Transparent, tween(Motion.Slow), label = "stepFill")
                Box(
                    Modifier
                        .size(28.dp)
                        .background(fill, CircleShape)
                        .then(if (reached) Modifier else Modifier.border(1.5.dp, colors.outline, CircleShape)),
                    contentAlignment = Alignment.Center,
                ) {
                    if (index < current) {
                        PhIcon(Ph.Check, contentDescription = "$label done", tint = colors.onPrimary, size = 16.dp)
                    } else {
                        Text((index + 1).toString(), style = MaterialTheme.typography.labelMedium, color = if (reached) colors.onPrimary else colors.onSurfaceVariant)
                    }
                }
                Text(label, style = MaterialTheme.typography.labelMedium, color = if (reached) colors.onSurface else colors.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun AddressStep(
    state: CheckoutState,
    bottomInset: androidx.compose.ui.unit.Dp,
    onSelect: (String) -> Unit,
    onAddNew: () -> Unit,
    onInstructions: (String) -> Unit,
    onName: (String) -> Unit,
    onPhone: (String) -> Unit,
    onRetry: () -> Unit,
    onContinue: () -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Who should we call?", style = MaterialTheme.typography.titleLarge)
                    OutlinedTextField(
                        value = state.contactName,
                        onValueChange = onName,
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        label = { Text("Name") },
                        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words, imeAction = ImeAction.Next),
                        shape = MaterialTheme.shapes.medium,
                    )
                    OutlinedTextField(
                        value = state.contactPhone,
                        onValueChange = onPhone,
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        label = { Text("Phone number") },
                        supportingText = { Text("The driver calls this number if they can’t find you.") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone, imeAction = ImeAction.Done),
                        shape = MaterialTheme.shapes.medium,
                    )
                }
            }

            item { Text("Delivery Address", style = MaterialTheme.typography.titleLarge) }

            when (val addresses = state.addresses) {
                UiState.Loading -> item { LoadingState(label = "Loading addresses") }
                is UiState.Error -> item { ErrorState(addresses.error, onRetry = onRetry) }
                is UiState.Success -> {
                    items(addresses.data, key = { it.id }) { address ->
                        AddressChoice(address, selected = address.id == state.selectedAddressId, onClick = { onSelect(address.id) })
                    }
                    item { AddAddressRow(onAddNew) }
                }
            }

            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Bottom) {
                        Text("Delivery Instructions", style = MaterialTheme.typography.titleLarge)
                        Text("(Optional)", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 2.dp))
                    }
                    OutlinedTextField(
                        value = state.instructions,
                        onValueChange = onInstructions,
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 3,
                        placeholder = { Text("E.g. Ring the doorbell, leave at door…") },
                        shape = MaterialTheme.shapes.medium,
                    )
                }
            }
        }
        BottomAction(bottomInset) {
            PrimaryButton("Continue", onClick = onContinue, enabled = state.selectedAddress != null && state.contactValid, modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp))
        }
    }
}

@Composable
private fun AddressChoice(address: Address, selected: Boolean, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Card(
        modifier = Modifier.fillMaxWidth().selectable(selected = selected, role = Role.RadioButton, onClick = onClick),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = colors.surface),
        border = BorderStroke(if (selected) 1.5.dp else 1.dp, if (selected) colors.primary else colors.outline),
    ) {
        Row(Modifier.padding(14.dp).heightIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            RadioDot(selected)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(address.label, style = MaterialTheme.typography.titleMedium)
                Text(address.oneLine, style = MaterialTheme.typography.bodyMedium, color = colors.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun RadioDot(selected: Boolean) {
    val colors = MaterialTheme.colorScheme
    Box(
        Modifier.size(26.dp).then(if (selected) Modifier.background(colors.primary, CircleShape) else Modifier.border(1.5.dp, colors.outline, CircleShape)),
        contentAlignment = Alignment.Center,
    ) {
        if (selected) PhIcon(Ph.Check, contentDescription = null, tint = colors.onPrimary, size = 16.dp)
    }
}

@Composable
private fun AddAddressRow(onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Card(
        modifier = Modifier.fillMaxWidth().clickable(role = Role.Button, onClick = onClick),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = colors.surface),
        border = BorderStroke(1.dp, colors.outline),
    ) {
        Row(Modifier.padding(14.dp).heightIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.size(26.dp).background(colors.primary, CircleShape), contentAlignment = Alignment.Center) {
                PhIcon(Ph.Plus, contentDescription = null, tint = colors.onPrimary, size = 16.dp)
            }
            Text("Add New Address", style = MaterialTheme.typography.titleMedium)
        }
    }
}

@Composable
private fun PaymentStep(
    state: CheckoutState,
    bottomInset: androidx.compose.ui.unit.Dp,
    onSelect: (PaymentMethod) -> Unit,
    onRetryQuote: () -> Unit,
    onPay: () -> Unit,
) {
    val quote = (state.quote as? UiState.Success)?.data
    Column(Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item { Text("Payment Method", style = MaterialTheme.typography.titleLarge) }
            if (quote != null && !quote.restaurantOpen) {
                item {
                    Text(quote.closedMessage.ifBlank { "We are not taking orders right now." }, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.error)
                }
            }
            items(PaymentMethod.selectable, key = { it.wire }) { method ->
                PaymentRow(method, selected = method == state.paymentMethod, onClick = { onSelect(method) })
            }

            item { Text("Order Summary", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp)) }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SummaryRow("Items (${state.items.itemCount()})", quote?.subtotal?.format() ?: "—")
                    when (val q = state.quote) {
                        UiState.Loading -> Text("Working out delivery and tax…", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        is UiState.Error -> ErrorState(q.error, onRetry = onRetryQuote)
                        is UiState.Success -> {
                            if (q.data.discount.minor > 0) SummaryRow("Discount${q.data.couponCode?.let { " ($it)" } ?: ""}", "− ${q.data.discount.format()}")
                            SummaryRow("Delivery Fee", if (q.data.deliveryFee.minor == 0L) "Free" else q.data.deliveryFee.format())
                            if (q.data.tax.minor > 0) SummaryRow("Tax", q.data.tax.format())
                            SummaryRow("Total", q.data.total.format(), emphasized = true)
                        }
                    }
                }
            }
        }
        BottomAction(bottomInset) {
            if (state.placeError != null) {
                Text(state.placeError, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(bottom = 8.dp))
            }
            val label = when {
                quote == null -> "Place order"
                else -> "Place order · ${quote.total.format()}"
            }
            PrimaryButton(label, onClick = onPay, enabled = quote != null && quote.restaurantOpen, loading = state.placing, modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp))
        }
    }
}

@Composable
private fun PaymentRow(method: PaymentMethod, selected: Boolean, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Card(
        modifier = Modifier.fillMaxWidth().selectable(selected = selected, role = Role.RadioButton, onClick = onClick),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = colors.surface),
        border = BorderStroke(if (selected) 1.5.dp else 1.dp, if (selected) colors.primary else colors.outline),
    ) {
        Row(Modifier.padding(14.dp).heightIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.size(36.dp).background(colors.primaryContainer, RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) {
                if (method == PaymentMethod.CashOnDelivery) {
                    Text("€", style = MaterialTheme.typography.titleMedium, color = colors.primary)
                } else {
                    PhIcon(Ph.Lock, contentDescription = null, tint = colors.primary, size = 20.dp)
                }
            }
            Text(method.label, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
            RadioDot(selected)
        }
    }
}

@Composable
private fun BottomAction(bottomInset: androidx.compose.ui.unit.Dp, content: @Composable () -> Unit) {
    Surface(color = MaterialTheme.colorScheme.background, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {
        Column(Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 12.dp + bottomInset)) { content() }
    }
}

@Composable
private fun DoneStep(order: Order, bottomInset: androidx.compose.ui.unit.Dp, onTrack: () -> Unit, onHome: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(start = 24.dp, end = 24.dp, top = 32.dp, bottom = 24.dp + bottomInset),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.size(84.dp).background(colors.primary, CircleShape), contentAlignment = Alignment.Center) {
            PhIcon(Ph.Check, contentDescription = null, tint = colors.onPrimary, size = 48.dp)
        }
        Text("Order placed!", style = MaterialTheme.typography.headlineLarge)
        Text("Order ${order.number}", style = MaterialTheme.typography.titleMedium.merge(Tabular))
        Text(order.total.format(), style = MaterialTheme.typography.titleLarge.merge(Tabular))
        order.estimatedMinutes?.let {
            Text("Estimated delivery: about $it minutes", style = MaterialTheme.typography.bodyLarge, color = colors.onSurfaceVariant, textAlign = TextAlign.Center)
        }
        if (order.paymentMethod == PaymentMethod.OnlineDemo) {
            Text("Demo payment. No money was taken.", style = MaterialTheme.typography.bodyMedium, color = colors.onSurfaceVariant)
        }
        PrimaryButton("Track order", onClick = onTrack, modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(top = 12.dp))
        SecondaryButton("Back to home", onClick = onHome, modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp))
    }
}

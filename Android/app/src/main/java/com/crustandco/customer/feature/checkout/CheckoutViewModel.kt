package com.crustandco.customer.feature.checkout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.crustandco.customer.core.AppResult
import com.crustandco.customer.core.UiState
import com.crustandco.customer.core.toUiState
import com.crustandco.customer.domain.Address
import com.crustandco.customer.domain.AddressRepository
import com.crustandco.customer.domain.CartItem
import com.crustandco.customer.domain.CartStore
import com.crustandco.customer.domain.CheckoutRepository
import com.crustandco.customer.domain.CheckoutRequest
import com.crustandco.customer.domain.NewAddress
import com.crustandco.customer.domain.Order
import com.crustandco.customer.domain.PaymentMethod
import com.crustandco.customer.domain.PricingRepository
import com.crustandco.customer.domain.Quote
import com.crustandco.customer.domain.toCheckoutItem
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID

enum class CheckoutStep { Address, Payment, Done }

data class CheckoutState(
    val step: CheckoutStep = CheckoutStep.Address,
    val items: List<CartItem> = emptyList(),
    val addresses: UiState<List<Address>> = UiState.Loading,
    val selectedAddressId: String? = null,
    val instructions: String = "",
    val paymentMethod: PaymentMethod = PaymentMethod.CashOnDelivery,
    /** The server's price breakdown, shown on the payment step. */
    val quote: UiState<Quote> = UiState.Loading,
    /** True while the order request is in flight. The Pay button is inert, so double taps can't send twice. */
    val placing: Boolean = false,
    val placeError: String? = null,
    val placedOrder: Order? = null,
    val addressSaving: Boolean = false,
    val addressError: String? = null,
) {
    val selectedAddress: Address?
        get() = (addresses as? UiState.Success)?.data?.firstOrNull { it.id == selectedAddressId }
}

class CheckoutViewModel(
    private val couponCode: String?,
    private val cart: CartStore,
    private val addressRepository: AddressRepository,
    private val pricing: PricingRepository,
    private val checkout: CheckoutRepository,
    private val newKey: () -> String = { UUID.randomUUID().toString() },
) : ViewModel() {
    private val _state = MutableStateFlow(CheckoutState(items = cart.items.value))
    val state: StateFlow<CheckoutState> = _state.asStateFlow()

    // One idempotency key per distinct order. A retry of the SAME order reuses it, so the server can't create two.
    // Changing anything about the order (address, payment, notes) starts a new key.
    private var attempt: Pair<CheckoutRequest, String>? = null

    init {
        loadAddresses()
        loadQuote()
    }

    private fun loadAddresses(selectId: String? = null) {
        viewModelScope.launch {
            val result = addressRepository.addresses().toUiState()
            _state.update { state ->
                val list = (result as? UiState.Success)?.data.orEmpty()
                val keep = selectId ?: state.selectedAddressId?.takeIf { id -> list.any { it.id == id } }
                state.copy(addresses = result, selectedAddressId = keep ?: list.firstOrNull()?.id)
            }
        }
    }

    fun loadQuote() {
        val items = cart.items.value
        _state.update { it.copy(items = items, quote = UiState.Loading) }
        viewModelScope.launch {
            val result = if (items.isEmpty()) null else pricing.quote(items.map { it.toCheckoutItem() }, couponCode)
            if (result != null) _state.update { it.copy(quote = result.toUiState()) }
        }
    }

    fun retryAddresses() {
        _state.update { it.copy(addresses = UiState.Loading) }
        loadAddresses()
    }

    fun selectAddress(id: String) = _state.update { it.copy(selectedAddressId = id) }

    fun setInstructions(text: String) = _state.update { it.copy(instructions = text.take(300)) }

    fun selectPayment(method: PaymentMethod) = _state.update { it.copy(paymentMethod = method) }

    fun addAddress(address: NewAddress, onSaved: () -> Unit) {
        if (_state.value.addressSaving) return
        _state.update { it.copy(addressSaving = true, addressError = null) }
        viewModelScope.launch {
            when (val result = addressRepository.add(address)) {
                is AppResult.Success -> {
                    _state.update { it.copy(addressSaving = false) }
                    loadAddresses(selectId = result.data.id)
                    onSaved()
                }
                is AppResult.Failure -> _state.update { it.copy(addressSaving = false, addressError = result.error.userMessage) }
            }
        }
    }

    fun clearAddressError() = _state.update { it.copy(addressError = null) }

    fun continueToPayment() {
        if (_state.value.selectedAddress == null) return
        _state.update { it.copy(step = CheckoutStep.Payment, placeError = null) }
    }

    /** Back one step. Returns false when already on the first step (the screen should leave). */
    fun back(): Boolean = when (_state.value.step) {
        CheckoutStep.Payment -> {
            _state.update { it.copy(step = CheckoutStep.Address, placeError = null) }
            true
        }
        else -> false
    }

    fun placeOrder() {
        val state = _state.value
        if (state.placing || state.placedOrder != null) return
        val address = state.selectedAddress ?: return
        val items = cart.items.value
        if (items.isEmpty()) return

        val request = CheckoutRequest(
            idempotencyKey = "",
            addressId = address.id,
            paymentMethod = state.paymentMethod,
            couponCode = couponCode,
            items = items.map { it.toCheckoutItem() },
            instructions = state.instructions.trim().ifEmpty { null },
        )
        val key = attempt?.takeIf { (previous, _) -> previous == request }?.second ?: newKey()
        attempt = request to key

        _state.update { it.copy(placing = true, placeError = null) }
        viewModelScope.launch {
            when (val result = checkout.placeOrder(request.copy(idempotencyKey = key))) {
                is AppResult.Success -> {
                    cart.clear()
                    _state.update { it.copy(placing = false, placedOrder = result.data, step = CheckoutStep.Done) }
                }
                is AppResult.Failure -> _state.update { it.copy(placing = false, placeError = result.error.userMessage) }
            }
        }
    }
}

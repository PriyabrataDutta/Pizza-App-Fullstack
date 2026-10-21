package com.crustandco.customer.feature.cart

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.crustandco.customer.LocalAppContainer
import com.crustandco.customer.core.AppError
import com.crustandco.customer.core.AppResult
import com.crustandco.customer.core.UiState
import com.crustandco.customer.domain.CartItem
import com.crustandco.customer.domain.CartStore
import com.crustandco.customer.domain.CatalogRepository
import com.crustandco.customer.domain.Category
import com.crustandco.customer.domain.PricingRepository
import com.crustandco.customer.domain.Quote
import com.crustandco.customer.domain.itemCount
import com.crustandco.customer.domain.toCheckoutItem
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class CartUiState(
    val items: List<CartItem> = emptyList(),
    val categories: List<Category> = emptyList(),
    /** The server's price breakdown for the current items and coupon. Never calculated on the device. */
    val quote: UiState<Quote> = UiState.Loading,
    val couponCode: String? = null,
    /** Why the last coupon attempt failed, in words the customer can act on. */
    val couponError: String? = null,
    val applyingCoupon: Boolean = false,
)

@OptIn(ExperimentalCoroutinesApi::class)
class CartViewModel(
    private val cart: CartStore,
    private val pricing: PricingRepository,
    private val catalog: CatalogRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(CartUiState(items = cart.items.value))
    val state: StateFlow<CartUiState> = _state.asStateFlow()

    private val coupon = MutableStateFlow<String?>(null)
    private val refresh = MutableStateFlow(0)

    init {
        viewModelScope.launch {
            val categories = catalog.categories()
            if (categories is AppResult.Success) _state.update { it.copy(categories = categories.data) }
        }
        // Re-price whenever the items or the coupon change (collectLatest drops a stale request).
        viewModelScope.launch {
            combine(cart.items, coupon, refresh) { items, code, _ -> items to code }.collectLatest { (items, code) ->
                _state.update { it.copy(items = items, couponCode = code) }
                if (items.isEmpty()) return@collectLatest
                _state.update { it.copy(quote = UiState.Loading) }
                when (val result = pricing.quote(items.map { it.toCheckoutItem() }, code)) {
                    is AppResult.Success -> _state.update { it.copy(quote = UiState.Success(result.data)) }
                    is AppResult.Failure -> {
                        val error = result.error
                        if (code != null && error is AppError.Validation) {
                            // The coupon stopped applying (say the customer removed an item). Drop it and say why.
                            _state.update { it.copy(couponError = error.userMessage) }
                            coupon.value = null
                        } else {
                            _state.update { it.copy(quote = UiState.Error(error)) }
                        }
                    }
                }
            }
        }
    }

    fun retryQuote() {
        refresh.update { it + 1 }
    }

    fun increase(item: CartItem) = cart.setQuantity(item.key, item.quantity + 1)

    /** Going below 1 removes the line. */
    fun decrease(item: CartItem) = cart.setQuantity(item.key, item.quantity - 1)

    fun remove(item: CartItem) = cart.remove(item.key)

    fun applyCoupon(code: String) {
        val trimmed = code.trim()
        if (trimmed.isEmpty()) {
            _state.update { it.copy(couponError = "Enter a coupon code.") }
            return
        }
        val items = cart.items.value
        if (items.isEmpty()) return
        viewModelScope.launch {
            _state.update { it.copy(applyingCoupon = true, couponError = null) }
            when (val result = pricing.quote(items.map { it.toCheckoutItem() }, trimmed)) {
                is AppResult.Success -> {
                    _state.update { it.copy(applyingCoupon = false, couponError = null) }
                    coupon.value = result.data.couponCode ?: trimmed.uppercase()
                }
                is AppResult.Failure -> _state.update { it.copy(applyingCoupon = false, couponError = result.error.userMessage) }
            }
        }
    }

    fun removeCoupon() {
        _state.update { it.copy(couponError = null) }
        coupon.value = null
    }

    fun clearCouponError() = _state.update { it.copy(couponError = null) }
}

/** Total number of items in the cart, for the badge on the Cart tab. */
@Composable
fun rememberCartCount(): Int {
    val items by LocalAppContainer.current.cartStore.items.collectAsStateWithLifecycle()
    return items.itemCount()
}

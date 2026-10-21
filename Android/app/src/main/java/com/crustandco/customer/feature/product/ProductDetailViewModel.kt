package com.crustandco.customer.feature.product

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.crustandco.customer.core.AppResult
import com.crustandco.customer.core.Money
import com.crustandco.customer.core.UiState
import com.crustandco.customer.domain.CartItem
import com.crustandco.customer.domain.CartStore
import com.crustandco.customer.domain.CatalogRepository
import com.crustandco.customer.domain.Category
import com.crustandco.customer.domain.MAX_LINE_QUANTITY
import com.crustandco.customer.domain.Product
import com.crustandco.customer.domain.Selection
import com.crustandco.customer.domain.SelectionIssue
import com.crustandco.customer.domain.SelectionRules
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ProductDetailState(
    val product: UiState<Product> = UiState.Loading,
    /** Only used to pick the illustration for the product; if it fails to load, a neutral one is used. */
    val categories: List<Category> = emptyList(),
    val selection: Selection = Selection(variantId = null),
    val quantity: Int = 1,
    /** Shown only after the customer tries to add with something missing, never while they're still choosing. */
    val issues: List<SelectionIssue> = emptyList(),
    /** One-shot: the screen leaves when this turns true and calls [ProductDetailViewModel.consumeAdded]. */
    val added: Boolean = false,
) {
    private val loaded: Product? get() = (product as? UiState.Success)?.data

    /** Indicative price of one item with the current choices. */
    val unitPrice: Money? get() = loaded?.let { SelectionRules.unitPrice(it, selection) }

    /** Indicative total for the chosen quantity. The server confirms the real total at checkout. */
    val total: Money? get() = unitPrice?.times(quantity)

    fun issueFor(groupId: String?): String? = issues.firstOrNull { it.groupId == groupId }?.message
}

class ProductDetailViewModel(
    private val productId: String,
    private val catalog: CatalogRepository,
    private val cart: CartStore,
) : ViewModel() {
    private val _state = MutableStateFlow(ProductDetailState())
    val state: StateFlow<ProductDetailState> = _state.asStateFlow()

    init {
        load()
    }

    fun retry() = load()

    private fun load() {
        _state.update { it.copy(product = UiState.Loading) }
        viewModelScope.launch {
            val categories = catalog.categories()
            if (categories is AppResult.Success) _state.update { it.copy(categories = categories.data) }
        }
        viewModelScope.launch {
            when (val result = catalog.product(productId)) {
                is AppResult.Success -> _state.update {
                    it.copy(product = UiState.Success(result.data), selection = SelectionRules.defaultSelection(result.data), issues = emptyList())
                }
                is AppResult.Failure -> _state.update { it.copy(product = UiState.Error(result.error)) }
            }
        }
    }

    fun selectVariant(variantId: String) = change { product, selection -> SelectionRules.selectVariant(product, selection, variantId) }

    fun toggleOption(groupId: String, optionId: String) =
        change { product, selection -> SelectionRules.toggleOption(product, selection, groupId, optionId) }

    private fun change(transform: (Product, Selection) -> Selection) {
        _state.update { state ->
            val product = (state.product as? UiState.Success)?.data ?: return@update state
            // Editing clears old "choose a crust" messages so they don't linger after being fixed.
            state.copy(selection = transform(product, state.selection), issues = emptyList())
        }
    }

    fun increaseQuantity() = _state.update { it.copy(quantity = (it.quantity + 1).coerceAtMost(MAX_LINE_QUANTITY)) }

    fun decreaseQuantity() = _state.update { it.copy(quantity = (it.quantity - 1).coerceAtLeast(1)) }

    fun addToCart() {
        val state = _state.value
        val product = (state.product as? UiState.Success)?.data ?: return
        val issues = SelectionRules.validate(product, state.selection)
        if (issues.isNotEmpty()) {
            _state.update { it.copy(issues = issues) }
            return
        }
        val variant = SelectionRules.selectedVariant(product, state.selection) ?: return
        cart.add(
            CartItem(
                productId = product.id,
                categoryId = product.categoryId,
                productName = product.name,
                variant = variant,
                options = SelectionRules.selectedOptions(product, state.selection),
                quantity = state.quantity,
            ),
        )
        _state.update { it.copy(added = true) }
    }

    fun consumeAdded() = _state.update { it.copy(added = false) }
}

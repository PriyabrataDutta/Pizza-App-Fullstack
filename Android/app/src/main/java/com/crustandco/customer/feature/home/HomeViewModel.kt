package com.crustandco.customer.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.crustandco.customer.core.AppResult
import com.crustandco.customer.core.UiState
import com.crustandco.customer.core.designsystem.components.ArtKind
import com.crustandco.customer.core.designsystem.components.artKind
import com.crustandco.customer.domain.AddressRepository
import com.crustandco.customer.domain.CartStore
import com.crustandco.customer.domain.CatalogRepository
import com.crustandco.customer.domain.Category
import com.crustandco.customer.domain.Product
import com.crustandco.customer.domain.Promotion
import com.crustandco.customer.domain.PromotionRepository
import com.crustandco.customer.domain.quickAddItem
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class HomeState(
    val categories: List<Category> = emptyList(),
    val promotions: List<Promotion> = emptyList(),
    /** One-line default delivery address, or null when there isn't one (or addresses aren't available). */
    val deliverTo: String? = null,
    val popular: UiState<List<Product>> = UiState.Loading,
)

class HomeViewModel(
    private val catalog: CatalogRepository,
    private val promotions: PromotionRepository,
    private val addresses: AddressRepository,
    private val cart: CartStore,
) : ViewModel() {
    private val _state = MutableStateFlow(HomeState())
    val state: StateFlow<HomeState> = _state.asStateFlow()

    init {
        load()
    }

    fun retry() = load()

    /** True if the item went straight into the cart. False means the customer must choose a size or options first. */
    fun quickAdd(product: Product): Boolean {
        val item = product.quickAddItem() ?: return false
        cart.add(item)
        return true
    }

    private fun load() {
        _state.update { it.copy(popular = UiState.Loading) }
        // Categories, promotions and the address line are decoration: if they fail, the rest of Home still works.
        viewModelScope.launch {
            val result = catalog.categories()
            if (result is AppResult.Success) _state.update { it.copy(categories = result.data) }
        }
        viewModelScope.launch {
            val result = promotions.promotions()
            if (result is AppResult.Success) _state.update { it.copy(promotions = result.data) }
        }
        viewModelScope.launch {
            val result = addresses.addresses()
            if (result is AppResult.Success) _state.update { it.copy(deliverTo = result.data.firstOrNull()?.oneLine) }
        }
        viewModelScope.launch {
            val result = catalog.products()
            val popular = when (result) {
                is AppResult.Success -> UiState.Success(result.data)
                is AppResult.Failure -> UiState.Error(result.error)
            }
            _state.update { it.copy(popular = popular) }
        }
    }
}

/** Bestsellers that are pizzas. If category info is missing, all bestsellers are shown instead of an empty list. */
fun HomeState.popularPizzas(products: List<Product>): List<Product> {
    val bestsellers = products.filter { it.isBestseller }
    val pizzas = bestsellers.filter { p -> categories.firstOrNull { it.id == p.categoryId }?.artKind() == ArtKind.Pizza }
    return if (categories.isEmpty()) bestsellers else pizzas
}
